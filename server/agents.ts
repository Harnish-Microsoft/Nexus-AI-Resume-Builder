import { GoogleGenAI } from "@google/genai";

export async function runAgents(input: any, geminiKey: string) {
  const genAI = new GoogleGenAI({ apiKey: geminiKey });

  const agents = {
    hr: "Improve clarity, impact, and signal-to-noise ratio. ANTI-BUZZWORD rule: Replace 'Strategic', 'Visionary', 'Spearheaded' with direct outcomes.",
    ats: "Optimize for ATS keywords. Ensure clean hierarchy.",
    architect: "Enhance technical depth. ANTI-BUZZWORD rule: Forbidden: 'Architected', 'Engineered', 'Orchestrated'. Allowed: 'Designed', 'Built', 'Optimized'."
  };

  const results: any = {};

  for (const [key, instruction] of Object.entries(agents)) {
    const prompt = `
You are a ${key.toUpperCase()} resume expert.

${instruction}

INPUT:
${JSON.stringify(input)}

Return structured JSON.
`;

    try {
      const res = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      results[key] = JSON.parse(res.text || "{}");
    } catch (err) {
      console.error(`[Agent ${key}] Failed:`, err);
      results[key] = { error: "Agent failed" };
    }
  }

  return results;
}
