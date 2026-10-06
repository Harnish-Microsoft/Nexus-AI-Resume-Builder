import type { ModelRunner } from "./modelRunner";

/** Each agent's call runs on the admins' writing models through the request's ModelRunner. */
export async function runAgents(input: any, runner: ModelRunner) {
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
      const res = await runner.call(prompt, "writing");
      results[key] = JSON.parse(res.text || "{}");
    } catch (err) {
      console.error(`[Agent ${key}] Failed:`, err);
      results[key] = { error: "Agent failed" };
    }
  }

  return results;
}
