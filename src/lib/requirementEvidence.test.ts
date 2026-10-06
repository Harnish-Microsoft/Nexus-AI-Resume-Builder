import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisKeywords,
  applyRequirementEvidence,
  buildCandidateMaterial,
  buildEvidenceReport,
  buildRequirementAnalysisPrompt,
  coerceRequirementAnalysis,
  formatDocumentEvidenceBrief,
  formatRoleEvidenceBrief,
  parseRequirementAnalysis,
} from "./requirementEvidence";

const contosoBullets = [
  "Designed hub-and-spoke Azure landing zones for 14 subscriptions using Bicep.",
  "Ran on-call triage for P2 incidents and wrote recovery runbooks.",
  "Maintained Terraform modules for shared networking.",
];

const resumeText = JSON.stringify(
  {
    personal_info: { name: "Sample Candidate", summary: "Cloud infrastructure engineer." },
    experience: [
      { role: "Cloud Engineer", company: "Contoso", duration: "Jan 2021 - Present", bullets: contosoBullets },
      {
        role: "Systems Administrator",
        company: "Fabrikam",
        duration: "2018 - 2020",
        bullets: ["Patched 300 Windows servers monthly with WSUS."],
      },
    ],
    skills: { Cloud: ["Azure", "Bicep"], Tools: ["PowerShell"] },
    certifications: [{ name: "AZ-104", issuer: "Microsoft", date: "2022" }],
  },
  null,
  2
);
const notes = "Led the migration cutover weekend for the payroll system.";

const jobDescription = [
  "Senior Cloud Engineer",
  "Requirements:",
  "- 5+ years operating Azure, including landing zones",
  "- Kubernetes in production",
  "- Terraform",
  "- AZ-305 certification",
  "Nice to have:",
  "- Infrastructure as code",
].join("\n");

const reply = JSON.stringify({
  brief: {
    title: "Senior Cloud Engineer",
    seniority: "Senior",
    required_years: "5+",
    summary: "Run the Azure platform.",
    responsibilities: ["Operate Azure landing zones"],
    outcomes: [],
    keywords: ["Azure", "Kubernetes", "landing zones", "Made Up Keyword"],
  },
  requirements: [
    {
      text: "Azure landing zone design",
      tier: "required",
      kind: "experience",
      hard_gate: false,
      status: "evidenced",
      quotes: ["Designed hub-and-spoke Azure landing zones for 14 subscriptions"],
    },
    {
      text: "Incident management",
      tier: "required",
      kind: "skill",
      status: "partial",
      quotes: ["Ran on-call triage for P2 incidents"],
      note: "No incident command shown",
    },
    {
      text: "Kubernetes in production",
      tier: "required",
      kind: "skill",
      status: "evidenced",
      quotes: ["Operated AKS clusters in production"],
    },
    { text: "Terraform", tier: "required", kind: "tool", status: "evidenced", quotes: ["Maintained Terraform modules for shared networking."] },
    { text: "AZ-305 certification", tier: "required", kind: "certification", hard_gate: true, status: "not_evidenced", quotes: [] },
    {
      text: "Infrastructure as code (Terraform or Bicep)",
      tier: "preferred",
      status: "evidenced",
      quotes: ["landing zones for 14 subscriptions using Bicep", "Maintained Terraform modules"],
    },
    { text: "Cutover planning", tier: "nice-to-have", status: "evidenced", quotes: ["Led the migration cutover weekend for the payroll system"] },
    { text: "azure landing zone design", tier: "required", status: "evidenced", quotes: [] },
  ],
});

function analyse() {
  const material = buildCandidateMaterial(resumeText, notes);
  const analysis = parseRequirementAnalysis(reply, material, { jobDescription });
  assert.ok(analysis);
  return analysis;
}

test("a JSON resume is rendered section by section, every bullet attributed to its role", () => {
  const material = buildCandidateMaterial(resumeText, notes);
  assert.equal(material.structured, true);
  assert.equal(material.omitted_chars, 0);
  assert.match(material.text, /ROLE 1: Cloud Engineer \| Contoso \| Jan 2021 - Present/);
  assert.match(material.text, /CANDIDATE NOTES/);
  const bullet = material.segments.find((s) => s.text === contosoBullets[0]);
  assert.deepEqual(bullet, { text: contosoBullets[0], source: "resume", role: "Cloud Engineer", company: "Contoso" });
  assert.ok(material.segments.some((s) => s.source === "brain_dump" && s.text === notes));
});

test("free-form text becomes line segments, and an over-long material says how much was left out", () => {
  const raw = buildCandidateMaterial("Jane Doe\nCloud Engineer, Contoso\n- Built Azure landing zones");
  assert.equal(raw.structured, false);
  assert.deepEqual(raw.segments.map((s) => s.text), ["Jane Doe", "Cloud Engineer, Contoso", "- Built Azure landing zones"]);

  const long = buildCandidateMaterial(Array.from({ length: 400 }, (_, i) => `Line ${i} about Azure operations`).join("\n"), undefined, {
    limit: 2000,
  });
  assert.ok(long.omitted_chars > 0);
  assert.match(long.text, /\[\.\.\. \d+ more characters of the candidate's material not shown\]$/);
  assert.equal(long.segments.length, 400);
});

test("the analysis prompt carries the posting, the material and the exclusions", () => {
  const material = buildCandidateMaterial(resumeText, notes);
  const prompt = buildRequirementAnalysisPrompt({ jobDescription, targetRole: "Cloud Engineer", material, currentDate: "October 6, 2026" });
  assert.ok(prompt.includes(jobDescription));
  assert.ok(prompt.includes(material.text));
  assert.match(prompt, /never to claim "CI\/CD", "Pipelines", "DevOps", "Terraform"/);
  assert.match(prompt, /Docker does not prove Kubernetes/);
});

test("only quotes found in the candidate's material count as evidence", () => {
  const analysis = analyse();
  const byText = new Map(analysis.requirements.map((r) => [r.text, r]));
  assert.deepEqual(
    analysis.requirements.map((r) => [r.id, r.text, r.tier, r.status]),
    [
      ["R1", "Azure landing zone design", "required", "evidenced"],
      ["R2", "Incident management", "required", "partial"],
      ["R3", "Kubernetes in production", "required", "not_evidenced"],
      ["R4", "Terraform", "required", "excluded"],
      ["R5", "AZ-305 certification", "required", "not_evidenced"],
      ["R6", "Infrastructure as code (Terraform or Bicep)", "preferred", "partial"],
      ["R7", "Cutover planning", "preferred", "evidenced"],
    ]
  );
  assert.deepEqual(byText.get("Azure landing zone design")!.evidence, [
    { text: "Designed hub-and-spoke Azure landing zones for 14 subscriptions", source: "resume", role: "Cloud Engineer", company: "Contoso" },
  ]);
  const kubernetes = byText.get("Kubernetes in production")!;
  assert.equal(kubernetes.claimed_status, "evidenced");
  assert.deepEqual(kubernetes.evidence, []);
  assert.deepEqual(analysis.verification, { quotes_proposed: 7, quotes_verified: 6, downgraded: ["R3"] });
  assert.equal(byText.get("Cutover planning")!.evidence[0].source, "brain_dump");
  assert.equal(byText.get("AZ-305 certification")!.hard_gate, true);
});

test("an exclusion holds even when the material shows it, but other evidence still counts", () => {
  const analysis = analyse();
  const terraform = analysis.requirements.find((r) => r.text === "Terraform")!;
  assert.equal(terraform.status, "excluded");
  assert.deepEqual(terraform.evidence, []);
  const iac = analysis.requirements.find((r) => r.text.startsWith("Infrastructure as code"))!;
  assert.equal(iac.status, "partial");
  assert.deepEqual(iac.evidence.map((q) => q.text), ["landing zones for 14 subscriptions using Bicep"]);
  assert.match(iac.note || "", /don't claim Terraform/);
});

test("the brief is sanitized and its keywords must occur in the posting", () => {
  const { brief } = analyse();
  assert.equal(brief.required_years, 5);
  assert.deepEqual(brief.keywords, ["Azure", "Kubernetes", "landing zones"]);
  assert.deepEqual(analysisKeywords(analyse()), [
    "Azure",
    "Kubernetes",
    "landing zones",
    "Azure landing zone design",
    "Incident management",
    "Kubernetes in production",
    "Terraform",
    "AZ-305 certification",
    "Cutover planning",
  ]);
});

test("a drifted copy verifies only against one real segment, and keeps the real text", () => {
  const material = buildCandidateMaterial(resumeText, notes);
  const drifted = JSON.stringify({
    requirements: [
      {
        text: "Azure landing zones",
        status: "evidenced",
        quotes: ["Designed Azure landing zones for 14 subscriptions using Bicep"],
      },
      { text: "Incident management", status: "evidenced", quotes: ["and"] },
      { text: "Change management", status: "evidenced", quotes: ["PowerShell"] },
    ],
  });
  const analysis = parseRequirementAnalysis(drifted, material)!;
  assert.deepEqual(analysis.requirements[0].evidence.map((q) => q.text), [contosoBullets[0]]);
  assert.equal(analysis.requirements[1].status, "not_evidenced");
  assert.equal(analysis.requirements[2].status, "not_evidenced");
});

test("unusable replies give no analysis", () => {
  const material = buildCandidateMaterial(resumeText);
  assert.equal(parseRequirementAnalysis("not json", material), null);
  assert.equal(parseRequirementAnalysis(JSON.stringify({ requirements: [] }), material), null);
  assert.equal(parseRequirementAnalysis("```json\n[1, 2]\n```", material), null);
});

test("a copy that changes the claimed skill, figure or credential is not evidence", () => {
  const material = buildCandidateMaterial(
    JSON.stringify({
      experience: [
        {
          role: "Platform Engineer",
          company: "Contoso",
          duration: "2020 - Present",
          bullets: [
            "Deployed Docker containers for 12 production services using Helm charts on Azure.",
            "Managed a team of four engineers supporting the billing platform.",
          ],
        },
      ],
      certifications: [{ name: "AZ-104", issuer: "Microsoft", date: "2022" }],
    })
  );
  const analysis = parseRequirementAnalysis(
    JSON.stringify({
      requirements: [
        {
          text: "Kubernetes in production",
          status: "evidenced",
          quotes: ["Deployed Kubernetes containers for 12 production services using Helm charts on Azure."],
        },
        { text: "Led a team of ten engineers", status: "evidenced", quotes: ["Managed a team of ten engineers supporting the billing platform."] },
        { text: "AZ-500 Azure Security Engineer certification", kind: "certification", hard_gate: true, status: "evidenced", quotes: ["AZ-104"] },
        { text: "AZ-500 Azure Security Engineer certification (repeat)", status: "evidenced", quotes: ["Azure"] },
        { text: "Helm", status: "evidenced", quotes: ["Deployed Docker containers for production services using Helm charts on Azure"] },
      ],
    }),
    material
  )!;
  assert.deepEqual(
    analysis.requirements.map((r) => [r.text, r.status]),
    [
      ["Kubernetes in production", "not_evidenced"],
      ["Led a team of ten engineers", "not_evidenced"],
      ["AZ-500 Azure Security Engineer certification", "not_evidenced"],
      ["AZ-500 Azure Security Engineer certification (repeat)", "not_evidenced"],
      ["Helm", "evidenced"],
    ]
  );
  assert.equal(
    analysis.requirements[4].evidence[0].text,
    "Deployed Docker containers for 12 production services using Helm charts on Azure.",
    "a copy that only dropped words keeps the real bullet"
  );
  assert.deepEqual(buildEvidenceReport(analysis).hard_gaps, ["AZ-500 Azure Security Engineer certification"]);
});

test("a held certification stays evidenced even when its name contains an excluded word", () => {
  const certificationName = "Microsoft Certified: DevOps Engineer Expert (AZ-400)";
  const build = (extra: Record<string, unknown> = {}) =>
    buildCandidateMaterial(
      JSON.stringify({
        experience: [{ role: "Engineer", company: "Contoso", duration: "2020 - Present", bullets: ["Ran Azure release reviews."] }],
        certifications: [{ name: certificationName, issuer: "Microsoft", date: "2023" }],
        ...extra,
      })
    );
  const reply = (quote: string) =>
    JSON.stringify({
      requirements: [
        { text: "AZ-400 DevOps Engineer Expert certification", kind: "certification", hard_gate: true, status: "evidenced", quotes: [quote] },
        { text: "DevOps experience", kind: "experience", status: "evidenced", quotes: [quote] },
      ],
    });
  const analysis = parseRequirementAnalysis(reply(certificationName), build())!;
  const [certification, skill] = analysis.requirements;
  assert.equal(certification.status, "evidenced");
  assert.equal(certification.evidence[0].verbatim, true);
  assert.match(certification.note || "", /stays verbatim; you still don't claim DevOps as a skill/);
  assert.equal(skill.status, "excluded", "holding the certificate is not a claim to the skill");
  const report = buildEvidenceReport(analysis);
  assert.deepEqual(report.hard_gaps, []);
  assert.doesNotMatch(formatDocumentEvidenceBrief(analysis), /EXCLUDED BY THE CANDIDATE[^\n]*\n  \[R1/);

  const reloaded = coerceRequirementAnalysis(JSON.parse(JSON.stringify(report)))!;
  assert.equal(reloaded.requirements[0].status, "evidenced", "the exemption survives a round trip");

  // The same name repeated in the summary or skills still resolves to the certification entry.
  for (const extra of [{ summary: `${certificationName} holder.` }, { skills: [certificationName] }, { summary: "AZ-400 certified engineer." }]) {
    for (const quote of [certificationName, "AZ-400"]) {
      const repeated = parseRequirementAnalysis(reply(quote), build(extra))!;
      assert.equal(repeated.requirements[0].status, "evidenced", `${JSON.stringify(extra)} / ${quote}`);
    }
  }
});

test("only a certifications section of pasted text counts as a held credential", () => {
  const pasted = [
    "Jane Doe",
    "Experience",
    "Certified 30 engineers on Azure DevOps pipelines during the platform rollout.",
    "Licenses & Certifications",
    "Microsoft Certified: DevOps Engineer Expert (AZ-400)",
    "Education",
    "BSc Computer Science",
  ].join("\n");
  const material = buildCandidateMaterial(pasted);
  const verbatim = material.segments.filter((s) => s.verbatim).map((s) => s.text);
  assert.deepEqual(verbatim, ["Microsoft Certified: DevOps Engineer Expert (AZ-400)"]);
  assert.equal(buildCandidateMaterial("Certifications: AZ-104, AZ-305").segments[0].verbatim, true);

  const fromBullet = parseRequirementAnalysis(
    JSON.stringify({
      requirements: [
        {
          text: "Azure DevOps certification (AZ-400)",
          kind: "certification",
          status: "evidenced",
          quotes: ["Certified 30 engineers on Azure DevOps pipelines during the platform rollout."],
        },
      ],
    }),
    material
  )!;
  assert.equal(fromBullet.requirements[0].status, "excluded", "a bullet saying 'certified' is not a credential");
});

test("a credential quoted by its acronym is evidence, but only from a certification entry", () => {
  const material = buildCandidateMaterial(
    JSON.stringify({
      experience: [{ role: "Engineer", company: "Contoso", duration: "2019 - Present", bullets: ["Studying for the CKAD exam this year."] }],
      certifications: ["CISSP", "PMP", "CompTIA Security+", "CKA", "ITIL Foundation"],
    })
  );
  const statusOf = (text: string, quote: string, kind = "certification") =>
    parseRequirementAnalysis(JSON.stringify({ requirements: [{ text, kind, status: "evidenced", quotes: [quote] }] }), material)!
      .requirements[0].status;
  assert.equal(statusOf("CISSP certification", "CISSP"), "evidenced");
  assert.equal(statusOf("PMP certification required", "PMP"), "evidenced");
  assert.equal(statusOf("Security+ certification", "CompTIA Security+"), "evidenced");
  assert.equal(statusOf("Certified Kubernetes Administrator (CKA)", "CKA"), "evidenced");
  assert.equal(statusOf("ITIL certification", "ITIL Foundation"), "evidenced");
  assert.equal(statusOf("Certified Kubernetes Application Developer (CKAD)", "CKAD"), "not_evidenced", "a bullet is not a held credential");
  assert.equal(statusOf("Kubernetes administration", "CKA", "skill"), "not_evidenced", "an acronym proves only the credential");

  const pasted = buildCandidateMaterial("Jane Doe\nCertifications: CISSP, PMP");
  const fromInline = parseRequirementAnalysis(
    JSON.stringify({ requirements: [{ text: "CISSP certification", kind: "certification", status: "evidenced", quotes: ["CISSP"] }] }),
    pasted
  )!;
  assert.equal(fromInline.requirements[0].status, "evidenced");
});

test("certifications sections open on any certifications heading and close on the next heading", () => {
  const certificationLine = "Microsoft Certified: DevOps Engineer Expert (AZ-400)";
  for (const heading of ["CERTIFICATIONS", "Licenses & Certifications", "Professional Certifications", "Certifications & Training", "Education & Certifications", "## Certifications"]) {
    const material = buildCandidateMaterial(["Jane Doe", heading, certificationLine].join("\n"));
    assert.deepEqual(material.segments.filter((s) => s.verbatim).map((s) => s.text), [certificationLine], heading);
  }

  const terraformBullet = "- Built Terraform modules for 30 Azure landing zones";
  for (const heading of ["EXPERIENCE", "Work Experience", "Career History", "Relevant Experience", "Professional Background", "Volunteer Experience", "Experience:"]) {
    const material = buildCandidateMaterial(
      ["CERTIFICATIONS", "AZ-104: Microsoft Azure Administrator", heading, "Cloud Engineer, Contoso, 2020 - Present", terraformBullet].join("\n")
    );
    assert.deepEqual(
      material.segments.filter((s) => s.verbatim).map((s) => s.text),
      ["AZ-104: Microsoft Azure Administrator"],
      heading
    );
    const analysis = parseRequirementAnalysis(
      JSON.stringify({
        requirements: [{ text: "HashiCorp Terraform Associate certification", kind: "certification", status: "evidenced", quotes: [terraformBullet] }],
      }),
      material
    )!;
    assert.equal(analysis.requirements[0].status, "excluded", heading);
  }
});

test("a held credential must name the requirement, even inside a certifications section", () => {
  const material = buildCandidateMaterial(
    ["Certifications", "Built Terraform modules for 30 Azure landing zones", "HashiCorp Certified: Terraform Associate (003)"].join("\n")
  );
  const parse = (quote: string) =>
    parseRequirementAnalysis(
      JSON.stringify({
        requirements: [{ text: "HashiCorp Terraform Associate certification", kind: "certification", status: "evidenced", quotes: [quote] }],
      }),
      material
    )!.requirements[0].status;
  assert.equal(parse("Built Terraform modules for 30 Azure landing zones"), "excluded");
  assert.equal(parse("HashiCorp Certified: Terraform Associate (003)"), "evidenced");
});

test("short quotes: years at or above the minimum, and one whole option of an either/or requirement", () => {
  const material = buildCandidateMaterial(
    JSON.stringify({
      summary: "Infrastructure engineer with 16+ years of experience.",
      experience: [{ role: "Engineer", company: "Contoso", duration: "2008 - Present", bullets: ["Wrote Python tooling for patching."] }],
      skills: ["Python", "AZ-104"],
    })
  );
  const statusOf = (text: string, quote: string) =>
    parseRequirementAnalysis(JSON.stringify({ requirements: [{ text, status: "evidenced", quotes: [quote] }] }), material)!
      .requirements[0].status;
  assert.equal(statusOf("5+ years of experience", "16+ years"), "evidenced");
  assert.equal(statusOf("20+ years of experience", "16+ years"), "not_evidenced");
  assert.equal(statusOf("Python, PowerShell or Bash scripting", "Python"), "evidenced");
  assert.equal(statusOf("Python and Bash scripting", "Python"), "not_evidenced");
  assert.equal(statusOf("AZ-500 certification", "AZ-104"), "not_evidenced");
});

test("a range of years is read as its minimum", () => {
  const material = buildCandidateMaterial(resumeText);
  const withYears = (required_years: unknown) =>
    parseRequirementAnalysis(
      JSON.stringify({ brief: { required_years }, requirements: [{ text: "Azure", status: "not_evidenced" }] }),
      material
    )!.brief.required_years;
  assert.equal(withYears("3-5"), 3);
  assert.equal(withYears("2\u20134 years"), 2);
  assert.equal(withYears("5+"), 5);
  assert.equal(withYears(7), 7);
  assert.equal(withYears("several"), null);
  assert.equal(withYears(60), null);
});

test("the candidate's other resumes are admissible evidence, attributed as such", () => {
  const material = buildCandidateMaterial(resumeText, undefined, {
    otherResumes: [
      {
        name: "Platform resume",
        data: {
          experience: [
            {
              role: "Cloud Engineer",
              company: "Contoso",
              duration: "Jan 2021 - Present",
              bullets: ["Reduced Azure spend 22% by rightsizing 300 VMs."],
            },
          ],
        },
      },
      "not a resume",
    ],
  });
  assert.match(material.text, /OTHER RESUME VERSION 1 \("Platform resume"\) - the candidate's own:\n  ROLE 1: Cloud Engineer/);
  const analysis = parseRequirementAnalysis(
    JSON.stringify({
      requirements: [{ text: "Azure cost optimization", status: "evidenced", quotes: ["Reduced Azure spend 22% by rightsizing 300 VMs"] }],
    }),
    material
  )!;
  assert.deepEqual(analysis.requirements[0].evidence, [
    { text: "Reduced Azure spend 22% by rightsizing 300 VMs", source: "other_resume", role: "Cloud Engineer", company: "Contoso" },
  ]);
  assert.match(formatDocumentEvidenceBrief(analysis), /\(candidate's other resume, Cloud Engineer @ Contoso\)/);
  assert.equal(formatRoleEvidenceBrief(analysis, contosoBullets).includes("Azure cost optimization"), false);
});

test("the document brief leads with proof and names what must never be claimed", () => {
  const brief = formatDocumentEvidenceBrief(analyse());
  assert.match(brief, /Title: Senior Cloud Engineer \| Seniority: Senior \| Minimum experience: 5 years/);
  assert.match(brief, /PROVEN - feature these prominently[^\n]*\n  \[R1, required\] Azure landing zone design\n      evidence: "Designed hub-and-spoke Azure landing zones for 14 subscriptions" \(Cloud Engineer @ Contoso\)/);
  assert.match(brief, /PARTIAL - claim only what the evidence shows/);
  assert.match(brief, /NOT EVIDENCED[^\n]*\n  \[R3, required\] Kubernetes in production\n  \[R5, required, eligibility gate\] AZ-305 certification/);
  assert.match(brief, /EXCLUDED BY THE CANDIDATE[^\n]*\n  \[R4, required\] Terraform/);
  assert.equal(formatDocumentEvidenceBrief(null), "");
});

test("each role is told which requirements its own bullets prove", () => {
  const analysis = analyse();
  const contoso = formatRoleEvidenceBrief(analysis, contosoBullets);
  assert.match(contoso, /\[R1, required\] Azure landing zone design - source bullet 1\n/);
  assert.match(contoso, /\[R2, required\] Incident management - source bullet 2 \(partial: No incident command shown\)/);
  assert.match(contoso, /\[R6, preferred\] Infrastructure as code \(Terraform or Bicep\) - source bullet 1/);
  assert.match(contoso, /Never claim in this role[^\n]*\n  Kubernetes in production; Terraform; AZ-305 certification/);

  const fabrikam = formatRoleEvidenceBrief(analysis, ["Patched 300 Windows servers monthly with WSUS."]);
  assert.match(fabrikam, /None of the posting's requirements is evidenced by this role's source bullets/);
  assert.equal(formatRoleEvidenceBrief(null, contosoBullets), "");
});

test("the report separates what is proven from what is missing", () => {
  const report = buildEvidenceReport(analyse());
  assert.deepEqual(report.required, { total: 5, evidenced: 1, partial: 1, not_evidenced: 2, excluded: 1 });
  assert.deepEqual(report.preferred, { total: 2, evidenced: 1, partial: 1, not_evidenced: 0, excluded: 0 });
  // (1 + 0.5 + 0.5 * 1 + 0.5 * 0.5) / (5 + 2 * 0.5) = 37.5%
  assert.equal(report.qualification_evidence, 38);
  assert.deepEqual(report.hard_gaps, ["AZ-305 certification"]);
});

test("the report survives a round trip through JSON and is rebuilt identically", () => {
  const resume: any = {};
  applyRequirementEvidence(resume, analyse());
  const first = JSON.stringify(resume.requirement_evidence);
  const reloaded = JSON.parse(JSON.stringify(resume));
  applyRequirementEvidence(reloaded);
  assert.equal(JSON.stringify(reloaded.requirement_evidence), first);
  applyRequirementEvidence(reloaded, null);
  assert.equal(reloaded.requirement_evidence, undefined);
});

test("a forged report cannot claim evidence it does not carry, or an excluded capability", () => {
  const coerced = coerceRequirementAnalysis({
    requirements: [
      { text: "Kubernetes", tier: "required", status: "evidenced", evidence: [] },
      { text: "Terraform", tier: "required", status: "evidenced", evidence: [{ text: "Wrote Terraform", source: "resume" }] },
      { text: "Azure DevOps or Bicep", tier: "preferred", status: "evidenced", evidence: [{ text: "Deployed Bicep templates", source: "resume" }] },
      { text: "", status: "evidenced" },
    ],
  })!;
  assert.deepEqual(
    coerced.requirements.map((r) => [r.text, r.status]),
    [
      ["Kubernetes", "not_evidenced"],
      ["Terraform", "excluded"],
      ["Azure DevOps or Bicep", "partial"],
    ]
  );
  assert.equal(coerceRequirementAnalysis({ requirements: "nope" }), null);
});
