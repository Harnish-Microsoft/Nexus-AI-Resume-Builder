import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { routeTask, RouterConfig } from "./aiRouter";
import { MasterResume, SuitabilityResult, Certification, StarStory, AuditReport } from "../types";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { db, auth } from "../firebase";
import { isEngineMode, isModelChainError, providerFor, runModelChain } from "../lib/aiModels";
import type { AIProvider, EngineMode, ThinkingLevel } from "../lib/aiModels";
import { geminiThinkingConfig, geminiThinkingLevelConfig, getModelCatalog, providerChain } from "./modelCatalog";
import { categorizeSkills } from "../lib/skillCategorizer";
import { buildResumeGenerationPrompt } from "../lib/resumePrompt";
import { applyMatchScores, focusJobDescription, MatchScoreResult } from "../lib/matchScore";
import { applyImpactAudit, ImpactScoreResult } from "../lib/impactScore";
import { withoutExcludedTerms } from "../lib/exclusions";
import {
  analysisKeywords,
  applyRequirementEvidence,
  buildCandidateMaterial,
  buildRequirementAnalysisPrompt,
  parseRequirementAnalysis,
} from "../lib/requirementEvidence";
import type { RequirementAnalysis, RequirementEvidenceReport } from "../lib/requirementEvidence";
import { applyExclusionGuarantee, refreshVerificationReport, reviewAndCorrectDraft } from "../lib/draftReview";
import type { DraftVerificationReport } from "../lib/draftReview";
import { buildInputCoverage, wholePosting } from "../lib/inputCoverage";
import type { InputCoverageReport } from "../lib/inputCoverage";
import { activeBulletRules, enforceBulletBudgets, planBulletBudgets, rolesFromResumeText } from "../lib/bulletBudget";
import type { BudgetPlan, BulletBudgetReport, BulletRules } from "../lib/bulletBudget";
import { activeLinkedInTrends, applyTrendCoverage, buildTrendBrief, trendEvidenceText, trendPreferTerms } from "../lib/linkedinTrends";
import type { LinkedInTrends, TrendCoverageReport } from "../lib/linkedinTrends";
import {
  AUDIENCE_PROFILES,
  applyAudienceCoverage,
  audienceHeadline,
  buildAudienceBrief,
  keywordAudienceMix,
  normalizeAudienceMix,
} from "../lib/audienceProfiles";
import type { AudienceCoverageReport, AudienceMix } from "../lib/audienceProfiles";

export interface OptimizationResult {
  content_validation?: import("../lib/resumeValidation").ValidationStamp;
  personal_info: {
    name: string;
    location: string;
    email: string;
    phone: string;
    linkedin: string;
    linkedinText?: string;
  };
  summary: string;
  skills: {
    Infrastructure: string[];
    DevSecOps: string[];
    Governance: string[];
    Observability: string[];
  };
  experience: {
    role: string;
    company: string;
    duration: string;
    bullets: string[];
  }[];
  certifications: (string | Certification)[];
  projects: { title: string; description: string }[];
  education: string[];
  ats_keywords_from_jd: string[];
  ats_keywords_added_to_resume: string[];
  keyword_gap: string[];
  match_score: number;
  baseline_score: number;
  /** How match_score and baseline_score were derived. Absent when the JD is too thin to score. */
  score_breakdown?: MatchScoreResult["score_breakdown"];
  improvement_notes: string[];
  audience_alignment_notes: string;
  why_this_job?: string;
  rejection_reasons?: string[];
  star_stories?: StarStory[];
  /** Deterministic bullet-quality audit. Absent when there are too few bullets to score. */
  impact_audit?: ImpactScoreResult;
  /** Per-role budget (bullet rules, then tenure) and what enforcement delivered against it. */
  bullet_budget_report?: BulletBudgetReport;
  /** The blended readers and how much of what each scans for the final resume evidences. */
  audience_coverage?: AudienceCoverageReport;
  /** Trending LinkedIn skills for the target role: used, supported but unused, and gaps. Only when trends are followed. */
  linkedin_trends?: TrendCoverageReport;
  /** What the candidate's own material proves for each posting requirement, verified quote by quote. */
  requirement_evidence?: RequirementEvidenceReport;
  /** The review of the draft against the candidate's material: what was corrected and what remains. */
  draft_verification?: DraftVerificationReport;
  /** What each step read of the resume and the posting, and anything left out. */
  input_coverage?: InputCoverageReport;
  audit_report?: AuditReport;
  _usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  _geminiUsage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  /** Tokens this run used, per provider. */
  _usageByProvider?: Partial<Record<AIProvider, TokenUsage>>;
  _intermediateData?: {
    resumeData: any;
    jdKeywords: string[];
  };
  _engine?: string;
  _model?: string;
  /** Every model that answered during this run, in the order first used. */
  _models?: string[];
}

export interface DeepResearchResult {
  status: string;
  output: string;
  progress: number;
}

export type EngineType = 'gemini' | 'openai';

export interface EngineConfig {
  engine: EngineType;
  model: string;
  apiKey?: string; // This will now hold the encrypted API key
}

function extractJson(text: string): string {
  if (!text) return "";
  
  // Try to find JSON block in markdown
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  let extracted = text;
  if (jsonMatch && jsonMatch[1]) {
    extracted = jsonMatch[1].trim();
  } else {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    if (firstBrace !== -1 && firstBracket !== -1) {
      if (firstBrace < firstBracket) {
        extracted = text.substring(firstBrace).trim();
      } else {
        extracted = text.substring(firstBracket).trim();
      }
    } else if (firstBrace !== -1) {
      extracted = text.substring(firstBrace).trim();
    } else if (firstBracket !== -1) {
      extracted = text.substring(firstBracket).trim();
    } else {
      extracted = text.trim();
    }
  }

  try {
    return jsonrepair(extracted);
  } catch (e) {
    console.error("Failed to repair JSON:", e);
    return extracted;
  }
}

export async function getDecryptedKey(encryptedKey: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  let keyToDecrypt = encryptedKey;

  if (!keyToDecrypt) return '';
  if (!keyToDecrypt.includes(':')) return keyToDecrypt;

  try {
    const response = await fetch('/api/decrypt-keys', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ encryptedKey: keyToDecrypt })
    });
    if (response.ok) {
      const data = await response.json();
      return data.keys?.gemini || data.keys?.openai || '';
    }
  } catch (e) {
    console.warn("Failed to decrypt key:", e);
  }
  return process.env.GEMINI_API_KEY || '';
}

/** What one AI call returns: the text, its token usage, and the model that answered. */
interface AICallResult {
  result: string;
  usage: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
  model: string;
}

function tokenUsage(usage: any): AICallResult["usage"] {
  return {
    promptTokenCount: usage?.promptTokenCount || 0,
    candidatesTokenCount: usage?.candidatesTokenCount || 0,
    totalTokenCount: usage?.totalTokenCount || 0,
  };
}

/** Options for one AI call. */
interface AICallOptions {
  /** Gemini thinking for this call instead of the catalog's setting (the admin's model test). */
  thinking?: ThinkingLevel;
  /** Rejects an unusable answer, which then counts as that model failing so the fallback is tried. */
  validate?: (text: string) => boolean;
}

/**
 * One AI call, strictly on the admins' models: the given model (the provider's
 * primary unless the caller chose otherwise), then that provider's fallback when
 * one is set - and then a ModelChainError naming both. Never a model nobody
 * configured, and never the other provider. Pass a list to run exactly that chain
 * (fast mode, the admin's model test).
 */
async function callAI(
  prompt: string,
  models: string | string[],
  engine: EngineType,
  encryptedKey?: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const chain = Array.isArray(models)
    ? models.filter(Boolean)
    : Array.from(new Set([models, getModelCatalog().providers[engine]?.fallback].filter((id): id is string => Boolean(id))));
  const wantsJson = prompt.toLowerCase().includes('json');
  // An empty or rejected answer is a failed call: the fallback gets its turn.
  const accept = (text: string) => {
    if (!text.trim()) throw new Error("the model returned an empty answer");
    let usable = false;
    try {
      usable = !options.validate || options.validate(text);
    } catch {
      usable = false;
    }
    if (!usable) throw new Error("the answer was not in the expected format");
  };

  if (engine === 'openai') {
    if (!encryptedKey) {
      throw new Error("OpenAI API Key is missing. Please save your profile first.");
    }
    const idToken = await auth.currentUser?.getIdToken();
    const { value, model } = await runModelChain('openai', chain, async (candidate) => {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ prompt, model: candidate, encryptedKey })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `OpenAI request failed (${response.status})`);
      accept(String(data?.result || ""));
      return data;
    });
    return { result: value?.result || "", usage: tokenUsage(value?.usage), model };
  }

  // Gemini is called from the browser, with the user's own key.
  const apiKey = await getDecryptedKey(encryptedKey || "");
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please provide your own key in settings or contact the administrator.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const { value, model } = await runModelChain('gemini', chain, async (candidate) => {
    const response = await ai.models.generateContent({
      model: candidate,
      contents: prompt,
      config: {
        responseMimeType: wantsJson ? "application/json" : "text/plain",
        ...(options.thinking ? geminiThinkingLevelConfig(options.thinking) : geminiThinkingConfig(candidate)),
      },
    });
    accept(response.text || "");
    return response;
  });
  return { result: value.text || "", usage: tokenUsage(value.usageMetadata), model };
}

/**
 * Tests one exact model with a tiny prompt and no fallback, for the admin
 * screen, with the thinking level the form shows. Resolves with the reply time
 * in milliseconds; rejects with the provider's error.
 */
export async function testModelConnection(provider: EngineType, model: string, config: RouterConfig, thinking?: ThinkingLevel): Promise<number> {
  const apiKey = provider === 'openai' ? config.openaiConfig.apiKey : config.geminiConfig.apiKey;
  const started = Date.now();
  await callAI('Reply with the single word OK.', [model], provider, apiKey, provider === 'gemini' ? { thinking } : {});
  return Date.now() - started;
}


export async function scanResumeImage(imageData: string, mimeType: string): Promise<any> {
  const idToken = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/gemini/scan-resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mimeType, idToken, modelCatalog: getModelCatalog() })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Vision Scan Failed");
  return data;
}

export async function startDeepResearch(resume: any, jd: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/deep-research/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume, jd, idToken })
  });
  if (!response.ok) throw new Error("Deep Research Initiation Failed");
  const data = await response.json();
  return data.interactionId;
}

export async function getDeepResearchStatus(id: string): Promise<DeepResearchResult> {
  const idToken = await auth.currentUser?.getIdToken();
  const response = await fetch(`/api/deep-research/status/${id}?idToken=${idToken}`);
  if (!response.ok) throw new Error("Deep Research Status Check Failed");
  return await response.json();
}

export async function getAudioFeedback(text: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/resume-feedback-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, idToken, modelCatalog: getModelCatalog() })
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    throw new Error(failure?.error || "Audio Generation Failed");
  }
  const data = await response.json();
  return data.audioData;
}

export async function fetchJobDescription(url: string, config: RouterConfig): Promise<string> {
  const routedConfig = routeTask('extract_job_description', config);
  const prompt = `
You are an expert recruiter and data extractor.
Please read the following job posting URL and extract the full job description text.
Include the job title, company name, responsibilities, requirements, and any other relevant details.
Format the output as clean, readable text. Do not include any JSON formatting or extra conversational text.

JOB URL: ${url}
`;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return data.result || "";
  } catch (error) {
    console.error("Error fetching job description:", error);
    throw error;
  }
}

export async function evaluateSuitability(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig,
  fastMode: boolean = false
): Promise<SuitabilityResult> {
  const routedConfig = routeTask('evaluate_suitability', config);
  const modelsToUse = fastMode ? providerChain(routedConfig.engine, { fast: true }) : routedConfig.model;

  const prompt = `
You are an expert technical recruiter screening a candidate's resume against a job description.
The current date is ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
Your goal is to quickly evaluate if the candidate is a good fit, a stretch, or not recommended.
Additionally, perform a focus Audit identifying flaws in wording, metrics, and alignment.

CRITICAL INSTRUCTIONS FOR AUDIT:
1. Impact: Audit every bullet point. Do they convey clear impact? If not, flag it.
2. Metrics: Achievements should ideally have a metric (%, $, time, scale) or clear outcome. Flag any achievements that are vague.
3. Action Verbs: Ensure bullets start with strong action verbs. Flag passive language like "Participated in" or "Helped with".
4. Dates: A "Present" or "Current" end date in experience is perfectly valid. Do not flag current roles as having date errors.
5. Scoring: The matchScore represents alignment with the JD. The readinessScore represents overall resume professionality and polish.
6. Critique: Be specific. Point out exactly which bullets lack impact or are too wordy.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY a JSON object with the following structure:
{
  "verdict": "Strong Match" | "Stretch Role" | "Not Recommended",
  "matchScore": number (0-100),
  "dealbreakers": string[] (list of major missing requirements, empty if none),
  "strengths": string[] (list of key matching qualifications),
  "reasoning": string (1-2 sentences explaining the verdict),
  "readinessScore": number (0-100 overall professional readiness / resume quality),
  "critique": [
    {
      "category": "e.g., Metrics/Impact",
      "feedback": "Detailed constructive criticism",
      "severity": "low" | "medium" | "high"
    }
  ]
}
`;

  try {
    const data = await callAI(prompt, modelsToUse, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    if (!resultText) throw new Error("No response from AI");
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error evaluating suitability:", error);
    throw error;
  }
}

/**
 * Restores any work experience the model dropped.
 *
 * The prompt tells the model to keep every role, but an LLM under a strict
 * page budget will still quietly delete the oldest, shortest entries - which
 * reads on the finished resume as an unexplained employment gap. Prompt text
 * alone cannot guarantee this, so we reconcile the model's output against the
 * source resume in code and re-insert anything missing.
 *
 * Re-inserted roles are capped at a single bullet: the user's stated preference
 * is that losing a bullet point is acceptable, losing a job is not.
 */
const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Sort key for reverse-chronological ordering, derived from the start date. */
function roleStartKey(duration: string): number {
  const match = String(duration || '').match(/([A-Za-z]{3,9})?\s*(\d{4})/);
  if (!match) return -1;
  const year = parseInt(match[2], 10);
  const month = match[1] ? (MONTH_INDEX[match[1].slice(0, 3).toLowerCase()] || 1) : 1;
  return year * 100 + month;
}

/** Company names are compared loosely - the model often rewords legal suffixes. */
function normalizeCompany(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|llc|inc|incorporated|co|corp|corporation|technologies|tech|india|global)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

function sameCompany(a: string, b: string): boolean {
  const x = normalizeCompany(a);
  const y = normalizeCompany(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function reconcileExperience(resumeText: string, aiExperience: any): any[] {
  const output = Array.isArray(aiExperience) ? [...aiExperience] : [];

  // The master resume is normally passed as JSON. If it is free-form text we
  // have no reliable role list to compare against, so leave the output alone.
  let source: any;
  try {
    source = JSON.parse(resumeText);
  } catch {
    return output;
  }

  const sourceRoles = source?.experience || source?.work_experience;
  if (!Array.isArray(sourceRoles) || sourceRoles.length === 0) return output;

  let restored = 0;
  for (const role of sourceRoles) {
    const company = role?.company;
    const title = role?.role || role?.title;
    if (!company && !title) continue;

    const present = output.some((entry: any) =>
      (company && sameCompany(entry?.company, company)) ||
      (!company && title && String(entry?.role || '').toLowerCase() === String(title).toLowerCase())
    );
    if (present) continue;

    const sourceBullets = role?.bullets || role?.achievements || [];
    output.push({
      role: title || '',
      company: company || '',
      duration: role?.duration || '',
      // Single bullet only - these are recovered under a tight page budget.
      bullets: Array.isArray(sourceBullets) && sourceBullets.length > 0
        ? [sourceBullets[0]]
        : [],
    });
    restored++;
    console.warn(`[resume] Model omitted "${title || ''} @ ${company || ''}" - restored from source resume.`);
  }

  if (restored === 0) return output;

  // Restored roles were appended, so re-establish reverse-chronological order -
  // but only when every duration parses, to avoid scrambling a valid ordering.
  const keys = output.map((entry: any) => roleStartKey(entry?.duration));
  if (keys.every(key => key > 0)) {
    output.sort((a: any, b: any) => roleStartKey(b?.duration) - roleStartKey(a?.duration));
  }

  return output;
}

/**
 * The candidate's own material, against which every generated figure is traced.
 * Must match finalizeResumeResult in server.ts so both sides reach the same audit.
 */
function candidateSourceText(resumeText: string, brainDump?: string, customPrompt?: string): string {
  return [resumeText, brainDump, customPrompt]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join("\n\n");
}

/** Budget plan for a JSON master resume; undefined for free-form text. */
function budgetPlanFromResumeText(
  resumeText: string,
  options: { rules: BulletRules | null; jobDescription: string }
): BudgetPlan | undefined {
  const roles = rolesFromResumeText(resumeText);
  return roles ? planBulletBudgets(roles, options) : undefined;
}

/**
 * Deterministic post-processing on the FINAL document, in the same order as the
 * server: bullet budgets first, so the scores and the audit describe what the
 * candidate actually receives. Every step is idempotent, so re-running it on a
 * server result that was already processed is safe.
 */
function finalizeResume(
  parsed: any,
  params: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
    jdKeywords?: string[];
    brainDump?: string;
    customPrompt?: string;
    audienceMix?: AudienceMix | null;
    /**
     * Active bullet rules, or null for the tenure tiers alone. A server report made
     * under the same rules is reused as is, so both sides agree.
     */
    bulletRules: BulletRules | null;
    /**
     * Curated LinkedIn trends when the candidate follows them. A server report is
     * reused as prior evidence (it saw the candidate's other resumes too).
     */
    trends?: LinkedInTrends | null;
    /**
     * The requirement evidence map made for this run, or null when none was made.
     * Omitted to rebuild the report a server result already carries.
     */
    requirementAnalysis?: RequirementAnalysis | null;
    /** What each step read; omitted to keep the report a server result carries. */
    inputCoverage?: InputCoverageReport;
  }
): void {
  const sourceText = candidateSourceText(params.resumeText, params.brainDump, params.customPrompt);
  const trends = params.trends || null;
  // The candidate's material only, as on the server: the custom prompt is instructions, not
  // evidence, and the notes stay a separate source so a JSON resume counts by its values only.
  const trendExtra = [params.brainDump];
  // First, as on the server - and it also covers roles reconcileExperience restored from the source.
  applyExclusionGuarantee(parsed);
  enforceBulletBudgets(parsed, {
    sourceText,
    rules: params.bulletRules,
    jobDescription: params.jobDescription,
    sourceRoles: rolesFromResumeText(params.resumeText),
    ...(trends ? { preferTerms: trendPreferTerms(trends, trendEvidenceText(params.resumeText, ...trendExtra)) } : {}),
  });
  if (trends) applyTrendCoverage(parsed, trends, { sourceText: params.resumeText, extraEvidence: trendExtra });
  applyMatchScores(parsed, {
    jobDescription: params.jobDescription,
    originalResumeText: params.resumeText,
    targetRole: params.targetRole,
    jdKeywords: params.jdKeywords,
  });
  applyRequirementEvidence(parsed, params.requirementAnalysis);
  applyImpactAudit(parsed, { sourceText });
  // Budgets and trend coverage may have removed flagged items: list only what is delivered.
  refreshVerificationReport(parsed);
  if (params.inputCoverage) parsed.input_coverage = params.inputCoverage;
  // Baseline is the resume alone: what each reader would have seen before optimization.
  applyAudienceCoverage(parsed, params.audienceMix, { sourceText: params.resumeText });
}

/** The posting as the requirement analysis reads it; the browser writer always gets the whole posting. */
const ANALYSIS_JD_LIMIT = 30000;

type TokenUsage = { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };

function addUsage(total: TokenUsage, usage: Partial<TokenUsage> | null | undefined): void {
  total.promptTokenCount += usage?.promptTokenCount || 0;
  total.candidatesTokenCount += usage?.candidatesTokenCount || 0;
  total.totalTokenCount += usage?.totalTokenCount || 0;
}

/** Only the providers that used tokens, as whole numbers. */
function usedProviders(usage: Partial<Record<AIProvider, Partial<TokenUsage> | null | undefined>>): Partial<Record<AIProvider, TokenUsage>> {
  const used: Partial<Record<AIProvider, TokenUsage>> = {};
  for (const provider of ['gemini', 'openai'] as const) {
    const total: TokenUsage = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    addUsage(total, usage[provider]);
    if (total.promptTokenCount || total.candidatesTokenCount || total.totalTokenCount) used[provider] = total;
  }
  return used;
}

/** The provider's API key from the router config. */
function providerKey(config: RouterConfig, provider: AIProvider): string | undefined {
  return provider === 'openai' ? config.openaiConfig.apiKey : config.geminiConfig.apiKey;
}

/** An error that means "stop the run": every configured model failed. Never retried on another path. */
function modelRunStopped(message: string): Error {
  const error = new Error(message || "The AI models failed and the run stopped.");
  error.name = "ModelChainError";
  return error;
}

export interface OptimizeResumeOptions {
  /** The candidate's bullet rules; omitted, null or disabled for the tenure tiers alone. */
  bulletRules?: BulletRules | null;
  /** Follow the curated LinkedIn trends for the target role. Anything but `true` leaves them off. */
  linkedinTrends?: boolean;
}

export async function optimizeResume(
  resumeText: string,
  jobDescription: string,
  targetRole: string,
  mode: "conservative" | "balanced" | "aggressive" | "Player-Coach" | "automatic",
  audience: string,
  config: RouterConfig,
  linkedInUrl?: string,
  linkedInPdfText?: string,
  jobUrl?: string,
  fastMode: boolean = false,
  recruiterSimulationMode: boolean = false,
  customPrompt?: string,
  pipelineType?: string,
  targetCompany?: string,
  brainDump?: string,
  audienceMix?: AudienceMix | null,
  options: OptimizeResumeOptions = {}
): Promise<OptimizationResult> {
  const routedConfig = routeTask(recruiterSimulationMode ? 'recruiter_simulation' : 'rewrite_resume', config);
  const engineMode: EngineMode = isEngineMode(config.mode) ? config.mode : 'hybrid-gemini';
  const bulletRules = activeBulletRules(options.bulletRules);
  // From the same inputs the server uses, so both sides follow the same trend list.
  const trends = activeLinkedInTrends(options.linkedinTrends, targetRole, jobDescription);

  // All selected readers are written for in this ONE run, as a weighted brief.
  const blend = normalizeAudienceMix(audienceMix);
  const audienceText = blend ? audienceHeadline(blend) : audience;
  
  // The writer runs on its provider's primary, then fallback. Fast mode starts on
  // the fallback (normally the quicker model) and keeps the primary behind it.
  const engineToUse = routedConfig.engine;
  const writerModels = providerChain(engineToUse, { fast: fastMode });

  const isLeadershipRole = /director|manager|lead|head|executive|vp|chief|principal|senior manager/i.test(targetRole);

  // V2 PIPELINE INTEGRATION: Use the optimized backend pipeline for production mode
  if ((config.mode === 'production' || pipelineType) && !recruiterSimulationMode && !fastMode) {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/v2/optimize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          targetRole,
          mode,
          audience: audienceText,
          audienceMix: blend,
          customPrompt,
          apiKey: config.openaiConfig.apiKey,
          // Sent separately: the server tells each key apart by its form.
          geminiApiKey: config.geminiConfig.apiKey,
          pipelineType,
          targetCompany,
          brainDump,
          // The admins' models. The server uses them only with the user's own key.
          modelCatalog: getModelCatalog(),
          ...(bulletRules ? { bulletRules } : {}),
          ...(trends ? { linkedinTrends: true } : {})
        })
      });

      if (response.ok) {
        const data = await response.json();
        const resultText = extractJson(data.result || "");
        const parsed = JSON.parse(resultText);
        
        // Post-processing
        parsed._engine = 'hybrid-v2';
        if (data.usage) parsed._usage = data.usage;
        if (data.geminiUsage) parsed._geminiUsage = data.geminiUsage;
        // The server reports OpenAI tokens as `usage` and Gemini tokens as `geminiUsage`.
        parsed._usageByProvider = usedProviders({ openai: data.usage, gemini: data.geminiUsage });
        if (data.intermediateData) parsed._intermediateData = data.intermediateData;
        parsed._models = Array.isArray(data.modelsUsed) ? data.modelsUsed.map((model: unknown) => String(model)) : [];
        
        // Apply UI formatting
        // Skills must be grouped into categories.
        let parsedSkills = parsed.skills || {};
        let formattedSkills: Record<string, string[]> = {};

        if (Array.isArray(parsedSkills)) {
          // Flatten array of objects if needed
          const flatSkills = parsedSkills.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean);
          formattedSkills = categorizeSkills(flatSkills);
        } else {
          // Use all categories provided by AI
          const skillCategories = Object.keys(parsedSkills);
          skillCategories.forEach(cat => {
            formattedSkills[cat] = parsedSkills[cat];
          });
        }
        
        const defaultCats = isLeadershipRole 
          ? ["Strategic Leadership", "Management", "Operations", "Technical Proficiency"]
          : ["Core Technical", "Tools & Frameworks", "Process & Methodology", "Soft Skills"];
        
        // Ensure at least 4 categories exist if it's not a categorized object with enough keys
        while (Object.keys(formattedSkills).length < 4) {
          const nextCat = defaultCats.find(c => !formattedSkills[c]);
          if (nextCat) formattedSkills[nextCat] = [];
          else formattedSkills[`Category ${Object.keys(formattedSkills).length + 1}`] = [];
        }
        parsed.skills = formattedSkills;

        // Guarantee no role was silently dropped to satisfy the page budget.
        // The V2 pipeline returns here, well before the legacy path's identical
        // reconcile call, so without this the "never drop a job" safeguard would
        // protect only the Gemini/OpenAI engines and silently miss every Hybrid run.
        parsed.experience = reconcileExperience(resumeText, parsed.experience);

        // Apply title fix to V2 results as well
        const fixTitle = (obj: any): any => {
          if (typeof obj === 'string') {
            return obj.replace(/Office IT [Cc]um Logistics/g, 'Officer IT cum Logistics');
          }
          if (Array.isArray(obj)) {
            return obj.map(fixTitle);
          }
          if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
              newObj[key] = fixTitle(obj[key]);
            }
            return newObj;
          }
          return obj;
        };

        // Recompute against the FINAL document. The server already did this, but
        // reconcileExperience above can restore roles the model dropped, and a
        // cached server response may predate it. Every step is deterministic
        // and idempotent, so recomputing is safe.
        finalizeResume(parsed, {
          resumeText,
          jobDescription,
          targetRole,
          jdKeywords: parsed._intermediateData?.jdKeywords,
          brainDump,
          customPrompt,
          audienceMix: blend,
          bulletRules,
          trends,
        });

        return fixTitle(parsed);
      }

      const failure = await response.json().catch(() => null);
      // Every configured model failed: stop, rather than run again on another path.
      if (failure?.code === 'MODEL_FAILED') throw modelRunStopped(failure.error);
      console.warn(`V2 Pipeline returned ${response.status}${failure?.error ? `: ${failure.error}` : ''}. Falling back to legacy optimization.`);
    } catch (e) {
      if (isModelChainError(e)) throw e;
      console.warn("V2 Pipeline failed, falling back to legacy optimization:", e);
    }
  }

  // Computed from the real dates when the master resume is structured; for
  // free-form text the prompt states the rules and tiers for the model to apply.
  const budgetPlan = budgetPlanFromResumeText(resumeText, { rules: bulletRules, jobDescription });

  // Evidence first (skipped in fast mode): before writing, decide requirement by
  // requirement what the candidate's own material proves, with every quote verified.
  // Reading and review run on the analysis provider, corrections on the writer's.
  const evidenceSteps = !fastMode;
  const analysisProvider = providerFor(engineMode, 'analysis');
  const usageByProvider: Record<AIProvider, TokenUsage> = {
    gemini: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
    openai: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 },
  };
  // Every model that answered in this run, in the order first used, for the header.
  const modelsUsed: string[] = [];
  const noteModel = (model: string) => {
    if (model && !modelsUsed.includes(model)) modelsUsed.push(model);
  };
  const evidenceCall = async (evidencePrompt: string, provider: AIProvider, validate?: (json: string) => boolean): Promise<string> => {
    const data = await callAI(evidencePrompt, providerChain(provider), provider, providerKey(config, provider), {
      ...(validate ? { validate: (text: string) => validate(extractJson(text)) } : {}),
    });
    addUsage(usageByProvider[provider], data?.usage);
    noteModel(data.model);
    return extractJson(data?.result || "");
  };
  const material = buildCandidateMaterial(resumeText, brainDump);
  const analysisPosting = focusJobDescription(jobDescription, ANALYSIS_JD_LIMIT);
  let requirementAnalysis: RequirementAnalysis | null = null;
  if (evidenceSteps) {
    try {
      // An answer with no usable analysis counts as a failed call, so the fallback is tried.
      const raw = await evidenceCall(
        buildRequirementAnalysisPrompt({ jobDescription: analysisPosting.text, targetRole, material }),
        analysisProvider,
        (json) => parseRequirementAnalysis(json, material, { jobDescription }) !== null
      );
      requirementAnalysis = parseRequirementAnalysis(raw, material, { jobDescription });
      if (!requirementAnalysis) console.warn("[Evidence] No usable requirement analysis; writing without the evidence map.");
    } catch (e) {
      console.warn("[Evidence] Requirement analysis failed; writing without the evidence map:", e);
    }
  }
  const jdKeywords = analysisKeywords(requirementAnalysis);
  const inputCoverage = buildInputCoverage({
    resumeChars: resumeText.length,
    resumeMethod: 'full_text',
    materialOmittedChars: requirementAnalysis ? material.omitted_chars : 0,
    analysisPosting: requirementAnalysis ? analysisPosting : null,
    generationPosting: wholePosting(jobDescription),
  });

  const prompt = buildResumeGenerationPrompt({
    targetRole,
    audience: audienceText,
    audienceBrief: buildAudienceBrief(blend, "document"),
    mode,
    targetCompany,
    customPrompt,
    brainDump,
    recruiterSimulationMode,
    jobDescription,
    inputLabel: "SOURCE RESUME (raw text)",
    inputData: resumeText,
    bulletBudgets: budgetPlan?.budgets,
    bulletRules,
    platformDecision: budgetPlan?.platform ?? null,
    // Only trending names the candidate's own material supports; the custom prompt is not evidence.
    trendBrief: trends ? buildTrendBrief(trends, { scope: "document", evidenceText: trendEvidenceText(resumeText, brainDump) }) : undefined,
    jdKeywords: withoutExcludedTerms(jdKeywords),
    requirementAnalysis,
  });

  const maxRetries = 5;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      // A malformed document counts as a failed call, so the fallback is tried before any retry.
      const data = await callAI(prompt, writerModels, engineToUse, providerKey(config, engineToUse), {
        validate: (text) => {
          const json = extractJson(text);
          return json.length >= 100 && Boolean(JSON.parse(json));
        },
      });
      noteModel(data.model);
      const rawResult = data.result || "";
      const resultText = extractJson(rawResult);

      if (!resultText || resultText.length < 100) {
        throw new Error(`Empty or malformed response from ${engineToUse}. (Length: ${resultText.length})`);
      }

      try {
        const parsed = JSON.parse(resultText);

        // Skills must be grouped into categories.
        let parsedSkills = parsed.skills || {};
        let formattedSkills: Record<string, string[]> = {};
        
        if (Array.isArray(parsedSkills)) {
          const flatSkills = parsedSkills.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean);
          formattedSkills = categorizeSkills(flatSkills);
        } else {
          // Use all categories provided by the AI
          const skillCategories = Object.keys(parsedSkills);
          skillCategories.forEach(cat => {
            formattedSkills[cat] = parsedSkills[cat];
          });
        }

        // Fill in missing categories if less than 4
        const defaultCats = isLeadershipRole 
          ? ["Strategic Leadership", "Management", "Operations", "Technical Proficiency"]
          : ["Core Technical", "Tools & Frameworks", "Process & Methodology", "Soft Skills"];
          
        while (Object.keys(formattedSkills).length < 4) {
          const nextCat = defaultCats.find(c => !formattedSkills[c]);
          if (nextCat) formattedSkills[nextCat] = [];
          else formattedSkills[`Category ${Object.keys(formattedSkills).length + 1}`] = [];
        }

        parsed.skills = formattedSkills;
        parsed._engine = engineToUse;

        // Guarantee no role was silently dropped to satisfy the page budget.
        parsed.experience = reconcileExperience(resumeText, parsed.experience);

        // Check the draft against the candidate's material and the evidence map, and
        // correct only what fails. Never throws; in fast mode only the checks in code run.
        parsed.draft_verification = await reviewAndCorrectDraft(
          parsed,
          {
            figureSourceText: candidateSourceText(resumeText, brainDump, customPrompt),
            evidenceText: candidateSourceText(resumeText, brainDump),
            material,
            analysis: requirementAnalysis,
            jobDescription,
            targetRole,
            jdKeywords,
          },
          evidenceSteps
            ? (reviewPrompt, purpose) =>
                evidenceCall(reviewPrompt, purpose === 'review' ? analysisProvider : engineToUse)
            : null
        );

        // Budgets, scores and the audit are computed from the finished document,
        // never taken from the model. Asking an LLM to score against a schema
        // example just returns the example, which is why every resume used to
        // report the same number.
        // The same goes for the trend report: one in the model's output is not ours.
        if (trends) delete parsed.linkedin_trends;
        finalizeResume(parsed, {
          resumeText,
          jobDescription,
          targetRole,
          jdKeywords,
          brainDump,
          customPrompt,
          audienceMix: blend,
          bulletRules,
          trends,
          requirementAnalysis,
          inputCoverage,
        });

        // The writer's usage plus every evidence step, kept per provider: under
        // Hybrid OpenAI the analysis and review ran on Gemini, the writing on OpenAI.
        addUsage(usageByProvider[engineToUse], data.usage);
        parsed._usage = usageByProvider[engineToUse];
        parsed._usageByProvider = usedProviders(usageByProvider);
        parsed._models = [...modelsUsed];

        // FAIL-SAFE: Ensure "Officer IT cum Logistics" is preserved and not changed to "Office IT cum Logistics"
        const fixTitle = (obj: any): any => {
          if (typeof obj === 'string') {
            // Case insensitive match but replace with exact casing
            return obj.replace(/Office IT [Cc]um Logistics/g, 'Officer IT cum Logistics');
          }
          if (Array.isArray(obj)) {
            return obj.map(fixTitle);
          }
          if (obj !== null && typeof obj === 'object') {
            const newObj: any = {};
            for (const key in obj) {
              newObj[key] = fixTitle(obj[key]);
            }
            return newObj;
          }
          return obj;
        };

        return fixTitle(parsed);
      } catch (e) {
        console.error(`Error parsing ${engineToUse} response:`, e, "Raw text:", resultText);
        throw new Error(`JSON_PARSING_ERROR: The ${engineToUse} engine returned an invalid response format.`);
      }
    } catch (error: any) {
      const errorString = String(error?.message || error).toLowerCase();
      const isRateLimit = errorString.includes("429") || 
                         errorString.includes("resource_exhausted") ||
                         errorString.includes("quota") ||
                         errorString.includes("exhausted") ||
                         errorString.includes("limit") ||
                         errorString.includes("rate limit");
      const isJsonError = errorString.includes("json_parsing_error") || 
                          errorString.includes("empty or malformed") ||
                          errorString.includes("no response") ||
                          errorString.includes("invalid response format") ||
                          errorString.includes("not in the expected format") ||
                          errorString.includes("empty answer");
      
      if ((isRateLimit || isJsonError) && retryCount < maxRetries) {
        retryCount++;

        // The same models again after a pause: a transient failure is retried, never
        // swapped for a model the admins did not choose.
        // Capped: uncapped doubling waited 4+8+16+32+64s (about two minutes) on a rate limit.
        const delay = Math.min(Math.pow(2, retryCount) * 2000, 8000) + Math.random() * 1000;
        const retryMsg = isRateLimit 
          ? `AI API quota exceeded. Retrying with exponential backoff (${retryCount}/${maxRetries})...`
          : `Invalid AI response format. Retrying (${retryCount}/${maxRetries})...`;
          
        console.warn(`${retryMsg} (Delay: ${Math.round(delay)}ms)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw new Error(`Maximum retries exceeded for ${engineToUse}. Please try again in a few minutes.`);
}

export async function analyzeSkillGap(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig
): Promise<{ missing: string[], present: string[] }> {
  const routedConfig = routeTask('extract_skills', config);
  const prompt = `
      Analyze the following resume and job description.
      Identify the skills present in the resume and the skills required by the job description that are missing from the resume.
      Return the result as a JSON object: { "missing": string[], "present": string[] }
      
      RESUME: ${resumeText}
      JOB DESCRIPTION: ${jobDescription}
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"missing":[], "present":[]}');
  } catch (error) {
    console.error("Error analyzing skill gap:", error);
    throw error;
  }
}

export async function analyzeResumeCritique(
  resumeText: string,
  jobDescription: string,
  config: RouterConfig
): Promise<{ score: number, critique: { category: string, feedback: string, severity: 'low' | 'medium' | 'high' }[] }> {
  const routedConfig = routeTask('extract_skills', config);
  const prompt = `
      You are an expert career counselor. Audit this resume against the Job Description.
      Be constructive and thorough. Find areas for improvement in wording, impact, and alignment.
      
      STRICT AUDIT CRITERIA:
      1. IMPACT: Do achievements clearly convey the result of the actions taken?
      2. OUTCOMES: Does the resume highlight measurable outcomes or positive changes?
      3. ACTION VERBS: Are the verbs strong and professional?
      
      Return a JSON object:
      {
        "score": number (0-100 overall professional readiness),
        "critique": [
          {
            "category": "e.g., Metrics/Impact",
            "feedback": "Detailed constructive criticism",
            "severity": "low" | "medium" | "high"
          }
        ]
      }

      RESUME: ${resumeText}
      JOB DESCRIPTION: ${jobDescription}
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"score":0, "critique":[]}');
  } catch (error) {
    console.error("Error analyzing resume critique:", error);
    throw error;
  }
}

export async function extractSkillsFromJD(
  jdText: string,
  resumeText: string,
  config: RouterConfig
): Promise<{ missing: string[], matching: string[], priority: string[] }> {
  const routedConfig = routeTask('extract_skills', config);
  const prompt = `
    ROLE: Expert Technical Recruiter & Keyword Strategist.
    TASK: Analyze the provided Job Description (JD) and Resume.
    
    1. EXTRACT mandatory technical skills, tools, and domain keywords from the JD.
    2. COMPARE these against the provided Resume.
    3. CATEGORIZE result into three arrays:
       - matching: Skills present in both JD and Resume.
       - missing: Important skills from JD not clearly present in Resume.
       - priority: The top 10-15 keywords user MUST have in their profile for this specific JD to pass ATS and filter searches.
    
    RESUME:
    ${resumeText}
    
    JOB DESCRIPTION:
    ${jdText}
    
    Return strictly JSON:
    {
      "matching": ["skill1", "skill2"],
      "missing": ["skill3", "skill4"],
      "priority": ["key1", "key2"]
    }
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"matching":[], "missing":[], "priority":[]}');
  } catch (error) {
    console.error('Skill extraction AI error:', error);
    return { matching: [], missing: [], priority: [] };
  }
}

export async function performSkillAssessment(
  resumeText: string,
  config: RouterConfig
): Promise<{ extractedSkills: string[], faangSuggestions: string[] }> {
  const routedConfig = routeTask('extract_skills', config);
  const prompt = `
    ROLE: Expert Career Coach & FAANG Recruiter.
    TASK: Analyze the user's resume and perform a skills assessment.

    1. EXTRACT all clear technical skills, tools, and expertise from the resume.
    2. SUGGEST additional high-demand FAANG-level skills (e.g., advanced system design, specific ML frameworks like PyTorch/TensorFlow, cloud native tech like Kubernetes/Service Mesh, language-specific advanced frameworks like Go/Rust/TypeScript advanced patterns) that the user might already possess based on their experience or should consider adding to stay competitive.

    RESUME:
    ${resumeText}

    Return strictly JSON:
    {
      "extractedSkills": ["skill1", "skill2"],
      "faangSuggestions": ["suggestion1", "suggestion2"]
    }
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"extractedSkills":[], "faangSuggestions":[]}');
  } catch (error) {
    console.error('Skill assessment AI error:', error);
    return { extractedSkills: [], faangSuggestions: [] };
  }
}


/**
 * Auto-Select: the 1-3 readers who will decide this application, weighted and
 * with a reason each, blended into one resume downstream. Falls back to a
 * deterministic keyword match when the model is unavailable or returns nothing
 * usable, so it always returns at least one reader.
 */
const AUDIENCE_SELECT_TIMEOUT_MS = 15000;

export async function analyzeAudienceMix(
  jobDescription: string,
  targetRole: string,
  config: RouterConfig,
  fastMode: boolean = false
): Promise<AudienceMix> {
  const routedConfig = routeTask('multi_audience', config);
  // Picking readers is a small classification: the quick chain is enough, and it
  // must never leave the button spinning behind a slow or rate-limited model.
  const modelsToUse = providerChain(routedConfig.engine, { fast: true });
  void fastMode;

  const catalog = AUDIENCE_PROFILES
    .map((profile) => `- ${profile.id}: ${profile.label} - ${profile.reader}`)
    .join('\n');

  const prompt = `
    Choose the readers whose judgment will decide this application, from the job description and target role below.
    One resume will be written for the blend you choose.

    READERS (use these ids):
    ${catalog}

    RULES:
    - Return 1 to 3 readers. The first, with the highest weight, is the PRIMARY reader: the person who most shapes the hiring decision for this posting. Add a secondary reader only when the posting clearly asks for that perspective too.
    - Weights are integers that sum to 100.
    - Match the real seniority of the role. Do NOT choose manager, director, head, VP or CTO readers when the posting is for an individual contributor (engineer, senior engineer, architect); prefer cloud-architect, solution-architect or principal-architect for those.
    - Choose "microsoft" only when the posting centres on Azure or the Microsoft stack.
    - "reason": at most 20 words, citing what in the posting points at this reader.
    - Use {"id": "custom", "label": "<reader title>"} only when none of the ids fit at all.

    Return ONLY JSON, for example:
    {"audiences": [{"id": "cloud-architect", "weight": 70, "reason": "Posting centres on landing zones and reference architectures"}, {"id": "microsoft", "weight": 30, "reason": "Azure-only estate with Entra ID and Intune"}]}

    JOB DESCRIPTION: ${String(jobDescription || '').slice(0, 8000)}
    TARGET ROLE: ${targetRole}
  `;

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const data = await Promise.race([
      callAI(prompt, modelsToUse, routedConfig.engine, routedConfig.apiKey),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Auto-audience selection timed out")), AUDIENCE_SELECT_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(timer));
    const resultText = extractJson(data.result || "");
    const mix = normalizeAudienceMix(JSON.parse(resultText || 'null'), 'ai');
    if (mix) return mix;
    console.warn("Auto-audience selection returned no usable readers. Using keyword-based fallback.");
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuotaError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit") || errorMsg.includes("exhausted");
    if (isQuotaError) {
      console.warn("Auto-audience selection skipped: AI API quota exceeded. Using keyword-based fallback.");
    } else {
      console.error("Error analyzing best audiences:", errorMsg);
    }
  }
  return keywordAudienceMix(jobDescription, targetRole);
}




export async function generateLinkedInTopChoiceMessage(
  jobDescription: string,
  resumeText: string,
  targetRole: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('linkedin_top_choice', config);
  const prompt = `
      You are an expert career strategist and LinkedIn profile optimizer. 
      LinkedIn allows users to add a "Top Choice" message (up to 300 characters) when applying via Easy Apply to stand out to recruiters.
      
      TASK: Write a compelling, punchy "Top Choice" message that:
      1. Expresses genuine enthusiasm for this specific role and company.
      2. Briefly mentions the candidate's strongest matching qualification (from the resume) for this job (from the JD).
      3. Explains why this specific company aligns with their career goals.
      
      CONSTRAINTS:
      - STRICTLY MAX 280 characters.
      - Be direct, professional, and personalized.
      - Do NOT use generic buzzwords.
      - Do NOT include placeholders like "[Company Name]". Use the real names if found, otherwise use "your team".
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      TARGET ROLE: ${targetRole}
      
      Return ONLY the message text. No conversational padding.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    let result = data.result || "";
    
    // Clean up if AI wrapped in quotes or JSON
    if (result.includes('{') && result.includes('}')) {
      try {
        const jsonStr = extractJson(result);
        const parsed = JSON.parse(jsonStr);
        result = parsed.message || parsed.top_choice_message || result;
      } catch (e) {}
    }
    
    return result.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error("Error generating Top Choice message:", error);
    return "";
  }
}

export async function generateInterviewQuestions(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string[]> {
  const routedConfig = routeTask('interview_questions', config);
  const prompt = `
      Based on the following job description and the candidate's resume, generate 5-10 potential interview questions.
      Return the result as a JSON array of strings: [ "question1", "question2", ... ]
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    const parsed = JSON.parse(resultText || '[]');
    return Array.isArray(parsed) ? parsed : (parsed.questions || []);
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return [];
  }
}

export async function generateRecruiterMessage(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('recruiter_message', config);
  const prompt = `
      You are an expert career coach.
      Write a short, professional, and engaging message for a recruiter to accompany a resume application.
      The message should be concise (max 100 words), highlight the candidate's interest in the role, and briefly mention why they are a good fit based on the job description and resume.
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      
      Return the message as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    let result = data.result || "";
    
    // Try to parse if it looks like JSON
    if (result.includes('{') && result.includes('}')) {
       try {
         const jsonStr = extractJson(result);
         const parsed = JSON.parse(jsonStr);
         if (parsed.message) {
           result = parsed.message;
         } else if (parsed.recruiter_message) {
           result = parsed.recruiter_message;
         }
       } catch (e) {
         // Ignore and use raw result
       }
    }
    return result.trim();
  } catch (error) {
    console.error("Error generating recruiter message:", error);
    return "";
  }
}

export async function generateCoverLetter(
  jobDescription: string,
  resumeText: string,
  targetRole: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('cover_letter', config);
  const prompt = `
      You are an expert career coach and professional writer.
      Write a high-impact, persuasive cover letter for the following job description and candidate resume.
      The cover letter should be professional, concise (max 300-400 words), and specifically highlight how the candidate's experience aligns with the job requirements.
      Focus on the value the candidate brings to the company.
      
      CRITICAL: You MUST identify the company name from the job description and use it throughout the letter. Do not use placeholders like "[Company Name]". If the company name is not explicitly clear, use a generic but professional reference like "the team at your organization".
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      TARGET ROLE: ${targetRole}
      
      Return the cover letter as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    let result = data.result || "";
    
    // Try to parse if it looks like JSON
    if (result.includes('{') && result.includes('}')) {
       try {
         const jsonStr = extractJson(result);
         const parsed = JSON.parse(jsonStr);
         if (parsed.cover_letter) {
           result = parsed.cover_letter;
         } else if (parsed.coverLetter) {
           result = parsed.coverLetter;
         }
       } catch (e) {
         // Ignore and use raw result
       }
    }
    return result.trim();
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return "";
  }
}

export async function analyzeLinkedInProfile(
  resumeText: string,
  linkedInText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('linkedin_analysis', config);
  const prompt = `
      You are an expert LinkedIn profile optimizer and career coach.
      Analyze the following candidate's resume and their LinkedIn profile text.
      Provide a comprehensive review of the LinkedIn profile, highlighting strengths, areas for improvement, and specific suggestions to optimize it for better visibility and impact.
      
      RESUME: ${resumeText}
      LINKEDIN PROFILE: ${linkedInText}
      
      Return the review as a structured markdown document.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return data.result || "";
  } catch (error) {
    console.error("Error analyzing LinkedIn profile:", error);
    throw error;
  }
}

export async function generateWhyThisJob(
  jobDescription: string,
  resumeText: string,
  config: RouterConfig
): Promise<string> {
  const routedConfig = routeTask('recruiter_message', config);
  const prompt = `
      You are a career strategist.
      Recruiters often ask "Why did you apply for this job?" or "What thrilled you about this role?".
      Based on the job description and the candidate's resume, draft a compelling, authentic response (max 150 words).
      Focus on the specific alignment between the company's mission/needs and the candidate's passions/skills.
      
      JOB DESCRIPTION: ${jobDescription}
      RESUME: ${resumeText}
      
      Return the response as a plain text string. Do not include any extra conversational text.
    `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    return (data.result || "").trim();
  } catch (error) {
    console.error("Error generating Why This Job response:", error);
    return "";
  }
}

export async function optimizeHeadline(
  currentHeadline: string,
  resumeSummary: string,
  keySkills: string[],
  targetRole: string,
  config: RouterConfig
): Promise<{ headline: string; keywords_used: string[] }> {
  const routedConfig = routeTask('optimize_headline', config);
  const prompt = `
    You are a LinkedIn headline optimization expert for IT and Cloud professionals.

    Input:
    - Current Headline: ${currentHeadline}
    - Resume Summary: ${resumeSummary}
    - Key Skills: ${JSON.stringify(keySkills)}
    - Target Role: ${targetRole}

    Tasks:
    1. Rewrite the headline to be:
       - Keyword-rich (ATS and recruiter friendly)
       - Clear and impactful
       - Aligned with target role
    2. Include important keywords like Azure, Cloud, Infrastructure, Migration, etc. if relevant
    3. Keep it under 220 characters

    Constraints:
    - No buzzword stuffing
    - No fake claims
    - Must reflect real experience

    Output (STRICT JSON):
    {
      "headline": "...",
      "keywords_used": ["...", "..."]
    }
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || '{"headline": "", "keywords_used": []}');
  } catch (error) {
    console.error("Error optimizing headline:", error);
    throw error;
  }
}

export async function autoSelectPlayerCoachRole(
  jobDescription: string,
  config: RouterConfig
): Promise<boolean> {
  const routedConfig = routeTask('classify_role', config);
  const prompt = `
    Analyze the following Job Description.
    Determine if this role is a "Player-Coach" role (individual contributor + team lead/mentor).
    Return ONLY a JSON object: { "isPlayerCoach": boolean }
    
    JOB DESCRIPTION:
    ${jobDescription}
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    const parsed = JSON.parse(resultText);
    return parsed.isPlayerCoach;
  } catch (error) {
    console.error("Error auto-selecting player-coach role:", error);
    return false;
  }
}

export async function rankMasterResumes(
  jd: string,
  masters: MasterResume[],
  config: RouterConfig
): Promise<{ id: string; name: string; score: number; reason: string; ats_analysis: string; skill_gap: string[] }[]> {
  if (!masters || masters.length === 0) return [];

  const routedConfig = routeTask('rank_resumes', config);
  const prompt = `
    You are an expert recruitment strategist.
    Analyze the provided Job Description (JD) and the list of available "Master Resumes".
    Rank all resumes based on their suitability for the JD.
    
    FOR EACH RESUME, PROVIDE:
    1. A match score (0-100).
    2. A brief reason for the score.
    3. A quick ATS optimization analysis (keywords, formatting).
    4. A list of key missing skills (skill gap).
    
    JOB DESCRIPTION:
    ${jd}
    
    AVAILABLE MASTER RESUMES:
    ${masters.map(m => `ID: ${m.id}\nName: ${m.name}\nData: ${JSON.stringify(m.data).substring(0, 2000)}`).join("\n---\n")}
    
    RETURN ONLY JSON:
    [
      { 
        "id": "string", 
        "name": "string", 
        "score": number, 
        "reason": "string", 
        "ats_analysis": "string", 
        "skill_gap": ["string"] 
      }
    ]
    Order by score descending.
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(data.result || "");
    return JSON.parse(resultText || "[]");
  } catch (error) {
    console.error("Error ranking master resumes:", error);
    return masters.map(m => ({ id: m.id, name: m.name, score: 0, reason: "Error in analysis", ats_analysis: "", skill_gap: [] }));
  }
}

export async function selectBestMasterResume(
  jd: string,
  masters: MasterResume[],
  config: RouterConfig
): Promise<string | null> {
  if (!masters || masters.length === 0) return null;

  const routedConfig = routeTask('rank_resumes', config);

  const mastersSummary = masters.map((m) => {
    const content = typeof m.data === 'string' ? m.data : JSON.stringify(m.data);
    // Increase context to 3000 chars for better differentiation
    return `ID: ${m.id}\nName: ${m.name}\nDescription: ${m.description || 'N/A'}\nContext Extract: ${content.substring(0, 3000)}...`;
  }).join("\n\n---\n\n");

  const prompt = `
    You are an expert recruitment strategist specializing in profile selection.
    
    TASK:
    Analyze the provided Job Description (JD) and the list of available "Master Resumes".
    Your goal is to pick the SINGLE most appropriate Master Resume to use as the foundation for optimization.
    
    SELECTION CRITERIA:
    1. Technical Stack Alignment: Which resume highlights technologies most relevant to the JD?
    2. Seniority Alignment: Does the JD look for a Lead, Manager, or Individual Contributor? Pick the resume that matches this level.
    3. Industry/Domain Alignment: If the JD is for Fintech, Cloud Infra, or E-commerce, pick the corresponding profile.
    
    JOB DESCRIPTION:
    ${jd}
    
    AVAILABLE MASTER RESUMES:
    ${mastersSummary}
    
    STRICT OUTPUT RULE:
    Return ONLY a JSON object with the following structure:
    { 
      "selectedId": "the-exact-id-string", 
      "reason": "short explanation of why this profile is the best starting point" 
    }
    
    Ensure the "selectedId" matches one of the IDs provided in the MASTER RESUMES list exactly.
  `;

  try {
    const data = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const parsed = JSON.parse(extractJson(data.result || "") || "{}");
    
    // Validate that the returned ID actually exists in the masters list
    const found = masters.find(m => m.id === parsed.selectedId);
    if (found) {
      console.log(`[Nexus selection] AI picked: ${found.name} (${parsed.selectedId}). Reason: ${parsed.reason}`);
      return found.id;
    }
    
    console.warn(`[Nexus selection] AI returned unknown ID: ${parsed.selectedId}. Falling back to first.`);
    return masters[0].id;
  } catch (error) {
    console.error("Error selecting best master resume:", error);
    return masters[0].id; 
  }
}


export async function generateMasterResume(
  data: { company: string, role: string, startYear: string, endYear: string, description: string },
  config: RouterConfig
): Promise<{ role: string, company: string, duration: string, bullets: string[] }> {
  const routedConfig = routeTask('rewrite_resume', config);
  const prompt = `
    ROLE: Expert Career Coach & Resume Writer.
    TASK: Generate 6-8 high-impact, detailed, and ATS-friendly bullet points for a user's experience entry. A minimum of 6 bullet points is mandatory to ensure technical depth. Each bullet should be substantial (spanning 1-2 lines) and provide specific technical context and outcomes.
    
    INPUT DATA:
    Company: ${data.company}
    Role: ${data.role}
    Tenure: ${data.startYear} - ${data.endYear}
    Context/Description: ${data.description}
    
    STRICT GUIDELINES:
    - Use strong action verbs.
    - Include metrics (%, $, time saved, scale) if imaginable.
    - Focus on outcomes and leadership.
    
    OUTPUT (STRICT JSON):
    { "role": string, "company": string, "duration": string, "bullets": string[] }
  `;

  try {
    const dataResult = await callAI(prompt, routedConfig.model, routedConfig.engine, routedConfig.apiKey);
    const resultText = extractJson(dataResult.result || "");
    return JSON.parse(resultText);
  } catch (error) {
    console.error("Error generating master resume bullets:", error);
    throw error;
  }
}
