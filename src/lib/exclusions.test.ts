import assert from "node:assert/strict";
import test from "node:test";
import { EXCLUSION_RULE, findExcludedTerms, removeExcludedSkills, withoutExcludedTerms } from "./exclusions";

test("every excluded capability is found, spelled-out and joined forms included", () => {
  assert.deepEqual(findExcludedTerms("Built CI/CD pipelines in Azure DevOps with Terraform"), [
    "CI/CD",
    "Pipelines",
    "DevOps",
    "Terraform",
  ]);
  assert.deepEqual(findExcludedTerms("Set up continuous integration for three apps"), ["CI/CD"]);
  assert.deepEqual(findExcludedTerms("CICD and CI-CD"), ["CI/CD"]);
  assert.deepEqual(findExcludedTerms("Owned a data pipeline"), ["Pipelines"]);
});

test("neighbouring wording is not mistaken for an exclusion", () => {
  for (const text of [
    "DevSecOps champion",
    "Decided which CMDB configuration items (CI) to retire",
    "Bicep and ARM templates",
    "Incident management",
  ]) {
    assert.deepEqual(findExcludedTerms(text), [], text);
  }
  assert.deepEqual(findExcludedTerms(undefined), []);
});

test("the shared rule names all four and keeps verbatim history verbatim", () => {
  for (const term of ["CI/CD", "Pipelines", "DevOps", "Terraform"]) assert.ok(EXCLUSION_RULE.includes(`"${term}"`), term);
  assert.match(EXCLUSION_RULE, /belongs in "keyword_gap"/);
  assert.match(EXCLUSION_RULE, /Job titles, employer names and certification names stay exactly/);
});

test("prompt keyword lists drop entries that name an exclusion", () => {
  assert.deepEqual(withoutExcludedTerms(["Azure", "Terraform", "CI/CD pipelines", "Bicep", 7]), ["Azure", "Bicep"]);
});

test("categorized skills lose excluded entries and parts, and excluded category names are renamed", () => {
  const resume: any = {
    skills: {
      "DevOps & Automation": ["PowerShell", "Azure DevOps", "Bicep, Terraform", "ARM/Terraform"],
      "CI/CD Pipeline Design": ["GitHub Actions"],
      Cloud: ["Azure"],
    },
  };
  const removed = removeExcludedSkills(resume);
  assert.deepEqual(resume.skills, {
    "Infrastructure Operations & Automation": ["PowerShell", "Bicep", "ARM"],
    "Infrastructure Provisioning": ["GitHub Actions"],
    Cloud: ["Azure"],
  });
  assert.equal(removed.length, 5);
  assert.ok(removed.some((r) => r.text === "Bicep, Terraform" && /kept "Bicep"/.test(r.reason)));
});

test("flat skills lose whole entries, and nothing is split into fragments of an exclusion", () => {
  const resume: any = { skills: ["Azure", "Terraform", "continuous delivery", "CI/CD & GitOps"] };
  removeExcludedSkills(resume);
  assert.deepEqual(resume.skills, ["Azure", "GitOps"]);
  assert.ok(!resume.skills.includes("CI") && !resume.skills.includes("CD"));
});

test("a clean skills section is left exactly as it was", () => {
  const resume: any = { skills: { Cloud: ["Azure", "Bicep"], Tools: "PowerShell, KQL" } };
  const before = JSON.stringify(resume);
  assert.deepEqual(removeExcludedSkills(resume), []);
  assert.equal(JSON.stringify(resume), before);
});
