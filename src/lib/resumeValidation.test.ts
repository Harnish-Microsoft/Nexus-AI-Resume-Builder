import assert from "node:assert/strict";
import test from "node:test";
import { computeImpactScore } from "./impactScore";
import { buildCandidateMaterial, buildEvidenceReport, parseRequirementAnalysis } from "./requirementEvidence";
import { resumeHealth } from "./resumeHealth";
import { documentFingerprint, exportReview, revalidateResume, validationIsCurrent, validationStamp } from "./resumeValidation";
import type { ValidationContext } from "./resumeValidation";
import type { OptimizationResult } from "../services/geminiService";

const bullets = [
  "Reduced Azure infrastructure costs by 30%.",
  "Designed Azure landing zones for 14 subscriptions using Bicep.",
  "Resolved Azure incidents through on-call triage and documented root causes.",
];
const source = JSON.stringify({
  experience: [{ role: "Engineer", company: "Contoso", duration: "2021 - Present", bullets }],
  skills: ["Azure", "Bicep"],
});
const context: ValidationContext = {
  resumeText: source, brainDump: "", otherResumes: [], targetRole: "Cloud Engineer",
  jobDescription: "Cloud Engineer required skills: Azure landing zones, Bicep infrastructure as code, incident management and cost optimization.",
};

function draft(): OptimizationResult {
  return {
    personal_info: { name: "Jane Doe", location: "", email: "jane@example.com", phone: "", linkedin: "" },
    summary: "Azure engineer who designed landing zones using Bicep.",
    skills: { Infrastructure: ["Azure", "Bicep"], DevSecOps: [], Governance: [], Observability: [] },
    experience: [{ company: "Contoso", role: "Engineer", duration: "2021 - Present", bullets: [...bullets] }],
    projects: [], education: [], certifications: [], improvement_notes: [], audience_alignment_notes: "",
    match_score: 99, baseline_score: 99, keyword_gap: [], ats_keywords_from_jd: [], ats_keywords_added_to_resume: [],
    draft_verification: {
      method: "draft-review-v1", ai_review: "completed", corrections: "none_needed",
      issues_found: 0, remaining: [], fixed: [], removed: [],
    },
  };
}

test("validation stamps track document and every evidence/posting input, not reports", () => {
  const resume = draft();
  resume.content_validation = validationStamp(resume, context, "generated");
  assert.equal(validationIsCurrent(resume, context), true);
  resume.match_score = 40;
  assert.equal(validationIsCurrent(resume, context), true);
  for (const change of [
    { resumeText: "Changed source" }, { brainDump: "More facts" }, { targetRole: "Director" },
    { jobDescription: "Different posting" }, { otherResumes: [source] },
  ]) assert.equal(validationIsCurrent(resume, { ...context, ...change }), false);
  resume.experience[0].bullets[0] = "Reduced Azure infrastructure costs by 80%.";
  assert.equal(validationIsCurrent(resume, context), false);
});

test("manual changes refresh claim checks and scores without changing the user's content", () => {
  const resume = draft();
  resume.content_validation = validationStamp(resume, context, "generated");
  resume.experience[0].bullets[0] = "Reduced Azure infrastructure costs by 80%.";
  const fingerprint = documentFingerprint(resume);
  const checked = revalidateResume(resume, context);
  assert.equal(documentFingerprint(checked), fingerprint);
  assert.equal(resume.draft_verification.ai_review, "completed", "original result was not mutated");
  assert.equal(checked.draft_verification.ai_review, "skipped");
  assert.ok(checked.draft_verification.remaining.some(issue => issue.type === "unsupported_figure"));
  assert.ok(checked.draft_verification.metric_provenance.some(metric => metric.status === "needs_review"));
  assert.equal(checked.content_validation.status, "checked_in_code");
  assert.equal(validationIsCurrent(checked, context), true);
  assert.equal(checked.impact_audit.score, computeImpactScore(structuredClone(checked), {
    sourceText: buildCandidateMaterial(source).text,
  }).score);
  assert.notEqual(checked.match_score, 99);
  assert.ok(exportReview(checked).concerns.length);
});

test("edited results retain unresolved semantic claims only while the flagged text remains", () => {
  const resume = draft();
  resume.draft_verification.remaining = [{
    location: "E1.3", label: "Engineer", type: "unsupported_claim",
    problem: "Source does not prove sole ownership.", text: bullets[2],
  }];
  const checked = revalidateResume(resume, context);
  assert.ok(checked.draft_verification.remaining.some(issue => issue.type === "unsupported_claim"));
  checked.experience[0].bullets[2] = "Documented Azure incident root causes.";
  assert.equal(revalidateResume(checked, context).draft_verification.remaining.some(issue => issue.type === "unsupported_claim"), false);
});

test("thin postings remove stale scores and generation-specific reports", () => {
  const resume = draft();
  resume.audit_report = {} as OptimizationResult["audit_report"];
  const checked = revalidateResume(resume, { ...context, jobDescription: "Engineer" });
  assert.equal(checked.match_score, undefined);
  assert.equal(checked.baseline_score, undefined);
  assert.equal(checked.audit_report, undefined);
  assert.deepEqual(checked.keyword_gap, []);
});

test("evidence is reverified for the same posting and invalidated for changed postings", () => {
  const resume = draft();
  const analysis = parseRequirementAnalysis({
    brief: { title: "Cloud Engineer", keywords: ["Azure"] },
    requirements: [{ id: "azure", text: "Azure", tier: "required", status: "evidenced", evidence: [{ text: bullets[1], source: "resume" }] }],
  }, buildCandidateMaterial(source), { jobDescription: context.jobDescription });
  assert.ok(analysis);
  resume.requirement_evidence = buildEvidenceReport(analysis);
  resume.content_validation = validationStamp(resume, context, "generated");
  assert.ok(revalidateResume(resume, context).requirement_evidence);
  assert.equal(revalidateResume(resume, { ...context, jobDescription: "Director of sales and marketing" }).requirement_evidence, undefined);
  const changedSource = { ...context, resumeText: "{}" };
  assert.equal(revalidateResume(resume, changedSource).requirement_evidence.requirements[0].status, "not_evidenced");
});

test("hard eligibility gaps stay advisory while unsupported claims need acknowledgment", () => {
  const resume = draft();
  resume.requirement_evidence = { hard_gaps: ["Security clearance"] } as OptimizationResult["requirement_evidence"];
  assert.deepEqual(exportReview(resume), { concerns: [], advisories: ["Security clearance"] });
  assert.deepEqual(resume.requirement_evidence.hard_gaps, ["Security clearance"], "review does not mutate the evidence map");
  resume.draft_verification.remaining = [{
    location: "S", label: "Summary", type: "unsupported_claim", problem: "Unproven leadership.", text: resume.summary,
  }];
  assert.equal(exportReview(resume).concerns.length, 1);
  resume.draft_verification.ai_review = "failed";
  assert.equal(exportReview(resume).concerns.length, 2);
});

test("source health equals the main impact audit on structured experience", () => {
  const health = resumeHealth(source);
  assert.equal(health.audit.score, computeImpactScore(JSON.parse(source)).score);
  assert.equal(health.bullets, 3);
  assert.equal(health.strongLeads, 3);
});

test("health ignores contact/date numbers and verbs outside experience bullets", () => {
  const text = [
    "Jane Doe +1 999 555 1234", "2019 - 2026", "Summary: designed, led, improved.",
    "- Azure infrastructure administration.", "- Bicep module maintenance.", "- Incident triage responsibilities.",
  ].join("\n");
  const health = resumeHealth(text);
  assert.equal(health.quantified, 0);
  assert.equal(health.strongLeads, 0);
  assert.equal(resumeHealth("- Designed Azure landing zones.").audit, null);
  assert.equal(resumeHealth("Jane Doe 2019 +1 999 555 1234"), null);
});
