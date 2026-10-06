import { coerceVerificationReport, inspectDraft, refreshVerificationReport } from "./draftReview";
import { computeImpactScore } from "./impactScore";
import { computeMatchScores } from "./matchScore";
import { buildCandidateMaterial, parseRequirementAnalysis, buildEvidenceReport } from "./requirementEvidence";
import { inspectMetricProvenance } from "./metricProvenance";
import { resumeSegments } from "./resumeSegments";
import type { OptimizationResult } from "../services/geminiService";

export interface ValidationContext {
  resumeText: string;
  brainDump: string;
  jobDescription: string;
  targetRole: string;
  otherResumes: unknown[];
}

export interface ValidationStamp {
  document: string;
  context: string;
  posting: string;
  status: "generated" | "checked_in_code";
}

export function documentFingerprint(resume: unknown): string {
  if (!resume || typeof resume !== "object") return "";
  const data = resume as Record<string, unknown>;
  return JSON.stringify(["personal_info", "summary", "skills", "experience", "projects", "education", "certifications", "why_this_job"]
    .map(key => [key, data[key]]));
}

export function validationStamp(resume: unknown, context: ValidationContext, status: ValidationStamp["status"]): ValidationStamp {
  return {
    document: documentFingerprint(resume),
    context: JSON.stringify(context),
    posting: JSON.stringify([context.jobDescription, context.targetRole]),
    status,
  };
}

export function validationIsCurrent(resume: OptimizationResult | undefined, context: ValidationContext): boolean {
  if (!resume) return false;
  const expected = validationStamp(resume, context, "checked_in_code");
  return resume.content_validation?.document === expected.document && resume.content_validation?.context === expected.context;
}

/** Rechecks edited content without rewriting or deleting the user's work. */
export function revalidateResume(resume: OptimizationResult, context: ValidationContext): OptimizationResult {
  const updated = structuredClone(resume);
  const material = buildCandidateMaterial(context.resumeText, context.brainDump, { otherResumes: context.otherResumes });
  const stamp = validationStamp(updated, context, "checked_in_code");
  const previous = coerceVerificationReport(updated.draft_verification);
  refreshVerificationReport(updated);
  const retained = updated.draft_verification?.remaining.filter(issue =>
    issue.type === "unsupported_claim" || issue.type === "missed_evidence"
  ) || [];
  const issues = inspectDraft(updated, {
    figureSourceText: material.text, evidenceText: material.text, material,
    jobDescription: context.jobDescription, targetRole: context.targetRole,
  });
  const segments = resumeSegments(updated);
  updated.draft_verification = {
    method: "draft-review-v1", ai_review: "skipped", corrections: "skipped",
    issues_found: issues.length + retained.length, fixed: previous?.fixed || [], removed: previous?.removed || [],
    remaining: [
      ...issues.flatMap(issue => {
        const segment = segments.find(item => item.id === issue.location);
        return segment ? [{ ...issue, label: segment.label, text: segment.text }] : [];
      }), ...retained,
    ],
    metric_provenance: segments.flatMap(segment => {
      const index = /^E(\d+)\./.exec(segment.id);
      const role = index ? updated.experience[Number(index[1]) - 1] : undefined;
      const project = /^P(\d+)$/.exec(segment.id);
      const title = project ? updated.projects?.[Number(project[1]) - 1]?.title : undefined;
      return inspectMetricProvenance(segment, material, role?.company, role?.role, title);
    }),
  };
  if (updated.requirement_evidence && updated.content_validation?.posting === stamp.posting) {
    const analysis = parseRequirementAnalysis(updated.requirement_evidence, material, { jobDescription: context.jobDescription });
    if (analysis) updated.requirement_evidence = buildEvidenceReport(analysis);
    else delete updated.requirement_evidence;
  } else {
    delete updated.requirement_evidence;
  }
  const scores = computeMatchScores({
    optimizedResume: updated, originalResumeText: context.resumeText,
    jobDescription: context.jobDescription, targetRole: context.targetRole,
  });
  if (scores) Object.assign(updated, scores);
  else {
    delete updated.match_score;
    delete updated.baseline_score;
    delete updated.score_breakdown;
    updated.ats_keywords_from_jd = [];
    updated.ats_keywords_added_to_resume = [];
    updated.keyword_gap = [];
  }
  const impact = computeImpactScore(structuredClone(updated), { sourceText: material.text });
  if (impact) updated.impact_audit = impact;
  else delete updated.impact_audit;
  // These reports describe generation decisions, not a manually edited document.
  delete updated.linkedin_trends;
  delete updated.audience_coverage;
  delete updated.bullet_budget_report;
  delete updated.audit_report;
  updated.content_validation = stamp;
  return updated;
}

export function exportReview(resume: OptimizationResult): { concerns: string[]; advisories: string[] } {
  const concerns = (resume.draft_verification?.remaining || []).map(issue => `${issue.label}: ${issue.problem}`);
  if (!resume.draft_verification || resume.draft_verification.ai_review !== "completed") {
    concerns.push("Only deterministic checks are current. Semantic claims have not had a completed AI review for this version.");
  }
  const advisories = [...(resume.requirement_evidence?.hard_gaps || [])];
  if (!resume.requirement_evidence) advisories.push("Requirement evidence is unavailable for this posting. Run Optimize to rebuild it.");
  return { concerns, advisories };
}
