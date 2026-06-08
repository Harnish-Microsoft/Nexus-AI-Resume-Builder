import { GoogleGenAI } from "@google/genai";

export async function generatePerRole(
  experience: any[], 
  geminiKey: string, 
  targetCompany?: string, 
  targetRole?: string,
  audience?: string,
  mode?: string,
  customPrompt?: string,
  brainDump?: string
) {
  const genAI = new GoogleGenAI({ apiKey: geminiKey });

  const promises = experience.map(async (role, index) => {
    // Determine the bullet count based on index (index 0 is current role, 1 is previous, 2 is third, 3+ is older)
    let bulletRule = "Strictly 1 to 3 brief bullet points maximum (Older roles). Do not elaborate heavily on these early roles.";
    if (index === 0) {
      bulletRule = "Strictly 6 to 8 high-impact bullet points (Current role).";
    } else if (index === 1) {
      bulletRule = "Strictly 5 to 6 high-impact bullet points (Previous role).";
    } else if (index === 2) {
      bulletRule = "Strictly 4 to 5 high-impact bullet points (Third role).";
    }

    const prompt = `
ROLE:
You are an elite FAANG Resume Architect, Executive Recruiter, ATS Specialist, and Career Strategist.
Your responsibility is to transform resumes into recruiter-optimized, ATS-friendly, achievement-focused resumes that maximize interview conversion rates.

You think like a FAANG Recruiter, Microsoft Hiring Manager, Amazon Bar Raiser, Google Technical Recruiter, ATS Parsing Engine, and Executive Resume Writer.

Target Role: ${targetRole || 'Professional'}.
Audience: ${audience || 'Recruiters'}. Mode: ${mode || 'Standard'}.
${customPrompt ? `Custom Instructions: ${customPrompt}` : ''}
${brainDump ? `ADDITIONAL CONTEXT (BRAIN DUMP): ${brainDump}\nSift through this raw data to extract hidden achievements.` : ''}

ROLE DATA:
${JSON.stringify(role)}

CORPORATE DNA TAILORING (DEMONSTRATE, DO NOT DECLARE):
${targetCompany ? `Tailor appropriately for ${targetCompany}. Focus on specific impacts and technologies relevant to their industry.` : ''}

STRICT OPERATIONAL REALISM RULES & CONSTRAINTS:
1. TRUTHFULNESS IS MANDATORY: NEVER fabricate metrics, budget numbers, or leadership ownership. Only enhance, rewrite, restructure, and optimize existing information in the provided role data.
2. AI-GENERATED LANGUAGE PREVENTION: DO NOT use "Spearheaded", "Orchestrated", "Pioneered", "Leveraged", "Empowered", "Synergized". Use natural, grounded operational verbs: "Managed", "Implemented", "Coordinated", "Governed", "Standardized", "Optimized", "Configured", "Delivered", "Automated".
3. STAR METHOD COMPLIANCE: Every single bullet point MUST follow the STAR / Google XYZ formula: 'Action Verb + Technology + Business Outcome + Metric'.
   Example: Migrated 120+ workloads to Azure, reducing infrastructure costs by 32% while improving deployment consistency across enterprise environments.
4. ROLE-SPECIFIC COUNTS (STRICT ASYMMETRICAL LAYOUT - CRITICAL):
   - ${bulletRule}
5. THE 1-LINE FAANG RULE:
   - Every bullet MUST be strictly ONE SINGLE LINE.
   - MAXIMUM 95 CHARACTERS per bullet point. This is a hard technical limit.
   - NEVER wrap a bullet point to a second line.
   - Maximum bullet length: 30 words. Target range: 18-25 words.
6. DEVOPS BAN: The terms "CI/CD", "Pipelines", and "DevOps" are ABSOLUTELY FORBIDDEN. Use "Infrastructure Automation", "Workflow Orchestration", "Release Engineering", or "Infrastructure Provisioning".

OUTPUT SCHEMA:
Return ONLY a valid JSON array of strings containing the high-impact bullet points for this role. Example: ["Bullet 1", "Bullet 2"]
`;

    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        let currentModel = "gemini-3.5-flash";
        let res;
        try {
          res = await genAI.models.generateContent({
            model: currentModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
          });
        } catch (e) {
          console.warn(`[RoleGen] ${currentModel} failed, falling back to 3.1-flash-lite...`);
          currentModel = "gemini-3.1-flash-lite";
          res = await genAI.models.generateContent({
            model: currentModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
          });
        }

        const text = res.text || "[]";
        let bullets = [];
        try {
          const parsed = JSON.parse(text);
          bullets = Array.isArray(parsed) ? parsed : (parsed.bullets || []);
        } catch (e) {
          console.error(`[RoleGen] JSON Parse error for ${role.id || index}:`, e);
          throw e; // Trigger retry
        }

        return {
          id: role.id || `role_${index + 1}`,
          role: role.role,
          company: role.company,
          duration: role.duration,
          bullets: bullets
        };
      } catch (err) {
        retryCount++;
        console.warn(`[RoleGen] Failed for ${role.id || index}. Retry ${retryCount}/${maxRetries}...`, err);
        if (retryCount >= maxRetries) {
          return {
            id: role.id || `role_${index + 1}`,
            role: role.role,
            company: role.company,
            duration: role.duration,
            bullets: role.original_bullets || []
          };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    // Fallback if loop ends (should not happen due to return in loop)
    return {
      id: role.id || `role_${index + 1}`,
      role: role.role,
      company: role.company,
      duration: role.duration,
      bullets: role.original_bullets || []
    };
  });

  return Promise.all(promises);
}
