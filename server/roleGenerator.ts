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
3. METRIC CONFIDENCE ENGINE: Metrics ONLY allowed if explicit or strongly inferable. NEVER generate arbitrary percentages. If metrics are missing, prioritize technical depth.
4. STAR METHODOLOGY: Reflect challenge, action, technologies, and realistic outcome. Do NOT force metrics.
5. LEADERSHIP POSITIONING: Leadership wording must match designation/tenure. If tenure is short (<6 months), focus on onboarding/shadowing.
6. HUMANIZATION: Avoid buzzword stacking and AI phrasing.
7. RESUME DENSITY CONTROL: Max 1 primary achievement per bullet. Max 2 technologies per bullet. Max 1 metric per bullet.
8. DETAIL: Each bullet MUST be highly impactful, technical, and detailed. Each bullet should span 2 to 3 lines in a standard resume layout to provide deep technical context and specific outcomes. STRICTLY AVOID brief one-liners. Prioritize technical context, architecture details, and scale metrics.
9. RECENT ROLE EXPANSION (Post-2018): If the role occurred after 2018, you MUST output 6 to 9 bullets. Provide extremely high density of details.
10. DEVOPS BAN: The terms "CI/CD", "Pipelines", and "DevOps" are ABSOLUTELY FORBIDDEN. Use "Infrastructure Automation", "Workflow Orchestration", or "Release Engineering".

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
