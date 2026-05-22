import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export async function generatePerRole(
  experience: any[], 
  geminiKey: string, 
  targetCompany?: string, 
  targetRole?: string,
  audience?: string,
  mode?: string,
  customPrompt?: string,
  brainDump?: string,
  engine: 'gemini' | 'openai' = 'gemini',
  openaiKey: string = ''
) {
  const genAI = new GoogleGenAI({ apiKey: geminiKey });
  const oai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

  const promises = experience.map(async (role, index) => {
    const prompt = `
Optimize this structured resume data for the target role: ${targetRole || 'Professional'}.
Audience: ${audience || 'Recruiters'}. Mode: ${mode || 'Standard'}.
${customPrompt ? `Custom Instructions: ${customPrompt}` : ''}
${brainDump ? `ADDITIONAL CONTEXT (BRAIN DUMP): ${brainDump}\nSift through this raw data to extract hidden achievements.` : ''}

ROLE DATA:
${JSON.stringify(role)}

CORPORATE DNA TAILORING (DEMONSTRATE, DO NOT DECLARE):
${targetCompany ? `Tailor appropriately for ${targetCompany}. Focus on specific impacts and technologies relevant to their industry.` : ''}

GLOBAL SYSTEM RULES (STRICT ENFORCEMENT):
1. STAR METHODOLOGY: EVERY bullet point MUST follow STAR (Situation, Task, Action, Result).
2. ACTION VERBS: EVERY bullet MUST start with a strong action verb (Architected, Spearheaded, Optimized, Standardized, Orchestrated, Led, Directed, Improved, Implemented, Streamlined, Governed, Enhanced, Coordinated, Modernized, Transformed).
3. IMPACT & SCALE: High-impact bullets MUST conform to the formula: "Accomplished [Impact] as measured by [Scale/Metric], by [Action/Mechanism]."
4. AVOID WEAK WORDING: Do NOT use "Managed", "Supported", "Assisted", "Helped", "Responsible for".
5. FORBIDDEN TERMS: Unless present in source data, do NOT hallucinate deep "Kubernetes", "DevOps", "CI/CD", or "Microservices" experience. Focus on Infrastructure & Operations Leadership.
6. AZURE LEADERSHIP FOCUS: Emphasize Landing Zones, Governance, Reliability, Hybrid Cloud, HA/DR, and FinOps.
7. COMPREHENSIVE DETAIL: Include all significant achievements provided in the source ROLE DATA.
8. FAANG LEADERSHIP MODE: ONLY IF mode is 'FAANG Leadership' or 'Player-Coach':
   - BALANCE: 60% Technical Strategy (Azure infra), 40% Executive Leadership (Standardization, Mentoring, Governance).
   - VOCABULARY: Use "Architected & Led," "Designed & Mentored," "Engineered & Standardized."
9. TENURE & TIMELINE AWARENESS: Do NOT alter the job title or append "(Contract)".


OUTPUT SCHEMA:
Return ONLY a valid JSON array of strings containing the high-impact bullet points for this role. Do not include keys, objects, or markdown formatting outside the array. Example: ["Bullet 1", "Bullet 2"]
`;

    try {
      let text = "[]";
      
      if (engine === 'openai' && oai) {
        const completion = await oai.chat.completions.create({
          model: "gpt-4o-mini", // Use mini for speed and cost in per-role generation
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        text = completion.choices[0].message.content || "[]";
      } else {
        const res = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });
        text = res.text || "[]";
      }

      let bullets = [];
      try {
        const parsed = JSON.parse(text);
        bullets = Array.isArray(parsed) ? parsed : (parsed.bullets || []);
      } catch (e) {
        console.error(`[RoleGen] JSON Parse error for ${role.id || index}:`, e);
      }

      return {
        id: role.id || `role_${index + 1}`,
        role: role.role,
        company: role.company,
        duration: role.duration,
        bullets: bullets
      };
    } catch (err) {
      console.error(`[RoleGen] Failed for ${role.id || index}:`, err);
      return {
        id: role.id || `role_${index + 1}`,
        role: role.role,
        company: role.company,
        duration: role.duration,
        bullets: role.original_bullets || []
      };
    }
  });

  return Promise.all(promises);
}
