import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMatchScores,
  focusJobDescription,
  jdRequirementTerms,
  prepareEvidenceText,
  termAbsent,
  termEvidence,
} from "./matchScore";
import { buildInputCoverage, wholePosting } from "./inputCoverage";

test("a posting that fits is passed through untouched", () => {
  const jd = "Requirements:\n- Azure landing zones\n- Incident management";
  assert.deepEqual(focusJobDescription(jd, 1000), {
    text: jd,
    original_chars: jd.length,
    boilerplate_removed: false,
    truncated: false,
    omitted_chars: 0,
  });
});

test("company, benefits and EEO sections go before any requirement is cut", () => {
  const jd = [
    "Cloud Engineer",
    "Requirements:",
    "- Azure landing zones",
    "- Incident management",
    "Benefits",
    ...Array.from({ length: 60 }, () => "- Generous perks and a wellness stipend"),
    "About us",
    "We are a great place to work.",
  ].join("\n");
  const focused = focusJobDescription(jd, 1000);
  assert.equal(focused.boilerplate_removed, true);
  assert.equal(focused.truncated, false);
  assert.match(focused.text, /Incident management/);
  assert.doesNotMatch(focused.text, /wellness|great place/);
});

test("a posting that still does not fit is cut at a line boundary, visibly", () => {
  const jd = ["Requirements:", ...Array.from({ length: 300 }, (_, i) => `- Requirement ${i} about Azure operations`)].join("\n");
  const focused = focusJobDescription(jd, 2000);
  assert.equal(focused.truncated, true);
  assert.ok(focused.omitted_chars > 0);
  assert.match(focused.text, /\n- Requirement \d+ about Azure operations\n\[\.\.\. posting truncated: \d+ more characters not shown\]$/);
});

test("evidence helpers are alias-aware and only call a term absent when nothing of it appears", () => {
  const corpus = prepareEvidenceText("Operated Azure Monitor alerts and resolved incidents.");
  assert.equal(termAbsent("Kubernetes", corpus), true);
  assert.equal(termAbsent("incident management", corpus), false);
  assert.equal(termAbsent("observability", corpus), false);
  assert.equal(termEvidence("k8s", prepareEvidenceText("Ran Kubernetes clusters")), 1);
  const terms = jdRequirementTerms("Senior Cloud Engineer\nRequirements:\n- Terraform\n- Kubernetes in production\n- Azure");
  assert.ok(terms.some((t) => t.term === "terraform" && t.tier === "required"));
  assert.deepEqual(jdRequirementTerms("too short"), []);
});

test("keyword coverage is labelled as coverage, not as a match", () => {
  const resume: any = { summary: "Azure engineer", experience: [{ role: "Cloud Engineer", bullets: ["Ran Azure Monitor alerts."] }] };
  applyMatchScores(resume, {
    jobDescription: "Cloud Engineer\nRequirements:\n- Azure\n- Azure Monitor\n- Kubernetes\n- PowerShell scripting",
    originalResumeText: "Azure engineer. Ran Azure Monitor alerts.",
    targetRole: "Cloud Engineer",
  });
  assert.match(resume.score_breakdown.optimized.readiness.label, / coverage$/);
});

test("input coverage discloses every cut in plain words, and nothing when nothing was cut", () => {
  const whole = wholePosting("Requirements:\n- Azure");
  assert.deepEqual(buildInputCoverage({ resumeChars: 900, resumeMethod: "structured", generationPosting: whole }).notes, []);

  const cut = { text: "x", original_chars: 40000, boilerplate_removed: true, truncated: true, omitted_chars: 2500 };
  const analysed = { text: "y".repeat(30000), original_chars: 40000, boilerplate_removed: true, truncated: false, omitted_chars: 0 };
  const report = buildInputCoverage({
    resumeChars: 70000,
    resumeMethod: "extracted",
    resumeOmittedChars: 10000,
    analysisPosting: analysed,
    generationPosting: cut,
  });
  assert.equal(report.notes.length, 3);
  assert.match(report.notes[0], /last 10000 characters of your resume/);
  assert.match(report.notes[1], /shortened for the writing step \(2500 characters left out\); its requirements were still analysed in full/);
  assert.match(report.notes[2], /Company, benefits and EEO sections/);
  assert.equal(report.job_description.omitted_chars, 0, "the analysis read the whole posting");
  assert.equal(report.job_description.analysis_chars, 30000);
});
