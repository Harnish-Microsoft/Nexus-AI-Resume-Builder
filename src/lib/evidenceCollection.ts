import type { JobRequirement, RequirementEvidenceReport } from "./requirementEvidence";

export function evidenceQuestions(report?: RequirementEvidenceReport): JobRequirement[] {
  return (report?.requirements || [])
    .filter(item => item.status === "partial" || item.status === "not_evidenced")
    .sort((a, b) => Number(b.hard_gate) - Number(a.hard_gate) || Number(b.tier === "required") - Number(a.tier === "required"));
}

export function evidenceNote(employer: string, role: string, evidence: string): string {
  return `[Evidence] ${role.trim().replace(/\s+/g, " ")} @ ${employer.trim().replace(/\s+/g, " ")}: ${evidence.trim().replace(/\s+/g, " ")}`;
}
