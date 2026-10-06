import assert from "node:assert/strict";
import test from "node:test";
import { buildCandidateMaterial } from "./requirementEvidence";
import { inspectMetricProvenance } from "./metricProvenance";
import { inspectDraft, reviewAndCorrectDraft, refreshVerificationReport } from "./draftReview";
import { evidenceNote, evidenceQuestions } from "./evidenceCollection";
import type { RequirementEvidenceReport, JobRequirement } from "./requirementEvidence";
import { validateExportText } from "./exportValidation";

const material = buildCandidateMaterial(JSON.stringify({
  experience: [
    { company: "Contoso", role: "Engineer", bullets: ["Reduced Azure infrastructure costs by 30%.", "Managed Azure infrastructure for 40 subscriptions."] },
    { company: "Fabrikam", role: "Engineer", bullets: ["Reduced Azure infrastructure costs by 50%."] },
  ],
}));
const segment = { id: "E1.1", kind: "bullet" as const, label: "Engineer", text: "Reduced Azure infrastructure costs by 30%." };

test("metric provenance retains the source employer and exact statement", () => {
  const [metric] = inspectMetricProvenance(segment, material, "Contoso");
  assert.equal(metric.status, "supported");
  assert.equal(metric.source?.company, "Contoso");
  assert.equal(metric.source?.text, segment.text);
});

test("metrics cannot be borrowed from another employer, measurement or unit", () => {
  for (const text of [
    "Reduced Azure infrastructure costs by 50%.",
    "Reduced Azure infrastructure costs by 40%.",
    "Reduced Azure infrastructure costs by $30.",
    "Reduced Azure infrastructure incidents by 30%.",
    "Trained 30 engineers in incident response.",
  ]) assert.equal(inspectMetricProvenance({ ...segment, text }, material, "Contoso")[0].status, "needs_review", text);
});

test("metrics remain bound to the source role at the same employer", () => {
  assert.equal(inspectMetricProvenance(segment, material, "Contoso", "Director")[0].status, "needs_review");
});

test("repeated figures are checked at their individual measurement positions", () => {
  const metrics = inspectMetricProvenance({
    ...segment, text: "Reduced Azure infrastructure costs by 30% and Azure infrastructure incidents by 30%.",
  }, material, "Contoso");
  assert.equal(metrics[0].status, "supported");
  assert.equal(metrics[1].status, "needs_review");
});

test("attributed candidate notes support metrics, but unattributed notes do not", () => {
  const note = evidenceNote("Contoso", "Engineer", "Reduced Azure infrastructure costs by 30%.");
  assert.equal(inspectMetricProvenance(segment, buildCandidateMaterial("{}", note), "Contoso")[0].status, "supported");
  assert.equal(inspectMetricProvenance(segment, buildCandidateMaterial("{}", "Reduced Azure infrastructure costs by 30%."), "Contoso")[0].status, "needs_review");
  const notesMaterial = buildCandidateMaterial("{}", note);
  const saved = notesMaterial.segments.find(item => item.source === "brain_dump");
  assert.equal(saved?.role, "Engineer");
  assert.equal(saved?.company, "Contoso");
  assert.equal(saved?.text, segment.text);
});

test("review checks and corrections enforce context-bound metrics", async () => {
  const resume = { experience: [{ role: "Engineer", company: "Contoso", bullets: ["Reduced Azure infrastructure costs by 50%."] }] };
  const ctx = { material, evidenceText: material.text, figureSourceText: material.text, jobDescription: "" };
  assert.ok(inspectDraft(resume, ctx).some(issue => issue.type === "unsupported_figure"));
  const report = await reviewAndCorrectDraft(resume, ctx, async (_prompt, purpose) =>
    JSON.stringify(purpose === "review" ? { issues: [] } : { corrections: [{ location: "E1.1", text: "Reduced Azure infrastructure costs by 40%." }] })
  );
  assert.equal(report.fixed.length, 0);
  assert.equal(report.metric_provenance?.[0].status, "needs_review");
  assert.ok(report.remaining.some(issue => issue.type === "unsupported_figure"));
});

test("provenance addresses follow retained bullets after trimming", async () => {
  const resume = { experience: [{ company: "Contoso", bullets: ["An unquantified bullet.", segment.text] }], draft_verification: undefined };
  resume.draft_verification = await reviewAndCorrectDraft(resume, { material, evidenceText: material.text, figureSourceText: material.text, jobDescription: "" });
  resume.experience[0].bullets.shift();
  refreshVerificationReport(resume);
  assert.equal(resume.draft_verification.metric_provenance[0].location, "E1.1");
});

test("evidence questions prioritize eligibility then required gaps and never suggest exclusions", () => {
  const requirement = (id: string, overrides: Partial<JobRequirement>): JobRequirement => ({
    id, text: id, tier: "preferred", kind: "skill", hard_gate: false, status: "not_evidenced", evidence: [], ...overrides,
  });
  const report = { requirements: [
    requirement("nice", {}), requirement("required", { tier: "required", status: "partial" }),
    requirement("gate", { hard_gate: true }), requirement("proven", { status: "evidenced" }),
    requirement("excluded", { status: "excluded" }),
  ] } as RequirementEvidenceReport;
  assert.deepEqual(evidenceQuestions(report).map(item => item.id), ["gate", "required", "nice"]);
  assert.match(evidenceNote(" Contoso ", " Engineer ", "Built landing zones.\nSaved costs."), /Engineer @ Contoso: Built landing zones\. Saved costs\./);
});

test("PDF validation tolerates wrapping, punctuation, ligatures and preserves order across pages", () => {
  const report = validateExportText("Jane Doe\njane@example.com\nExperience\nImproved office workflows by 30%.", [
    "Jane Doe jane @ example.com Experience", "Improved ofﬁce work flows by 30 %.",
  ]);
  assert.deepEqual(report.errors, []);
  assert.equal(report.page_count, 2);
  assert.equal(report.blocks_checked, 4);
});

test("PDF validation detects lost content, duplicate losses, reading order and blank pages", () => {
  assert.match(validateExportText("Contact\nExperience", ["Experience Contact"]).errors[0], /Reading order/);
  assert.match(validateExportText("Contact\nExperience", ["Contact"]).errors[0], /Missing/);
  assert.match(validateExportText("Same bullet\nSame bullet", ["Same bullet"]).errors[0], /duplicate/);
  assert.ok(validateExportText("Contact", ["Contact", ""]).errors.some(error => error.includes("Page 2")));
  assert.ok(validateExportText("", [""]).errors.length);
  assert.ok(validateExportText("Saved 3.0%.", ["Saved 30%."]).errors.length);
  assert.ok(validateExportText("jane@example.com", ["janeexample.com"]).errors.length);
});

test("PDF page target is advisory rather than silently truncating the resume", () => {
  const report = validateExportText("One\nTwo\nThree", ["One", "Two", "Three"]);
  assert.deepEqual(report.errors, []);
  assert.match(report.warnings[0], /3 pages/);
});
