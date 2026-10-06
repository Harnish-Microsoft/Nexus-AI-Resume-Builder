import assert from "node:assert/strict";
import test from "node:test";
import {
  applyExclusionGuarantee,
  buildCorrectionPrompt,
  buildDraftReviewPrompt,
  inspectDraft,
  refreshVerificationReport,
  reviewAndCorrectDraft,
} from "./draftReview";
import type { DraftModelCall, DraftReviewContext } from "./draftReview";
import { deleteSegments, readSegment, resumeSegments, writeSegment } from "./resumeSegments";

const source = JSON.stringify({
  experience: [
    {
      role: "Cloud Engineer",
      company: "Contoso",
      duration: "2021 - Present",
      bullets: [
        "Designed Azure landing zones for 14 subscriptions using Bicep.",
        "Ran on-call triage for P2 incidents.",
        "Maintained Terraform modules for shared networking.",
      ],
    },
  ],
  skills: { Cloud: ["Azure", "Bicep"] },
});

const jobDescription = [
  "Senior Cloud Engineer",
  "Requirements:",
  "- Azure landing zones",
  "- Kubernetes (AKS) in production",
  "- Terraform",
  "- Incident management",
].join("\n");

const ctx: DraftReviewContext = {
  figureSourceText: source,
  evidenceText: source,
  jobDescription,
  targetRole: "Cloud Engineer",
};

function draft(): any {
  return {
    summary: "Cloud engineer with Kubernetes expertise and a record of DevOps delivery.",
    skills: { "DevOps & Automation": ["Azure DevOps", "Bicep"], Cloud: ["Azure", "Kubernetes", "Ansible"] },
    experience: [
      {
        role: "Cloud Engineer",
        company: "Contoso",
        duration: "2021 - Present",
        bullets: [
          "Designed Azure landing zones for 14 subscriptions using Bicep.",
          "Cut incident volume by 45% through on-call triage.",
          "Built Terraform modules for shared networking.",
        ],
      },
    ],
    projects: [],
  };
}

function found(issues: { location: string; type: string }[]): string[] {
  return issues.map((issue) => `${issue.location}:${issue.type}`).sort();
}

test("segments address every editable part, and never titles, dates or certifications", () => {
  const resume: any = {
    summary: "S",
    why_this_job: "W",
    skills: { A: ["x", "y"], B: "z" },
    experience: [{ role: "R", company: "C", duration: "2020", bullets: ["b1", "b2"] }],
    projects: [{ title: "T", description: "D" }, "plain"],
    education: [{ degree: "BSc" }],
    certifications: ["AZ-104"],
  };
  assert.deepEqual(
    resumeSegments(resume).map((s) => s.id),
    ["S", "W", "KC1", "K1.1", "K1.2", "KC2", "K2.1", "E1.1", "E1.2", "PT1", "P1", "P2"]
  );
  assert.equal(readSegment(resume, "E1.2"), "b2");
  assert.ok(writeSegment(resume, "KC1", "Renamed"));
  assert.deepEqual(Object.keys(resume.skills), ["Renamed", "B"]);
  assert.equal(writeSegment(resume, "KC1", "B"), false, "never renamed onto an existing category");
  resume.skills.B = ["z"];
  assert.equal(writeSegment(resume, "KC1", "B"), false, "not even one it could merge with: that would shift addresses");
  assert.ok(writeSegment(resume, "P2", "plain, rewritten"));
  assert.equal(resume.projects[1], "plain, rewritten");
  assert.equal(writeSegment(resume, "E9.1", "x"), false);
  assert.deepEqual(deleteSegments(resume, ["E1.1", "E1.2"]), ["E1.2"], "a role always keeps one bullet");
  assert.deepEqual(resume.experience[0].bullets, ["b1"]);
});

test("code finds exclusions, unverified figures, and posting terms or skills the material never mentions", () => {
  assert.deepEqual(found(inspectDraft(draft(), ctx)), [
    "E1.2:unsupported_figure",
    "E1.3:excluded_term",
    "K1.1:excluded_term",
    "K2.2:unsupported_term",
    "K2.3:unsupported_skill",
    "KC1:excluded_term",
    "S:excluded_term",
    "S:unsupported_term",
  ]);
});

test("the review and correction prompts carry the material, the draft ids and what code already found", () => {
  const resume = draft();
  const known = inspectDraft(resume, ctx);
  const review = buildDraftReviewPrompt(resume, ctx, known);
  assert.match(review, /=== ALREADY FOUND BY CODE \(do not repeat\) ===\n- \[S\] excluded_term/);
  assert.match(review, /\[E1\.2\] Cloud Engineer @ Contoso, bullet 2: Cut incident volume by 45% through on-call triage\./);
  assert.ok(review.includes(source));
  assert.doesNotMatch(review, /missed_evidence/, "no evidence map, so nothing to have missed");

  const correction = buildCorrectionPrompt(resume, ctx, known);
  assert.match(correction, /\[E1\.3\] Cloud Engineer @ Contoso, bullet 3 - one bullet\n  current: "Built Terraform modules for shared networking\."/);
  assert.match(correction, /CANDIDATE EXCLUSIONS/);
  assert.doesNotMatch(correction, /\[E1\.1\]/, "only flagged items are sent");
});

test("one review and one correction fix flagged items only, each re-checked in code", async () => {
  const resume = draft();
  const calls: string[] = [];
  const call: DraftModelCall = async (_prompt, purpose) => {
    calls.push(purpose);
    if (purpose === "review") {
      return JSON.stringify({
        issues: [
          { location: "E1.1", type: "unsupported_claim", problem: "Claims design authority the source does not show.", fix: "Say what was built." },
          { location: "Z9", type: "unsupported_claim", problem: "Points nowhere." },
        ],
      });
    }
    return JSON.stringify({
      corrections: [
        { location: "S", text: "Cloud engineer who designed Azure landing zones with Bicep and ran on-call incident triage." },
        { location: "E1.2", text: "Ran on-call triage for P2 incidents." },
        { location: "E1.3", text: "Maintained Terraform-free networking modules." },
        { location: "K2.3", text: "" },
        { location: "K2.2", text: "Kubernetes" },
        { location: "E1.1", text: "Designed Azure landing zones for 99 subscriptions using Bicep." },
        { location: "W", text: "Not flagged, so ignored." },
      ],
    });
  };

  const report = await reviewAndCorrectDraft(resume, ctx, call);
  assert.deepEqual(calls, ["review", "correction"]);
  assert.equal(report.ai_review, "completed");
  assert.equal(report.corrections, "applied");
  assert.equal(report.issues_found, 9);

  assert.equal(resume.summary, "Cloud engineer who designed Azure landing zones with Bicep and ran on-call incident triage.");
  assert.equal(resume.why_this_job, undefined);
  // The Terraform rewrite was rejected; the exclusion guarantee then dropped the bullet.
  assert.deepEqual(resume.experience[0].bullets, [
    "Designed Azure landing zones for 14 subscriptions using Bicep.",
    "Ran on-call triage for P2 incidents.",
  ]);
  assert.deepEqual(resume.skills, {
    "Infrastructure Operations & Automation": ["Bicep"],
    Cloud: ["Azure", "Kubernetes"],
  });

  assert.deepEqual(report.fixed.map((fix) => fix.location).sort(), ["E1.2", "K2.3", "S"]);
  assert.equal(report.fixed.find((fix) => fix.location === "K2.3")!.after, "");
  assert.ok(report.removed.some((item) => item.text === "Built Terraform modules for shared networking."));
  assert.ok(report.removed.some((item) => item.text === "Azure DevOps"));
  assert.deepEqual(
    report.remaining.map((issue) => `${issue.location}:${issue.type}:${issue.text}`),
    [
      "K2.2:unsupported_term:Kubernetes",
      "E1.1:unsupported_claim:Designed Azure landing zones for 14 subscriptions using Bicep.",
    ]
  );
});

test("a failing model degrades to the checks in code, and the exclusions still hold", async () => {
  const resume = draft();
  const report = await reviewAndCorrectDraft(resume, ctx, async () => {
    throw new Error("quota exhausted");
  });
  assert.equal(report.ai_review, "failed");
  assert.equal(report.corrections, "failed");
  assert.doesNotMatch(JSON.stringify(resume.skills), /devops/i);
  assert.ok(!resume.experience[0].bullets.some((bullet: string) => /terraform/i.test(bullet)));
  assert.ok(report.remaining.some((issue) => issue.type === "unsupported_figure"));
});

test("a reply that is not JSON fails the review without stopping the corrections", async () => {
  const purposes: string[] = [];
  const report = await reviewAndCorrectDraft(draft(), ctx, async (_prompt, purpose) => {
    purposes.push(purpose);
    return purpose === "review" ? "Looks great to me!" : JSON.stringify({ corrections: [] });
  });
  assert.deepEqual(purposes, ["review", "correction"]);
  assert.equal(report.ai_review, "failed");
  assert.equal(report.corrections, "applied");
});

test("fast mode runs only the checks in code", async () => {
  const report = await reviewAndCorrectDraft(draft(), ctx, null);
  assert.equal(report.ai_review, "skipped");
  assert.equal(report.corrections, "skipped");
  assert.equal(report.issues_found, 8);
  assert.deepEqual(report.fixed, []);
});

test("a clean draft needs no correction call", async () => {
  const clean = {
    summary: "Cloud engineer who designed Azure landing zones with Bicep.",
    skills: { Cloud: ["Azure", "Bicep"] },
    experience: [{ role: "Cloud Engineer", company: "Contoso", bullets: ["Designed Azure landing zones for 14 subscriptions using Bicep."] }],
  };
  const purposes: string[] = [];
  const report = await reviewAndCorrectDraft(clean, ctx, async (_prompt, purpose) => {
    purposes.push(purpose);
    return JSON.stringify({ issues: [] });
  });
  assert.deepEqual(purposes, ["review"]);
  assert.equal(report.corrections, "none_needed");
  assert.deepEqual(report.remaining, []);
});

test("a category rename can never shift the addresses later deletions use", async () => {
  const skillsSource = JSON.stringify({
    experience: [{ role: "Engineer", company: "Contoso", bullets: ["Automated builds."] }],
    skills: ["Azure", "Ansible", "Jenkins", "Bicep", "PowerShell", "Puppet", "Terraform"],
  });
  const resume: any = {
    skills: {
      "Cloud Platforms": ["Azure"],
      "DevOps & Automation": ["Ansible", "Terraform", "Jenkins"],
      "Infrastructure Automation": ["Bicep", "PowerShell", "Puppet"],
    },
    experience: [{ role: "Engineer", company: "Contoso", bullets: ["Automated builds."] }],
  };
  const context = { ...ctx, figureSourceText: skillsSource, evidenceText: skillsSource };
  const report = await reviewAndCorrectDraft(resume, context, async (_prompt, purpose) =>
    purpose === "review"
      ? JSON.stringify({ issues: [] })
      : JSON.stringify({
          corrections: [
            { location: "KC2", text: "Infrastructure Automation" },
            { location: "K2.2", text: "" },
          ],
        })
  );
  assert.deepEqual(resume.skills, {
    "Cloud Platforms": ["Azure"],
    "Infrastructure Operations & Automation": ["Ansible", "Jenkins"],
    "Infrastructure Automation": ["Bicep", "PowerShell", "Puppet"],
  });
  assert.deepEqual(report.fixed.map((fix) => `${fix.location}:${fix.before}`), ["K2.2:Terraform"]);
});

test("open issues follow the delivered document after bullets are trimmed", () => {
  const resume: any = {
    experience: [{ role: "Engineer", company: "Contoso", bullets: ["Kept bullet.", "Moved bullet with 45% claim."] }],
    draft_verification: {
      method: "draft-review-v1",
      ai_review: "completed",
      corrections: "applied",
      issues_found: 2,
      fixed: [],
      removed: [],
      remaining: [
        { location: "E1.3", label: "Engineer @ Contoso, bullet 3", type: "unsupported_figure", problem: "States 45%", text: "Moved bullet with 45% claim." },
        { location: "E1.4", label: "Engineer @ Contoso, bullet 4", type: "unsupported_figure", problem: "States 40%", text: "Trimmed bullet with 40% claim." },
      ],
    },
  };
  refreshVerificationReport(resume);
  assert.deepEqual(resume.draft_verification.remaining, [
    { location: "E1.2", label: "Engineer @ Contoso, bullet 2", type: "unsupported_figure", problem: "States 45%", text: "Moved bullet with 45% claim." },
  ]);
  const unreported: any = { summary: "x" };
  refreshVerificationReport(unreported);
  assert.equal(unreported.draft_verification, undefined);
});

test("the final guarantee covers restored roles, records what it cannot remove, and is idempotent", () => {
  const resume: any = {
    experience: [
      { role: "Engineer", company: "A", bullets: ["Ran CI/CD for releases."] },
      { role: "Admin", company: "B", bullets: ["Patched servers.", "Built Azure DevOps boards."] },
    ],
    skills: ["Terraform", "Azure"],
  };
  applyExclusionGuarantee(resume);
  assert.deepEqual(resume.skills, ["Azure"]);
  assert.deepEqual(resume.experience[1].bullets, ["Patched servers."]);
  assert.deepEqual(resume.experience[0].bullets, ["Ran CI/CD for releases."], "never empties a role");
  assert.equal(resume.draft_verification.removed.length, 2);
  assert.deepEqual(resume.draft_verification.remaining.map((issue: any) => issue.location), ["E1.1"]);

  applyExclusionGuarantee(resume);
  assert.equal(resume.draft_verification.removed.length, 2);
  assert.equal(resume.draft_verification.remaining.length, 1);

  const clean: any = { summary: "Azure engineer." };
  applyExclusionGuarantee(clean);
  assert.equal(clean.draft_verification, undefined);
});
