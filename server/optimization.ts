import crypto from 'crypto';
import { pipelineCache } from './cacheUtility';
import type { ModelCallResult, ModelRunner } from './modelRunner';
import { computeBulletBudgets, roleSourceBullets } from "../src/lib/bulletBudget";
import type { BudgetOptions } from "../src/lib/bulletBudget";
import {
  buildRequirementAnalysisPrompt,
  parseRequirementAnalysis,
  parseResumeJson,
} from "../src/lib/requirementEvidence";
import type { CandidateMaterial, RequirementAnalysis } from "../src/lib/requirementEvidence";

/**
 * Token Optimization Strategy
 */

/** What the extraction step reads of a free-form resume. JSON resumes are parsed in code, in full. */
export const RESUME_EXTRACTION_LIMIT = 60000;

/**
 * Trims input text to a reasonable limit before sending to any AI
 */
export function trimInput(text: string, maxLength: number = 8000): string {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function plainText(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/** Skills as one flat list, whatever the master resume's shape: a list, categories, or comma-separated text. */
function flattenSkills(skills: unknown): string[] {
  const entry = (item: unknown) =>
    typeof item === "string" ? item : item && typeof item === "object" ? plainText((item as any).name ?? (item as any).skill) : "";
  let entries: string[] = [];
  if (typeof skills === "string") entries = skills.split(",");
  else if (Array.isArray(skills)) entries = skills.map(entry);
  else if (skills && typeof skills === "object") {
    entries = Object.entries(skills as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("_"))
      .flatMap(([, items]) => (typeof items === "string" ? items.split(",") : Array.isArray(items) ? items.map(entry) : []));
  }
  return entries.map((item) => item.trim()).filter(Boolean);
}

/**
 * A JSON master resume in the extraction schema, read in code: every role and
 * bullet exactly as written, nothing truncated, no model call. Null for
 * free-form text, and for JSON whose roles carry no bullets this parser
 * recognises - both still go through extraction.
 */
export function structuredResumeFromText(resumeText: string): any | null {
  const data = parseResumeJson(resumeText);
  const roles = Array.isArray(data?.experience) ? data.experience : Array.isArray(data?.work_experience) ? data.work_experience : null;
  if (!data || !roles || roles.length === 0) return null;
  const experience = roles
    .filter((role: unknown) => role && typeof role === "object")
    .map((role: any) => {
      const bullets = roleSourceBullets(role);
      const description = plainText(role.description);
      return {
        role: plainText(role.role ?? role.title),
        company: plainText(role.company),
        duration: plainText(role.duration),
        achievements: bullets.length > 0 ? bullets : description ? [description] : [],
      };
    });
  if (!experience.some((role: { achievements: string[] }) => role.achievements.length > 0)) return null;
  const info = data.personal_info && typeof data.personal_info === "object" ? data.personal_info : {};
  const linkedinText = plainText(info.linkedinText);
  return {
    personal_info: {
      name: plainText(info.name),
      location: plainText(info.location),
      email: plainText(info.email),
      phone: plainText(info.phone),
      linkedin: plainText(info.linkedin),
      ...(linkedinText ? { linkedinText } : {}),
    },
    summary: plainText(data.summary) || plainText(info.summary),
    skills: flattenSkills(data.skills),
    experience,
    projects: (Array.isArray(data.projects) ? data.projects : [])
      .map((project: any) =>
        typeof project === "string"
          ? { title: project.trim(), description: "" }
          : { title: plainText(project?.title ?? project?.name), description: plainText(project?.description) }
      )
      .filter((project: { title: string; description: string }) => project.title || project.description),
    education: Array.isArray(data.education) ? data.education : [],
    certifications: Array.isArray(data.certifications) ? data.certifications : [],
  };
}

/** One answered call: the text, its tokens, and the model and provider that answered. */
export type JsonModelResult = ModelCallResult;

/**
 * The job brief and verified requirement evidence map (requirementEvidence.ts).
 * An answer that yields no usable analysis counts as that model failing, so the
 * fallback is tried. Never throws: data is null when both fail, and the
 * pipeline carries on with keyword extraction instead.
 */
export async function analyzeRequirements(
  input: { jobDescription: string; targetRole?: string; material: CandidateMaterial },
  runner: ModelRunner
): Promise<{ data: RequirementAnalysis | null; result: JsonModelResult | null }> {
  try {
    console.log("[Nexus AI] Stage 1: Requirement evidence analysis...");
    const { data, result } = await runner.callParsed(buildRequirementAnalysisPrompt(input), "analysis", (text) =>
      parseRequirementAnalysis(text, input.material, { jobDescription: input.jobDescription })
    );
    const counts = data.requirements.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
    console.log(
      `[Evidence] ${data.requirements.length} requirements via ${result.model}: ${JSON.stringify(counts)}; ` +
        `${data.verification.quotes_verified}/${data.verification.quotes_proposed} quotes verified` +
        (data.verification.downgraded.length ? `; downgraded ${data.verification.downgraded.join(", ")}` : "")
    );
    return { data, result };
  } catch (error: any) {
    console.warn("[Evidence] Requirement analysis failed:", error?.message || error);
    return { data: null, result: null };
  }
}

/**
 * Free-form resume text in the extraction schema, read by a model. Reports how
 * much of the resume did not fit (omittedChars) so the result can disclose it.
 * Reading the resume is analysis: under Hybrid OpenAI it runs on Gemini. When
 * neither the primary nor the fallback returns usable JSON, the
 * ModelChainError is thrown, because nothing can be written without it.
 */
export async function extractRelevantResumeData(resumeText: string, runner: ModelRunner) {
  const result = await extractResumeDataWithModel(resumeText, runner);
  return { ...result, omittedChars: Math.max(0, (resumeText || "").length - RESUME_EXTRACTION_LIMIT) };
}

async function extractResumeDataWithModel(resumeText: string, runner: ModelRunner) {
  const trimmedResume = trimInput(resumeText, RESUME_EXTRACTION_LIMIT);

  const prompt = `
    Extract ALL professional data from this resume with absolute fidelity. 
    Return ONLY a JSON object ensuring NO content is skipped or summarized in this stage.
    
    REQUIRED SCHEMA:
    {
      "personal_info": { "name": "", "location": "", "email": "", "phone": "", "linkedin": "" },
      "summary": "Full summary text",
      "skills": ["Skill 1", "Skill 2", ...],
      "experience": [
        {
          "role": "Job Title",
          "company": "Company Name",
          "duration": "Dates",
          "achievements": ["Bullet 1", "Bullet 2", ...]
        }
      ],
      "projects": [
        { "title": "Project Name", "description": "Full Description" }
      ],
      "education": [
        { "degree": "e.g. B.Tech in Computer Science", "institution": "e.g. Stanford University", "expected_completion": "e.g. 2018" },
        "Or just string representing school and degree"
      ],
      "certifications": [
        { "name": "Cert Name", "issuer": "Issuing Body", "date": "Date" }
      ]
    }

    STRICT RULES:
    1. EXTRACT EVERY SINGLE ROLE: You MUST extract every job entry listed, from most recent to oldest. Do not skip or merge any roles.
    2. EXTRACT EVERY SINGLE PROJECT: If the resume lists multiple projects, extract ALL of them individually.
    3. EDUCATION: Extract ALL educational background. Use the object format if details are clear, otherwise a string.
    4. NO SUMMARIZATION: Extract bullets and descriptions EXACTLY as they appear in the source text. do not rewrite or shorten them yet.
    5. ACCURACY: Ensure company names, roles, and dates are captured perfectly.
    
    RESUME TEXT:
    ${trimmedResume}
  `;

  // Stage 1: Extraction
  console.log("[Nexus AI] Stage 1: Extraction...");
  const { data, result } = await runner.callParsed(prompt, "analysis", (text) => {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  });
  console.log(`[Extraction] ${result.model}: found ${data.experience?.length || 0} roles and ${data.projects?.length || 0} projects.`);
  return { data, usage: result.usage, _model: result.model };
}

/** The posting's top keywords, when the requirement analysis gave none. Optional: [] when the models fail. */
export async function extractJDKeywords(jobDescription: string, runner: ModelRunner) {
  const trimmedJD = trimInput(jobDescription, 10000);

  const prompt = `
    Extract the top 12 essential keywords and requirements from this job description.
    Return ONLY a JSON array of strings.
    
    JD:
    ${trimmedJD}
  `;

  // Stage 1: JD Analysis
  try {
    console.log("[Nexus AI] Stage 1: JD Keywords...");
    const { data, result } = await runner.callParsed(prompt, "analysis", (text) => {
      // OpenAI's JSON mode answers with an object such as {"keywords": [...]}.
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const keywords = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      return Array.isArray(keywords) && keywords.length > 0 ? (keywords as string[]) : null;
    });
    return { data, usage: result.usage, _model: result.model };
  } catch (error) {
    console.error("Error extracting JD keywords:", error);
    return { data: [] as string[], usage: null };
  }
}

/**
 * `budgetOptions` carries the candidate's bullet rules (and the posting the
 * platform rule reads); pass the same options to planBulletBudgets over the
 * returned experience to get the plan these labels came from.
 */
export function trimContentForAI(resumeData: any, keywords: string[], budgetOptions: BudgetOptions = {}) {
  // Remove duplicates from skills and achievements
  const seenSkills = new Set<string>();
  const uniqueSkills = (resumeData.skills || []).filter((s: string) => {
    const normalized = s.toLowerCase().trim();
    if (seenSkills.has(normalized)) return false;
    seenSkills.add(normalized);
    return true;
  });

  const roles = (Array.isArray(resumeData.experience) ? resumeData.experience : []).map(
    (exp: any, index: number) => {
      const seenBullets = new Set<string>();
      return {
        id: `role_${index + 1}`,
        role: exp?.role,
        company: exp?.company,
        duration: exp?.duration,
        // Remove duplicate bullets and provide more context for AI selection
        original_bullets: (Array.isArray(exp?.achievements) ? exp.achievements : [])
          .filter((a: unknown): a is string => typeof a === "string" && a.trim().length > 0)
          .filter((a: string) => {
            const normalized = a.toLowerCase().trim();
            if (seenBullets.has(normalized)) return false;
            seenBullets.add(normalized);
            return true;
          })
          .slice(0, 50),
      };
    }
  );

  // Computed here rather than left to the model, which is unreliable at date
  // arithmetic, and over the whole list so recency follows the real end dates.
  // The candidate's bullet rules, when given, come before the tenure tiers.
  // Omitted entirely when the duration is unparseable.
  const budgets = computeBulletBudgets(roles, budgetOptions);
  const experience = roles.map((role: any, index: number) => {
    const budget = budgets[index];
    const { original_bullets, ...rest } = role;
    return {
      ...rest,
      ...(budget.tenureMonths !== null ? { tenure_months: budget.tenureMonths } : {}),
      ...(budget.label !== null ? { bullet_budget: budget.label } : {}),
      original_bullets,
    };
  });

    // Ensure we don't exceed reasonable limits but provide enough for Step 3
    return {
      personal_info: resumeData.personal_info || {},
      // Trim summary to reasonable length for prompt safety
      summary: resumeData.summary?.substring(0, 1200),
      skills: uniqueSkills.slice(0, 100),
      experience,
      projects: (resumeData.projects || []).slice(0, 20),
      education: resumeData.education,
      certifications: resumeData.certifications,
      jd_keywords: (keywords || []).slice(0, 30)
    };
}

export function enforceFidelity(aiResponse: any, originalInput: any) {
  try {
    const aiData = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
    const originalExperience = originalInput.experience || [];
    const aiExperience = aiData.experience || [];

    // Create a map for quick lookup by ID
    const aiRoleMap = new Map();
    aiExperience.forEach((role: any) => {
      if (role.id) aiRoleMap.set(role.id, role);
    });

    // Reconstruct experience based STRICKLY on original structure
    const enforcedExperience = originalExperience.map((originalRole: any) => {
      const matchedAI = aiRoleMap.get(originalRole.id);
      
      return {
        role: originalRole.role,
        company: originalRole.company,
        duration: originalRole.duration,
        // Force use of original_bullets to prevent AI from overwriting experience.
        bullets: (originalRole.original_bullets || [])
      };
    });

    // Return the full object with enforced experience
    return {
      ...aiData,
      experience: enforcedExperience
    };
  } catch (error) {
    console.error("[Fidelity] Error enforcing structure:", error);
    return aiResponse; // Fallback to raw if logic fails
  }
}

export function clearCache() {
  pipelineCache.clear();
}

export function saveToCache(key: string, data: any) {
  pipelineCache.set(key, data);
}
