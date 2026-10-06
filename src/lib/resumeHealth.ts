import { computeImpactScore, inspectBullet } from "./impactScore";
import { parseResumeJson } from "./requirementEvidence";
import { resumeSegments } from "./resumeSegments";

export function resumeHealth(resumeText: string) {
  const parsed = parseResumeJson(resumeText);
  const bulletLines = parsed
    ? resumeSegments(parsed).filter(segment => segment.kind === "bullet").map(segment => segment.text)
    : resumeText.split(/\r?\n/).filter(line => /^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(line))
      .map(line => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, "").trim());
  if (!bulletLines.length) return null;
  const resume = parsed || { experience: [{ role: "Source resume", bullets: bulletLines }] };
  const audit = computeImpactScore(structuredClone(resume));
  const inspections = bulletLines.map(inspectBullet);
  return {
    audit,
    bullets: bulletLines.length,
    strongLeads: inspections.filter(item => item.strongLead).length,
    quantified: inspections.filter(item => item.quantified).length,
    vague: inspections.filter(item => item.vague).length,
  };
}
