import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { applicationFields, ATS_FONTS, canonicalResume, exportBlocks, resumeFileName, structuredResumeWarnings, typographyWarnings } from "./atsDocument";
import { createResumeDOCX, validateResumeDOCX } from "./docxExport";
import { validateExportText } from "./exportValidation";
import { computeKeywordCoverageTarget } from "./matchScore";
import { buildCandidateMaterial, buildEvidenceReport, parseRequirementAnalysis } from "./requirementEvidence";
import { inspectDraft, reviewAndCorrectDraft } from "./draftReview";
import { buildResumeGenerationPrompt, buildResumeMetaPrompt, buildRoleBulletPrompt, KEYWORD_TARGET_RULE } from "./resumePrompt";
import type { OptimizationResult } from "../services/geminiService";

export function exportFixture(): OptimizationResult {
  return {
    personal_info: { name: "Jordan Example", location: "London", email: "jordan@example.org", phone: "+44 20 7946 0958", linkedin: "https://www.linkedin.com/in/jordan-example" },
    summary: "Cloud engineer designing Azure infrastructure with Bicep and improving incident management.",
    skills: { Infrastructure: ["Azure", "Bicep"], Governance: ["Cost optimization"], Observability: ["Incident management"], DevSecOps: [] },
    experience: [
      { company: "Example Services Ltd", role: "Cloud Engineer", duration: "Jan 2022 - Present", bullets: [
        "Designed Azure landing zones using Bicep.", "Reduced Azure infrastructure costs by 30%.", "Resolved Azure incidents with documented root causes.",
      ] },
      { company: "Example Systems Ltd", role: "Engineer", duration: "2019 - 2021", bullets: ["Maintained Windows servers and networking."] },
    ],
    education: ["BSc Computer Science | Example University | 2019"],
    projects: [{ title: "Azure landing zone", description: "Designed subscription governance with Bicep." }],
    certifications: ["AZ-104"], match_score: 0, baseline_score: 0, keyword_gap: [], ats_keywords_added_to_resume: [], ats_keywords_from_jd: [],
    improvement_notes: [], audience_alignment_notes: "",
  };
}

test("canonical exports use candidate overrides consistently and never mutate the result", () => {
  const original = exportFixture();
  const canonical = canonicalResume(original, { name: "Taylor Applicant", email: "taylor@example.org", location: "" });
  assert.equal(canonical.personal_info.name, "Taylor Applicant");
  assert.equal(canonical.personal_info.location, "London");
  assert.equal(original.personal_info.name, "Jordan Example");
  assert.match(resumeFileName(canonical, "Cloud/Engineer", "pdf"), /^Taylor Applicant-CloudEngineer\.pdf$/);
  assert.ok(!resumeFileName(canonical, "Cloud Engineer", "pdf").includes("Harnish"));
});

test("one ordered source includes all experience, contact, projects, certifications and education", () => {
  const resume = exportFixture();
  const blocks = exportBlocks(resume);
  const expected = blocks.map(block => block.text).join("\n");
  assert.equal(validateExportText(expected, [expected]).errors.length, 0);
  for (const entry of [resume.personal_info.email, resume.experience[0].bullets[1], resume.education[0], resume.projects[0].description]) {
    const report = validateExportText(expected, [expected.replace(entry, "")]);
    assert.ok(report.errors.length, entry);
  }
  assert.equal(blocks.filter(block => block.kind === "heading").length, 6);
});

test("DOCX round-trip verifies unicode, ampersands, all sections and safe structure", async () => {
  const resume = exportFixture();
  resume.personal_info.name = "Renée O'Example";
  resume.projects[0].description = "Built identity & access governance.";
  const blob = await createResumeDOCX(resume, "Calibri");
  await validateResumeDOCX(blob, resume);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(xml.includes('w:ascii="Calibri"'));
  assert.ok(xml.includes('w:sz w:val="22"'));
  assert.ok(xml.includes('w:line="300"'));
  assert.ok(!/<w:(?:tbl|txbxContent)\b/.test(xml));
  const metadata = await zip.file("docProps/core.xml")!.async("string");
  assert.ok(metadata.includes("Renée"));
  assert.ok(!metadata.includes("Harnish"));
  zip.file("word/document.xml", xml.replace("Example University", "Wrong University"));
  const corrupted = new Blob([await zip.generateAsync({ type: "uint8array" })]);
  await assert.rejects(validateResumeDOCX(corrupted, resume), /DOCX validation failed/);
});

test("application summaries preserve year-only dates without inventing months or eligibility", () => {
  const summary = applicationFields(exportFixture());
  assert.match(summary, /Start: Jan 2022/);
  assert.match(summary, /End: Present/);
  assert.match(summary, /Start: Confirm month\/year from source; do not infer/);
  assert.match(summary, /Answer work authorization, sponsorship/);
  assert.ok(!summary.includes("Authorized: Yes"));
});

test("structured checks flag source problems, not rewrite legitimate overlapping roles", () => {
  const resume = exportFixture();
  resume.experience[1].duration = "2020 - Present";
  const warnings = structuredResumeWarnings(resume);
  assert.ok(warnings.some(warning => warning.includes("overlap")));
  resume.experience[0].duration = "2025 - 2020";
  assert.ok(structuredResumeWarnings(resume).some(warning => warning.includes("dates need review")));
  assert.equal(resume.experience[0].duration, "2025 - 2020");
});

test("font/spacing checks enforce readable defaults without claiming vendor mandates", () => {
  for (const font of ATS_FONTS) assert.deepEqual(typographyWarnings(font, 11, 1.25, 0), []);
  assert.ok(typographyWarnings("Custom Decorative", 11, 1.25, 0).length);
  assert.ok(typographyWarnings("Calibri", 11, 1.25, 0, 0.5).some(warning => warning.includes("10 pt")));
  assert.ok(typographyWarnings("Arial", 11, 0.8, 0.3).length >= 2);
});

test("mixed-precision source dates do not invent a month for the year-only endpoint", () => {
  const resume = exportFixture();
  resume.experience[0].duration = "Jan 2022 - 2024";
  assert.match(applicationFields(resume), /Start: Jan 2022\nEnd: Confirm month\/year/);
});

const jd = "Cloud Engineer\nRequired skills:\n- Azure\n- Bicep\n- Windows Server\n- Networking\n- Incident management\n- Cost optimization";
test("80% target measures weighted vocabulary supported by source, not the blended score", () => {
  const resume = exportFixture();
  const source = buildCandidateMaterial(JSON.stringify(resume)).text;
  const goal = computeKeywordCoverageTarget(resume, jd, source, "Cloud Engineer");
  assert.ok(goal);
  assert.ok(goal.actual >= 80, JSON.stringify(goal));
  assert.equal(goal.status, "met");
  const blank = { summary: "Engineer", skills: [], experience: [] };
  const missing = computeKeywordCoverageTarget(blank, jd, source, "Cloud Engineer");
  assert.equal(missing.status, "supported_terms_remaining");
  assert.ok(missing.supported_missing.includes("azure"));
  const invented = computeKeywordCoverageTarget(resume, jd, "", "Cloud Engineer");
  assert.equal(invented.actual, 0);
  assert.equal(invented.status, "evidence_limited");
  assert.equal(computeKeywordCoverageTarget(resume, "Engineer", source), null);
});

test("excluded skills never count toward evidence-limited coverage even if source names them", () => {
  const goal = computeKeywordCoverageTarget({ skills: ["Terraform", "DevOps", "Azure", "Bicep"] },
    "Cloud Engineer required skills: Terraform, DevOps, Azure and Bicep for infrastructure engineering.",
    "Terraform DevOps Azure Bicep", "Cloud Engineer");
  assert.ok(goal.unsupported.includes("terraform"));
  assert.ok(goal.actual < 100);
});

test("bounded draft correction surfaces supported missing terms without adding unsupported requirements", async () => {
  const material = buildCandidateMaterial(JSON.stringify(exportFixture()));
  const analysis = parseRequirementAnalysis({
    brief: { title: "Cloud Engineer", keywords: ["Azure", "Bicep"] },
    requirements: [{ id: "azure", text: "Azure and Bicep", tier: "required", status: "evidenced", evidence: [{ text: "Designed Azure landing zones using Bicep.", source: "resume" }] }],
  }, material, { jobDescription: jd });
  assert.ok(analysis);
  const draft = { summary: "Cloud engineer.", skills: [], experience: [], projects: [] };
  const ctx = { material, analysis: buildEvidenceReport(analysis), evidenceText: material.text, figureSourceText: material.text, jobDescription: jd, targetRole: "Cloud Engineer" };
  assert.ok(inspectDraft(draft, ctx).some(issue => issue.type === "missed_evidence"));
  const calls: string[] = [];
  const report = await reviewAndCorrectDraft(draft, ctx, async (_prompt, purpose) => {
    calls.push(purpose);
    return JSON.stringify(purpose === "review" ? { issues: [] } : { corrections: [{ location: "S", text: "Cloud engineer who designed Azure landing zones using Bicep." }] });
  });
  assert.deepEqual(calls, ["review", "correction"]);
  assert.ok(report.fixed.length);
  assert.match(draft.summary, /Azure/);
});

test("all active generation prompt shapes share the evidence-limited target", () => {
  const options = { targetRole: "Cloud Engineer", audience: "Recruiter", mode: "balanced", inputData: "{}" };
  assert.ok(buildResumeGenerationPrompt(options).includes(KEYWORD_TARGET_RULE));
  assert.ok(buildResumeMetaPrompt(options).includes(KEYWORD_TARGET_RULE));
  assert.ok(buildRoleBulletPrompt({ role: { role: "Engineer", company: "Example", duration: "2022 - Present" }, sourceBullets: [],
    budget: { index: 0, role: "Engineer", company: "Example", duration: "2022 - Present", min: 1, max: 2, basis: "unparseable", tenureMonths: null, label: "1-2", reason: "Test fixture" },
  }).includes(KEYWORD_TARGET_RULE));
});
