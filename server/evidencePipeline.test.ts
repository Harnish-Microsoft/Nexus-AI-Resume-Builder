import assert from "node:assert/strict";
import test from "node:test";
import { structuredResumeFromText, trimContentForAI } from "./optimization";
import { prepareRoleJobs, validateRoleOutput } from "./roleGenerator";
import { buildRoleBulletPrompt } from "../src/lib/resumePrompt";
import { coerceRequirementAnalysis } from "../src/lib/requirementEvidence";

const master = {
  personal_info: { name: "Sample Candidate", email: "candidate@example.com", summary: "Infrastructure engineer." },
  experience: [
    {
      id: "1",
      company: "Contoso",
      role: "Cloud Engineer",
      duration: "Jan 2021 - Present",
      bullets: ["Designed Azure landing zones for 14 subscriptions using Bicep.", "Ran on-call triage for P2 incidents."],
    },
    { company: "Fabrikam", title: "Systems Administrator", duration: "2017 - 2020", description: "Patched Windows servers." },
  ],
  skills: { infrastructure: ["Azure", "Bicep"], devsecops: "Defender, Sentinel" },
  projects: ["Homelab", { title: "Alert Review", description: "Reviewed alert routing." }],
  education: ["BSc Computer Science"],
  certifications: [{ name: "AZ-104", issuer: "Microsoft", date: "2022" }],
};

test("a JSON master resume is read in code: every role and bullet exactly as written", () => {
  const structured = structuredResumeFromText(JSON.stringify(master, null, 2));
  assert.equal(structured.summary, "Infrastructure engineer.");
  assert.deepEqual(structured.skills, ["Azure", "Bicep", "Defender", "Sentinel"]);
  assert.deepEqual(structured.experience, [
    {
      role: "Cloud Engineer",
      company: "Contoso",
      duration: "Jan 2021 - Present",
      achievements: master.experience[0].bullets,
    },
    { role: "Systems Administrator", company: "Fabrikam", duration: "2017 - 2020", achievements: ["Patched Windows servers."] },
  ]);
  assert.deepEqual(structured.projects, [
    { title: "Homelab", description: "" },
    { title: "Alert Review", description: "Reviewed alert routing." },
  ]);
  assert.deepEqual(structured.certifications, master.certifications);

  const prepared = trimContentForAI(structured, ["Azure"]);
  assert.deepEqual(prepared.experience.map((role: any) => role.original_bullets), [
    master.experience[0].bullets,
    ["Patched Windows servers."],
  ]);
});

test("free-form text, and JSON without roles or recognisable bullets, still go through extraction", () => {
  assert.equal(structuredResumeFromText("Jane Doe\nCloud Engineer at Contoso"), null);
  assert.equal(structuredResumeFromText(JSON.stringify({ skills: ["Azure"] })), null);
  assert.equal(structuredResumeFromText("{ not json"), null);
  assert.equal(
    structuredResumeFromText(JSON.stringify({ experience: [{ role: "Engineer", company: "Contoso", responsibilities: ["Ran Azure"] }] })),
    null
  );
});

test("a bullet naming an excluded capability is sent back for correction", () => {
  const { jobs } = prepareRoleJobs(
    [{ role: "Engineer", company: "Contoso", duration: "Jan 2020 - Present", original_bullets: ["Maintained Terraform modules."] }],
    {},
    {}
  );
  const validation = validateRoleOutput(
    { bullets: ["Maintained Terraform modules for shared networking."], star_stories: [] },
    jobs[0].budget,
    jobs[0].validation
  );
  assert.ok(validation.hard.some((issue) => /names "Terraform", which the candidate has excluded/.test(issue)));
});

test("each role prompt carries its own verified evidence and the exclusion rule exactly once", () => {
  const analysis = coerceRequirementAnalysis({
    requirements: [
      {
        text: "Azure landing zones",
        tier: "required",
        status: "evidenced",
        evidence: [{ text: "Designed Azure landing zones for 14 subscriptions", source: "resume" }],
      },
      { text: "Kubernetes in production", tier: "required", status: "not_evidenced", evidence: [] },
    ],
  });
  const { jobs } = prepareRoleJobs(
    [
      { role: "Cloud Engineer", company: "Contoso", duration: "Jan 2021 - Present", original_bullets: master.experience[0].bullets },
      { role: "Systems Administrator", company: "Fabrikam", duration: "2017 - 2020", original_bullets: ["Patched Windows servers."] },
    ],
    { targetRole: "Cloud Engineer" },
    { requirementAnalysis: analysis }
  );
  const first = buildRoleBulletPrompt(jobs[0].prompt);
  assert.match(first, /POSTING REQUIREMENTS THIS ROLE PROVES/);
  assert.match(first, /\[R1, required\] Azure landing zones - source bullet 1/);
  assert.match(first, /Never claim in this role[^\n]*\n  Kubernetes in production/);
  assert.match(first, /The POSTING REQUIREMENTS THIS ROLE PROVES section above is authoritative/);
  assert.equal(first.match(/CANDIDATE EXCLUSIONS/g)?.length, 1);

  const second = buildRoleBulletPrompt(jobs[1].prompt);
  assert.match(second, /None of the posting's requirements is evidenced by this role's source bullets/);

  const withoutAnalysis = prepareRoleJobs([{ role: "Engineer", company: "Contoso", original_bullets: ["Ran triage."] }], {}, {});
  const plain = buildRoleBulletPrompt(withoutAnalysis.jobs[0].prompt);
  assert.doesNotMatch(plain, /POSTING REQUIREMENTS THIS ROLE PROVES/);
  assert.match(plain, /CANDIDATE EXCLUSIONS/);
});
