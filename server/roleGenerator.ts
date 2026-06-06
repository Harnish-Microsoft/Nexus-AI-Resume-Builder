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
    const prompt = `
ACT AS:
You are a Principal Resume Intelligence Architect and FAANG Recruiter.
Your objective is to rewrite this specific role into a recruiter-safe, technically mature, and human-written document that reflects factual realism.

Target Role: ${targetRole || 'Professional'}.
Audience: ${audience || 'Recruiters'}. Mode: ${mode || 'Standard'}.
${customPrompt ? `Custom Instructions: ${customPrompt}` : ''}
${brainDump ? `ADDITIONAL CONTEXT (BRAIN DUMP): ${brainDump}\nSift through this raw data to extract hidden achievements.` : ''}

ROLE DATA:
${JSON.stringify(role)}

CORPORATE DNA TAILORING (DEMONSTRATE, DO NOT DECLARE):
${targetCompany ? `Tailor appropriately for ${targetCompany}. Focus on specific impacts and technologies relevant to their industry.` : ''}

STRICT OPERATIONAL REALISM RULES (GLOBAL SYSTEM RULES):
1. TRUTHFULNESS IS MANDATORY: NEVER fabricate metrics, budget numbers, or leadership ownership. (Use ONLY provided role data).
2. AI-GENERATED LANGUAGE PREVENTION: DO NOT use "Spearheaded", "Orchestrated", "Pioneered". Use "Managed", "Implemented", "Coordinated", "Optimized", "Configured", "Automated".
3. THE FAANG Standard (Google XYZ): EVERY single bullet point MUST follow Google's XYZ formula: 'Accomplished [X] as measured by [Y], by doing [Z]'.
4. ROLE-SPECIFIC COUNTS (STRICT ASYMMETRICAL LAYOUT):
   - If role is Concentrix, M&M, ARCHER, or Casepoint: Strictly 4 to 5 high-impact XYZ bullet points.
   - If role is HCLTech: Strictly 2 brief XYZ bullet points.
   - If role is Sterling, AGILUS, Galaxy, or Aegis: Strictly 2 brief XYZ bullet points.
   
5. THE 1-LINE FAANG RULE:
   - Every bullet MUST be one single line (max 110 characters). 
   - Never wrap to a second line.
6. DEVOPS BAN: The terms "CI/CD", "Pipelines", and "DevOps" are ABSOLUTELY FORBIDDEN. Use "Infrastructure Automation", "Workflow Orchestration", or "Release Engineering".
7. PROJECT FIDELITY: Limit descriptions to 2 sentences or 25 words.

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
