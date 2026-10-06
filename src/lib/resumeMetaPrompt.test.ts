import assert from "node:assert/strict";
import test from "node:test";
import { buildResumeGenerationPrompt, buildResumeMetaPrompt, buildRoleBulletPrompt } from "./resumePrompt";
import type { ResumePromptOptions } from "./resumePrompt";
import { computeBulletBudgets } from "./bulletBudget";

const source = {
  personal_info: { name: "Sample Candidate", email: "candidate@example.com" },
  summary: "Infrastructure specialist",
  skills: ["Azure", "Monitoring"],
  experience: [
    {
      id: "role_1",
      role: "Infrastructure Engineer",
      company: "Example Current",
      duration: "2022 - Present",
      original_bullets: ["Configured Azure monitoring alerts for production incidents."],
    },
    {
      id: "role_2",
      role: "IT Analyst",
      company: "Example Previous",
      duration: "2020 - 2022",
      original_bullets: ["Resolved service desk escalations and documented recovery procedures."],
    },
  ],
  projects: [{ title: "Alert Review", description: "Reviewed alert routing." }],
  education: [{ degree: "BSc", institution: "Example University" }],
  certifications: [{ name: "Azure Fundamentals", issuer: "Microsoft", date: "2021" }],
};

const options: ResumePromptOptions = {
  targetRole: "Cloud Engineer",
  targetCompany: "Microsoft",
  audience: "Technical hiring managers",
  audienceBrief: "Emphasize operational decisions for technical readers.",
  mode: "balanced",
  inputData: JSON.stringify(source, null, 2),
  inputLabel: "INPUT DATA (structured, pre-extracted and trimmed)",
  jobDescription: "Operate Azure services. Prioritize incident recovery and cross-team coordination.",
  jdKeywords: ["Azure"],
  customPrompt: "Do not imply Terraform proficiency.",
  brainDump: "Documented alert routing for the current infrastructure role.",
  masterResumes: [{ summary: "Infrastructure operations background." }],
  trendBrief: "Only use supported trending skills.",
};

test("meta and whole-document prompts receive the same JD and complete source evidence", () => {
  for (const prompt of [buildResumeMetaPrompt(options), buildResumeGenerationPrompt(options)]) {
    assert.ok(prompt.includes(options.jobDescription!));
    assert.ok(prompt.includes(options.inputData));
    assert.ok(prompt.includes(options.customPrompt!));
    assert.ok(prompt.includes(options.audienceBrief!));
    assert.ok(prompt.includes(options.brainDump!));
    assert.ok(prompt.includes(options.trendBrief!));
    assert.ok(prompt.includes(JSON.stringify(options.masterResumes![0])));
    assert.ok(prompt.includes("TARGET COMPANY: Microsoft"));
  }
});

test("same keywords do not collapse different postings into identical meta prompts", () => {
  const changed = {
    ...options,
    jobDescription: "Operate Azure services. Prioritize cost governance and stakeholder reporting.",
  };
  const first = buildResumeMetaPrompt(options);
  const second = buildResumeMetaPrompt(changed);
  assert.notEqual(first, second);
  assert.ok(second.includes(changed.jobDescription));
  assert.ok(!second.includes(options.jobDescription!));
  assert.ok(second.includes(options.inputData));
  assert.match(second, /Read the supplied job description, not just the keyword list/);
});

test("each role receives the same posting and its own evidence as the meta call", () => {
  const budgets = computeBulletBudgets(source.experience);
  const meta = buildResumeMetaPrompt(options);
  source.experience.forEach((role, index) => {
    const prompt = buildRoleBulletPrompt({
      ...options,
      role,
      sourceBullets: role.original_bullets,
      budget: budgets[index],
    });
    assert.ok(prompt.includes(options.jobDescription!));
    for (const bullet of role.original_bullets) {
      assert.ok(prompt.includes(bullet));
      assert.ok(meta.includes(bullet));
    }
  });
});

test("meta output preserves exclusions, evidence boundaries and the existing section contract", () => {
  const prompt = buildResumeMetaPrompt(options);
  assert.match(prompt, /ABSOLUTELY FORBIDDEN: "CI\/CD", "Pipelines", "DevOps"/);
  assert.match(prompt, /exclusions override JD vocabulary and custom instructions/);
  assert.match(prompt, /Do not disguise an\s+unsupported capability with a synonym/);
  assert.match(prompt, /instructions, not evidence/);
  assert.match(prompt, /Missing requirements belong in\s+"keyword_gap"/);
  assert.match(prompt, /experience is context, not an output section/);
  const schema = JSON.parse(prompt.split("OUTPUT JSON SCHEMA:\n")[1].split("\nReturn ONE")[0]);
  assert.equal(schema.match_score, null);
  assert.equal(Object.keys(schema.skills).length, 4);
  assert.ok("projects" in schema && "education" in schema && "certifications" in schema);
  assert.ok(!("experience" in schema) && !("star_stories" in schema));
});

test("minimal meta input does not emit undefined values or unused context sections", () => {
  const prompt = buildResumeMetaPrompt({
    targetRole: "IT Analyst",
    audience: "Recruiters",
    mode: "conservative",
    inputData: JSON.stringify(source),
  });
  assert.ok(!prompt.includes("undefined"));
  assert.ok(!prompt.includes("CUSTOM INSTRUCTIONS"));
  assert.ok(!prompt.includes("BRAIN DUMP"));
  assert.ok(!prompt.includes("SUPPORTING REFERENCE"));
  assert.ok(!prompt.includes("Priority JD keywords:"));
  assert.ok(prompt.includes("TARGET COMPANY: General Product Tech"));
});
