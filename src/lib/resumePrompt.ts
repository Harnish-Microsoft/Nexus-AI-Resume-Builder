/**
 * Single source of truth for the resume generation prompts.
 *
 * Every generation path consumes these builders:
 *   - server.ts            -> POST /api/v2/optimize, OpenAI branch (whole document)
 *   - server/roleGenerator -> POST /api/v2/optimize, default hybrid-gemini branch (one role at a time)
 *   - geminiService.ts     -> optimizeResume() legacy/fallback path (raw resume text input)
 *
 * The FAANG bullet standard, STAR standard and bullet budget are defined once
 * here and shared by both prompt shapes, so the paths cannot drift apart again.
 *
 * Only imports the other dependency-free src/lib modules: it is bundled by both
 * esbuild (node) and vite (browser).
 */

import {
  activeBulletRules,
  describeBudgetRules,
  formatBudgetTable,
  isRuleBasis,
  UNPARSEABLE_MAX,
} from "./bulletBudget";
import type { BulletBudget, BulletRules, PlatformDecision } from "./bulletBudget";
import { EXCLUSION_RULE } from "./exclusions";
import { BANNED_LEAD_VERBS } from "./impactScore";
import { formatDocumentEvidenceBrief } from "./requirementEvidence";
import type { RequirementAnalysis } from "./requirementEvidence";

export const KEYWORD_TARGET_RULE = `EVIDENCE-LIMITED KEYWORD TARGET:
Aim for at least 80% of the posting's weighted vocabulary ONLY where candidate material supports it.
Use the posting's exact supported terms naturally in skills, summary and the relevant source role.
Never move a fact between employers, invent a credential/metric, repeat keywords to game the score,
or include excluded skills. Unsupported requirements stay gaps even when the target cannot be met.
Scores are computed in code; never promise an ATS pass or fabricate a score.`;

export interface ResumePromptOptions {
  targetRole: string;
  audience: string;
  /** Reader brief from buildAudienceBrief(mix, "document"); shapes emphasis, never facts. */
  audienceBrief?: string;
  mode: string;
  /** Raw resume text or pre-extracted JSON, already trimmed by the caller. */
  inputData: string;
  /** Label describing the shape of inputData, shown to the model. */
  inputLabel?: string;
  targetCompany?: string;
  customPrompt?: string;
  brainDump?: string;
  jobDescription?: string;
  /** Known role count from structured extraction. Omit for raw-text input. */
  roleCount?: number;
  jdKeywords?: string[];
  masterResumes?: unknown[];
  currentDate?: string;
  /** Hiring-manager rejection review instead of a rewrite. */
  recruiterSimulationMode?: boolean;
  /** Per-role budgets computed from the source dates; rendered as an authoritative table. */
  bulletBudgets?: BulletBudget[];
  /**
   * The candidate's bullet rules. When active, the budget rule puts them ahead of
   * the tenure tiers, marks each table row [RULE] or [SYSTEM], and asks for
   * grounded expansion on rule roles. Omitted or disabled: the tenure wording.
   */
  bulletRules?: BulletRules | null;
  /** How the platform rule chose its platform (planBulletBudgets().platform). */
  platformDecision?: PlatformDecision | null;
  /** buildTrendBrief(trends, { scope: "document" }): trending names the candidate's material supports. */
  trendBrief?: string;
  /** The verified job brief and requirement evidence map; omitted or null leaves the prompt as before. */
  requirementAnalysis?: RequirementAnalysis | null;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const BANNED_VERBS = BANNED_LEAD_VERBS.map(titleCase);

const APPROVED_VERBS = [
  "Architected",
  "Designed",
  "Built",
  "Migrated",
  "Implemented",
  "Automated",
  "Standardized",
  "Governed",
  "Configured",
  "Reduced",
  "Consolidated",
  "Instrumented",
  "Partnered",
  "Defined",
  "Evaluated",
  "Delivered",
  "Diagnosed",
  "Hardened",
  "Refactored",
  "Negotiated",
  "Mentored",
];

const CORPORATE_DNA: Record<string, string> = {
  amazon:
    "Emphasize Ownership, Bias for Action, Dive Deep and Deliver Results: customer impact, operational excellence, and decisions backed by data. Demonstrate the Leadership Principles through the work; never name them in a bullet.",
  microsoft:
    "Emphasize enterprise scale, cloud transformation, customer outcomes, and collaboration across organizational boundaries.",
  google:
    "Emphasize systems design, scale, and technical depth, in XYZ-shaped bullets that carry the measure only where the source states it.",
  meta:
    "Emphasize moving fast, shipping end-to-end impact, and performance optimization.",
  apple:
    "Emphasize craftsmanship and attention to detail, user-facing quality, privacy and security by design, and tight cross-functional collaboration.",
  netflix:
    "Emphasize independent judgment, ownership of outcomes with minimal process, candid communication, and the business impact of each decision.",
  accenture:
    "Emphasize client delivery, global managed services, and cross-functional deployment.",
  infosys:
    "Emphasize client delivery, global managed services, and cross-functional deployment.",
};

const DEFAULT_CORPORATE_DNA =
  "Focus on internal product growth, feature ownership, and end-to-end delivery.";

/** Subsidiaries and products that share their parent's hiring bar. */
const COMPANY_ALIASES: Record<string, string> = {
  amazon: "amazon", aws: "amazon",
  google: "google", alphabet: "google", youtube: "google", deepmind: "google",
  meta: "meta", facebook: "meta", instagram: "meta", whatsapp: "meta",
  microsoft: "microsoft", azure: "microsoft",
  apple: "apple",
  netflix: "netflix",
  accenture: "accenture",
  infosys: "infosys",
};

/** Own-key lookup, so a company named "Constructor" never resolves to Object.prototype.constructor. */
function ownEntry<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * Canonical key for a target company, matched per word so that "Amazon Web
 * Services", "AWS" and "Google LLC" resolve like "Amazon" and "Google" do.
 */
export function companyKey(company?: string): string | null {
  const tokens = String(company || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const token of tokens) {
    const key = ownEntry(COMPANY_ALIASES, token);
    if (key) return key;
  }
  return null;
}

export interface StarFramework {
  name: string;
  competencies: string[];
}

/** The competency model each company's behavioral interviews are organized around. */
const STAR_FRAMEWORKS: Record<string, StarFramework> = {
  amazon: {
    name: "Amazon's Leadership Principles",
    competencies: [
      "Customer Obsession", "Ownership", "Invent and Simplify", "Are Right, A Lot",
      "Learn and Be Curious", "Hire and Develop the Best", "Insist on the Highest Standards",
      "Think Big", "Bias for Action", "Frugality", "Earn Trust", "Dive Deep",
      "Have Backbone; Disagree and Commit", "Deliver Results",
      "Strive to be Earth's Best Employer", "Success and Scale Bring Broad Responsibility",
    ],
  },
  google: {
    name: "Google's hiring attributes",
    competencies: [
      "Googleyness", "Emergent Leadership", "Comfort with Ambiguity", "Bias to Action",
      "Collaboration", "Role-Related Knowledge",
    ],
  },
  meta: {
    name: "the signals Meta's behavioral interview assesses",
    competencies: [
      "Driving Results", "Moving Fast", "Resolving Conflict", "Embracing Ambiguity",
      "Growing Continuously", "Communicating Effectively",
    ],
  },
  microsoft: {
    name: "Microsoft's culture and leadership principles",
    competencies: [
      "Growth Mindset", "Customer Obsession", "Collaboration (One Microsoft)", "Create Clarity",
      "Generate Energy", "Deliver Success",
    ],
  },
  apple: {
    name: "the qualities Apple interviewers commonly probe",
    competencies: [
      "Attention to Detail", "User Focus", "Cross-Functional Collaboration", "Ownership",
      "Simplicity", "Handling Ambiguity",
    ],
  },
  netflix: {
    name: "Netflix's culture values",
    competencies: [
      "Judgment", "Communication", "Curiosity", "Courage", "Passion", "Selflessness",
      "Innovation", "Inclusion", "Integrity", "Impact",
    ],
  },
};

const DEFAULT_STAR_FRAMEWORK: StarFramework = {
  name: "the core behavioral competencies top-tier loops assess",
  competencies: [
    "Ownership", "Delivering Results", "Technical Depth", "Problem Solving",
    "Handling Ambiguity", "Collaboration", "Influence Without Authority",
    "Conflict Resolution", "Customer Focus", "Learning from Failure",
  ],
};

export function starFrameworkFor(targetCompany?: string): StarFramework {
  const key = companyKey(targetCompany);
  return (key && ownEntry(STAR_FRAMEWORKS, key)) || DEFAULT_STAR_FRAMEWORK;
}

function corporateDnaFor(targetCompany?: string): string {
  const key = companyKey(targetCompany);
  return (key && ownEntry(CORPORATE_DNA, key)) || DEFAULT_CORPORATE_DNA;
}

const STAR_STORY_FIELDS =
  '"competency": "string", "question": "string", "situation": "string", "task": "string", ' +
  '"action": "string, first person singular", "result": "string", "learning": "string", ' +
  '"follow_ups": ["string"], "prep_gaps": ["string"]';

const OUTPUT_SCHEMA = `{
  "personal_info": { "name": "string", "location": "string", "email": "string", "phone": "string", "linkedin": "string", "linkedinText": "string" },
  "summary": "string",
  "skills": { "Category 1": ["string"], "Category 2": ["string"], "Category 3": ["string"], "Category 4": ["string"] },
  "experience": [ { "id": "string", "role": "string", "company": "string", "duration": "string", "bullets": ["string"] } ],
  "projects": [ { "title": "string", "description": "string" } ],
  "education": [ { "degree": "string", "institution": "string", "expected_completion": "string" } ],
  "certifications": [ { "name": "string", "issuer": "string", "date": "string" } ],
  "ats_keywords_from_jd": ["string"],
  "ats_keywords_added_to_resume": ["string"],
  "keyword_gap": ["string"],
  "match_score": null,
  "baseline_score": null,
  "improvement_notes": ["string"],
  "audience_alignment_notes": "string",
  "rejection_reasons": ["string"],
  "star_stories": [ { "bullet": "string, copied VERBATIM from a bullet in experience", "role": "string, the role that bullet belongs to", "company": "string", ${STAR_STORY_FIELDS} } ],
  "audit_report": {
    "score": "integer 0-100, computed per the AUDIT SCORE RUBRIC below",
    "flags": [
      { "id": "string", "type": "tool_dropping|passive_ownership|leadership_signal|ats_cohesion", "message": "string", "fix": "string", "severity": "low|medium|high" }
    ],
    "trajectory": { "stage": "string", "description": "string", "recommendation": "string" }
  }
}`;

function section(condition: unknown, text: string): string {
  return condition ? text : "";
}

/* ------------------------------------------------------------------ *
 * Shared standards. Each block is referenced by NAME, never by number,
 * because the whole-document and per-role prompts number their rules
 * differently.
 * ------------------------------------------------------------------ */

const STAR_GROUNDING = `For each role, identify the achievements the source actually evidences, and for each one
silently reconstruct the four STAR elements FROM THE SOURCE ONLY:
  S - the situation: the system, constraint, failure, or business condition that existed
  T - the task: what this person specifically owned in it, not what the team owned
  A - the action: the concrete technical or organisational decision they made and executed
  R - the result: what measurably or observably changed as a consequence

Then write the bullet as the compressed A -> R of that story: the action taken and what it
changed. The S and T stay in your reasoning as the context that makes the bullet specific;
they are what stops it collapsing into a tool-dropping list.

RULES FOR THIS STEP:
- If the source does not support an element, leave it thin and factual. NEVER invent a
  situation, a stakeholder, a deadline, or a result to complete the pattern. An honest
  three-element story beats a fabricated four-element one. ZERO FABRICATION outranks STAR
  completeness absolutely.
- If a Result cannot be evidenced, close on the concrete change instead - the manual step
  removed, the failure mode eliminated, the system retired, the escalation that stopped.
- STAR is the reasoning scaffold, NOT a bullet template. Do NOT write bullets shaped
  "Faced with X, tasked with Y, I did Z, achieving W" - that cadence is an instant tell and
  violates BULLET SHAPE. The reader must never be able to see the scaffold in the prose.
- A bullet that is pure responsibility description with no action and no change is not a
  STAR-grounded bullet. Rewrite it or drop it.`;

const ZERO_FABRICATION = `ZERO FABRICATION. Do not invent metrics, percentages, currency amounts, team sizes,
   technologies, tools, certifications, employers, or dates. If the source contains no
   number, the bullet ships without a number. A precise, unquantified, technically specific
   bullet always beats an invented statistic. Every noun in the output must be traceable to
   the source input, or to the JD's vocabulary applied to work the source actually supports.
   Every figure you write is checked mechanically against the candidate's own material; one
   that cannot be found there is shown to the candidate as UNVERIFIED. Reproduce source
   figures exactly - never round them, and never derive a new one (such as a percentage
   computed from two source numbers); state the before and after as the source gives them.`;

const FAANG_BULLET_STANDARD = `FAANG BULLET STANDARD - how a top-tier screen reads every bullet:
   a. IMPACT FIRST, XYZ SHAPE: "Accomplished [X], as measured by [Y], by doing [Z]". Include
      Y ONLY when the source states the measure. When it does not, X must still be concrete:
      the system shipped, the failure mode removed, the process retired. Never manufacture a
      Y to complete the formula - a missing measure is honest, an invented one disqualifies.
      Not every bullet carries a number (see METRIC DISCIPLINE).
   b. LEGIBLE SCOPE: make the size of the problem visible with facts the source gives - what
      the system does for the business, who depends on it, how many services, environments,
      teams, or regions it spans. Scope stands in for a metric and never needs invention.
   c. INDIVIDUAL ATTRIBUTION: every bullet states what THIS person did. No "we", "our", "I",
      or "my" - implied first person, verb first. For team efforts, name the part that was
      theirs ("Designed the failover logic for..."); the team appears only as scope.
   d. LEVEL CALIBRATION: infer seniority from the source dates and the target role. Senior
      and above: architectural judgement, trade-offs weighed, cost and risk ownership,
      cross-team influence, ambiguity resolved. Earlier career: implementation depth,
      systems reasoning, delivery. Never apply executive vocabulary to junior work, or
      junior vocabulary to executive work.
   e. TENSE: past tense for every accomplishment, including in the current role - the work
      is finished even if the job is not.
   f. ONE CLAIM PER BULLET: one accomplishment in one to two lines. Two unrelated wins joined
      by "and" are two bullets, or one bullet and one cut.
   g. DEFENSIBILITY: keep a bullet only if the candidate could answer "walk me through that"
      for five minutes using nothing but the source. Otherwise cut it back to what they can
      defend.`;

const BULLET_SHAPE = `BULLET SHAPE - DELIBERATE VARIATION (there is NO single bullet template):
   Rotate across these shapes so that no two consecutive bullets share a cadence. Every
   shape still opens on the action verb:
   (a) Outcome-led:  action -> technical work -> result
   (b) Scope-led:    action -> system or surface owned -> what it enabled
   (c) Decision-led: action -> the trade-off evaluated -> what it resolved
   (d) Problem-led:  action -> the constraint or failure it removed -> what stopped happening
   Vary length deliberately: some bullets 8-12 words, others 18-25. Uniform bullet length is
   itself a tell of generated text. One line preferred; two lines only when genuine
   architectural complexity requires it. Never pad to fill a line.`;

const METRIC_DISCIPLINE = `METRIC DISCIPLINE - DENSITY CAP (violating this makes the whole document read as fake):
   A number in every bullet is the single strongest tell of an AI-written resume. Recruiters
   do not discount only the suspect figure - they discount the entire document.
   - Use a metric ONLY where the source explicitly supplies one. Never derive, infer,
     estimate, extrapolate, or round one up.
   - Aim for roughly one bullet in three carrying a number, and never more than two
     consecutive bullets containing one.
   - ATTRIBUTION TEST: include a metric only if the person in THAT role would plausibly have
     had visibility into it. A support analyst does not know company revenue impact.
   - NO ROUND-NUMBER THEATRE: avoid 30%, 50%, 2x, "over 100", "millions of". Real figures are
     specific and uneven. Reproduce source figures exactly; never tidy them.
   - When no metric exists, close the bullet on a CONCRETE, VERIFIABLE outcome instead: the
     manual step removed, the failure mode eliminated, the system retired, the audit passed,
     the recurring escalation ended. Specificity replaces quantification. Vagueness does not.`;

const VERB_POLICY = `VERB POLICY. Lead every bullet with a strong, concrete, past-tense verb, and never open
   two bullets of the same role with the same verb.
   BANNED (AI-slop markers): ${BANNED_VERBS.join(", ")}.
   USE: ${APPROVED_VERBS.join(", ")}.`;

function starStoryStandard(framework: StarFramework): string {
  return `STAR STORY STANDARD - every story must survive a top-tier behavioral interview loop:
- Build a story only from a bullet whose source evidence supports a real answer.
- "competency": the ONE competency the story best evidences, taken from ${framework.name}:
  ${framework.competencies.join(" | ")}.
  Give each story a DIFFERENT competency where the evidence allows: each interviewer in a
  loop is assigned different ones.
- "question": the behavioral question this story answers, phrased the way an interviewer
  asks it ("Tell me about a time you...").
- "situation" (1-2 sentences) and "task" (1 sentence): brief context, about a fifth of the
  story. The task is what THIS person owned, not what the team owned.
- "action": the bulk of the story, about half of it - 3 to 5 concrete steps told in FIRST
  PERSON SINGULAR ("I profiled...", "I proposed..."), never "we". Include the reasoning
  behind the key decision and the trade-off that was weighed.
- "result": what changed, using the source's own figures where they exist and otherwise
  the concrete qualitative change. Never a figure the source does not state.
- "learning": one sentence on what the candidate took away or would do differently.
- "follow_ups": the 2-3 probing questions an interviewer is most likely to ask next.
- "prep_gaps": details the candidate must prepare because the source does not supply them
  (for example "the latency before the change"). Empty when nothing is missing. Missing
  evidence goes HERE - never into the story itself.
- Spoken aloud, a story runs about two minutes: specific, first person, no preamble.`;
}

function budgetCountPhrase(budget: BulletBudget): string {
  if (budget.label === null) {
    return `no readable dates - proportionate to the evidence, never more than ${budget.max} bullets`;
  }
  if (budget.min === budget.max) return `EXACTLY ${budget.min} bullet${budget.min === 1 ? "" : "s"}`;
  return `${budget.min} to ${budget.max} bullets`;
}

const BUDGET_ENFORCEMENT = `ENFORCEMENT: the platform counts every role's bullets after generation. Bullets beyond a
   role's ceiling are deleted automatically, weakest first - an extra bullet never ships, it
   only displaces a stronger one. The low end of a range is a target, not a quota: if the
   source evidences fewer distinct achievements, write fewer bullets rather than invent one.
   Splitting a compound source bullet into two genuine achievements is allowed; restating
   one achievement twice is not.`;

/** Whole-document enforcement when the candidate's bullet rules are active. */
const RULES_BUDGET_ENFORCEMENT = `ENFORCEMENT: the platform counts every role's bullets after generation. Bullets beyond a
   role's ceiling are deleted automatically, weakest first - an extra bullet never ships, it
   only displaces a stronger one. For a [SYSTEM] role the low end of a range is a target, not
   a quota: if the source evidences fewer distinct achievements, write fewer bullets rather
   than invent one. For a [RULE] role the low end is the candidate's own minimum: reach it
   through GROUNDED EXPANSION (below). Falling short of it is a failure the platform reports;
   inventing an achievement to reach it is a worse one. Splitting a compound source bullet
   into two genuine achievements is allowed; restating one achievement twice is not.`;

const GROUNDED_EXPANSION_DOCUMENT = `GROUNDED EXPANSION ([RULE] roles only): the candidate chose these counts, so meet each
   [RULE] role's minimum by drawing out more of the work its own source already shows:
   - split a compound source bullet into its separate, genuine achievements;
   - develop the systems, tools, and scope the role's title and bullets name - what was
     designed, built, secured, migrated, automated, or operated, and for whom;
   - use the brain dump and the candidate's other resume versions of the SAME role, when given;
   - use an item from the candidate's skills list only where it fits that role's work and dates.
   When a [RULE] role's source holds more achievements than its ceiling, keep the ones most
   relevant to the target posting. Never add a figure, employer, client, certification, or
   technology the candidate's material does not show, and never restate one achievement to
   reach a count.`;

/** Per-role enforcement for a role whose count one of the candidate's bullet rules set. */
const RULE_ROLE_ENFORCEMENT = `ENFORCEMENT: the platform counts this role's bullets after generation. Bullets beyond
   the ceiling are deleted automatically, weakest first - an extra bullet never ships, it only
   displaces a stronger one. An attempt below the minimum is sent back for correction.
   Splitting a compound source bullet into two genuine achievements is allowed; restating
   one achievement twice is not.`;

const MAX_SUPPORTING_BULLETS = 15;
const MAX_SUPPORTING_SKILLS = 40;
const MAX_SUPPORTING_CHARS = 400;

/** The candidate's own material beyond one role's source bullets. */
export interface RoleSupportingEvidence {
  /** Bullets for this same role from the candidate's other resume versions. */
  otherVersions?: string[];
  /** The candidate's skills list. Shown to rule roles only, for grounded expansion. */
  skills?: string[];
}

function evidenceKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Trimmed, de-duplicated strings, skipping any whose key is in `exclude`. */
function cleanEvidenceList(values: unknown, limit: number, exclude: Set<string> = new Set()): string[] {
  const out: string[] = [];
  const seen = new Set(exclude);
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim().slice(0, MAX_SUPPORTING_CHARS);
    const key = evidenceKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** Prefixes every non-empty line. */
function indentBlock(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

/** Rule 4 of the whole-document prompt without bullet rules: the tenure tiers (unchanged wording). */
function tenureBudgetSection(budgets: BulletBudget[] | null): string {
  return `4. BULLET BUDGET - TENURE FIRST, THEN RECENCY (trim wording, never roles):
${
    budgets
      ? `   PER-ROLE BUDGET - computed from the actual dates. AUTHORITATIVE: it overrides every
   heuristic below and your own reading of the dates.
${formatBudgetTable(budgets)}
   The tiers these were derived from (first match wins):
${describeBudgetRules()}`
      : `   Derive each role's tenure from its duration field (and the CURRENT DATE for ongoing
   roles), then apply the first tier that matches:
${describeBudgetRules()}
   The recency tier applies to any ongoing role and to the most recent role longer than
   12 months. A role whose dates cannot be read never exceeds ${UNPARSEABLE_MAX} bullets.`
  }
   ${BUDGET_ENFORCEMENT}

   ANTI-PADDING RULE: bullet count must stay proportionate to time served. A long list
   under a short stint reads as padding, invites scrutiny of the entire document, and is
   a worse outcome than saying less. Never inflate a brief role to match the depth of a
   multi-year one, however senior the title or well known the employer. For a stint under
   three months, state the single thing that was actually delivered and stop.

   Depth belongs to the roles that earned it: give substantial, long-tenure positions the
   fullest treatment, and let short ones stay deliberately thin.
   The total document must fit 1-2 pages, achieved by trimming bullets and tightening
   wording ONLY. Rule 1 always wins over this rule.`;
}

/** Rule 4 of the whole-document prompt when the candidate's bullet rules are active. */
function rulesBudgetSection(
  budgets: BulletBudget[] | null,
  rules: BulletRules,
  platform: PlatformDecision | null | undefined
): string {
  const described = describeBudgetRules("   ", { rules, platform });
  const recentOn = rules.recent.enabled && rules.recent.count > 0;
  const cap = rules.pageFit.enabled ? rules.pageFit.maxTotalBullets : null;
  const pageFit =
    cap === null
      ? ""
      : budgets
        ? ` - the table already applies the candidate's ${cap}-bullet page-fit cap`
        : ` - keep the whole document within the candidate's ${cap}-bullet page-fit cap`;
  return `4. BULLET BUDGET - THE CANDIDATE'S BULLET RULES FIRST, THEN TENURE (trim wording, never roles):
${
    budgets
      ? `   PER-ROLE BUDGET - computed from the candidate's bullet rules and the actual dates.
   AUTHORITATIVE: it overrides every heuristic below and your own reading of the dates.
   [RULE] = set by one of the candidate's own bullet rules; [SYSTEM] = set by the tenure tiers.
${formatBudgetTable(budgets, "   ", { markSource: true })}
   The rules these were derived from:
${described}`
      : `   Apply the candidate's bullet rules first (first match wins). Every role no rule claims
   takes the first tenure tier that matches, reading tenure from its duration field (and
   the CURRENT DATE for ongoing roles):
${described}
   ${
          recentOn ? `"Most recent" is decided by end date; an ongoing role ends today. ` : ""
        }A role whose dates cannot be
   read never exceeds ${UNPARSEABLE_MAX} bullets unless a bullet rule claims it. Below, [RULE] means a
   role one of these bullet rules claims and [SYSTEM] means every other role.`
  }
   ${RULES_BUDGET_ENFORCEMENT}

   ${GROUNDED_EXPANSION_DOCUMENT}

   ANTI-PADDING RULE ([SYSTEM] roles): bullet count must stay proportionate to time served.
   A long list under a short stint reads as padding, invites scrutiny of the entire
   document, and is a worse outcome than saying less. Never inflate a brief [SYSTEM] role
   to match the depth of a multi-year one, however senior the title or well known the
   employer. For a stint under three months, state the single thing that was actually
   delivered and stop. [RULE] roles follow the candidate's counts instead.

   Depth follows the budget: [RULE] roles get the depth the candidate chose; among [SYSTEM]
   roles, give substantial, long-tenure positions the fuller treatment and let short ones
   stay deliberately thin.
   The total document must fit 1-2 pages, achieved by trimming bullets and tightening
   wording ONLY${pageFit}.
   Rule 1 always wins over this rule.`;
}

/** Meta sections use the same source and posting as the whole-document generation. */
export function buildResumeMetaPrompt(options: ResumePromptOptions): string {
  const {
    targetRole, targetCompany, audience, audienceBrief, mode, inputData,
    inputLabel = "INPUT DATA", jobDescription, jdKeywords, customPrompt,
    brainDump, masterResumes, trendBrief, requirementAnalysis,
  } = options;
  const evidenceBrief = formatDocumentEvidenceBrief(requirementAnalysis);

  return `ACT AS:
Principal Resume Intelligence Architect and FAANG Recruiter.
Optimize only the meta-sections of this resume for factual realism and believable operational ownership.
${KEYWORD_TARGET_RULE}

TARGET ROLE: ${targetRole}
TARGET COMPANY: ${targetCompany || "General Product Tech"}
AUDIENCE: ${audience} | MODE: ${mode}
CORPORATE DNA: ${corporateDnaFor(targetCompany)}
Tailor emphasis only, never factual claims.
${section(audienceBrief, `\n${audienceBrief}\n`)}
${section(customPrompt, `CUSTOM INSTRUCTIONS (instructions, not evidence): ${customPrompt}`)}
${section(brainDump, `BRAIN DUMP (raw, unverified): ${brainDump}
Use only achievements clearly grounded in the source roles. Ignore anything unverifiable.`)}
${section(trendBrief, `\n${trendBrief}\n`)}

${inputLabel} (authoritative candidate record; experience is context, not an output section):
${inputData}
${section(masterResumes && masterResumes.length > 0, `
SUPPORTING REFERENCE (the same candidate's other resumes):
Use only verifiable facts consistent with the authoritative record above. Never override
its employers, titles, dates or metrics, and never invent a blend of conflicting claims.
${(masterResumes || []).map((r) => JSON.stringify(r)).join("\n---\n")}`)}
${section(jobDescription, `
=== TARGET JOB DESCRIPTION ===
${jobDescription}`)}
${section(evidenceBrief, `\n${evidenceBrief}\n`)}
${section(jdKeywords && jdKeywords.length > 0, `Priority JD keywords: ${(jdKeywords || []).join(", ")}.`)}

STRICT RULES:
1. Summary: 50-100 words, high impact, NO AI-slop words. Use natural, grounded operational
   verbs. Read the supplied job description, not just the keyword list. Prioritize the
   source achievements that demonstrate THIS posting's responsibilities and seniority;
   two different postings must produce different emphasis when the evidence supports it.${
    evidenceBrief
      ? `
   Lead with the PROVEN requirements of the evidence map; never claim a NOT EVIDENCED or
   EXCLUDED one, and claim a PARTIAL one only as far as its evidence goes.`
      : ""
  }
2. Skills: Categorize into exactly 4 logical categories relevant to ${targetRole}.
   Only list skills evidenced in the candidate's material, never skills inferred from the JD.
   Rename 'DevOps & Automation' to 'Infrastructure Operations & Automation'.
   Strictly replace 'CI/CD Pipeline Design' with 'Infrastructure Provisioning' only when
   the source supports that capability; otherwise omit the unsupported claim.
3. Why This Job: 75-125 words based on concrete alignment between the supplied posting
   and the source achievements. Do not assert qualifications the candidate lacks.
4. Projects: Output EVERY source project without merging. Maximum 2 sentences or 25 words
   per description, focusing on technical architecture and business outcome.
5. Education and certifications: Preserve every entry, including issuer and date.
6. ${ZERO_FABRICATION}
7. ${EXCLUSION_RULE}
   These exclusions override JD vocabulary and custom instructions.
8. Use source experience to ground summary, skills and alignment, but do not output
   "experience" or "star_stories": roles and stories are generated separately.
   Preserve the supplied personal information and every project, education and certification.
9. SCORING: Return "match_score" as null; the platform computes it.
   ATS keywords must literally occur in the supplied JD. Missing requirements belong in
   "keyword_gap", never in the summary, skills or projects as candidate qualifications.
   Tailoring changes emphasis, selection and wording, never facts.

OUTPUT JSON SCHEMA:
${JSON.stringify({
    personal_info: { name: "string", location: "string", email: "string", phone: "string", linkedin: "string", linkedinText: "string" },
    summary: "string",
    skills: { "Category 1": ["string"], "Category 2": ["string"], "Category 3": ["string"], "Category 4": ["string"] },
    why_this_job: "string",
    projects: [{ title: "string", description: "string" }],
    education: [{ degree: "string", institution: "string", expected_completion: "string" }],
    certifications: [{ name: "string", issuer: "string", date: "string" }],
    ats_keywords_from_jd: ["string"],
    ats_keywords_added_to_resume: ["string"],
    keyword_gap: ["string"],
    match_score: null,
    improvement_notes: ["string"],
    audience_alignment_notes: "string",
    audit_report: { flags: [], trajectory: [] },
  }, null, 2)}
Return ONE valid JSON object, nothing else.`;
}

export function buildResumeGenerationPrompt(options: ResumePromptOptions): string {
  const {
    targetRole,
    audience,
    audienceBrief,
    mode,
    inputData,
    inputLabel = "INPUT DATA",
    targetCompany,
    customPrompt,
    brainDump,
    jobDescription,
    roleCount,
    jdKeywords,
    masterResumes,
    currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    recruiterSimulationMode = false,
    bulletBudgets,
    bulletRules,
    platformDecision,
    trendBrief,
    requirementAnalysis,
  } = options;

  const corporateDna = corporateDnaFor(targetCompany);
  const framework = starFrameworkFor(targetCompany);
  const budgets = Array.isArray(bulletBudgets) && bulletBudgets.length > 0 ? bulletBudgets : null;
  const rules = activeBulletRules(bulletRules);
  const budgetSection = rules ? rulesBudgetSection(budgets, rules, platformDecision) : tenureBudgetSection(budgets);
  const trendBriefText = typeof trendBrief === "string" ? trendBrief.trim() : "";
  const evidenceBrief = formatDocumentEvidenceBrief(requirementAnalysis);
  const budgetRubricLine = rules
    ? "  -10  a role's bullet count falls outside its budget in rule 4, or a [SYSTEM] role pads a short stint"
    : "  -10  bullet counts are disproportionate to tenure (padding a short stint)";

  const roleCountRule =
    typeof roleCount === "number"
      ? `The input contains exactly ${roleCount} roles. Return exactly ${roleCount} objects in "experience".`
      : `Count the roles present in the source input and return EXACTLY that many objects in "experience".`;

  return `ACT AS:
${KEYWORD_TARGET_RULE}
Principal Resume Intelligence Architect + Tier-1 Technical Recruiter + Enterprise ATS Strategist.
Produce a recruiter-safe, ATS-parseable, technically mature resume that reflects factual realism
and believable ownership. Your output is consumed by a JSON parser, never read as prose by a human.

TARGET ROLE: ${targetRole}
TARGET COMPANY: ${targetCompany || "General Product Tech"}
AUDIENCE: ${audience} | MODE: ${mode} | CURRENT DATE: ${currentDate}
TASK: ${
    recruiterSimulationMode
      ? "Critical hiring-manager review. Populate rejection_reasons with concrete, evidence-based reasons this profile would be screened out, then still return the full rewritten document."
      : "Rewrite the source into a top-tier professional document adhering to operational realism."
  }
${section(audienceBrief, `\n${audienceBrief}\n`)}
${section(customPrompt, `CUSTOM INSTRUCTIONS: ${customPrompt}`)}
${section(
    brainDump,
    `BRAIN DUMP (raw, unverified): ${brainDump}
Mine this only for achievements that are grounded in the roles listed below. Ignore anything unverifiable.`
  )}
${section(
    masterResumes && masterResumes.length > 0,
    `STRATEGIC REFERENCE (THE CANDIDATE'S OTHER RESUMES):
These are other resume versions belonging to this same candidate. Use them for style,
structure, and high-impact phrasing, and you may reuse a fact from them only when it is
clearly this candidate's own verifiable history. Never invent a blend: the INPUT DATA above
remains the authoritative record of employers, dates, and metrics, and anything that
contradicts it must be ignored.
${(masterResumes || []).map((r) => JSON.stringify(r)).join("\n---\n")}`
  )}

=== PHASE 1 - SILENT GAP ANALYSIS (internal reasoning; DO NOT emit as prose) ===
Before writing anything, assess the source against these four axes. Every finding must be
recorded as a structured entry in audit_report.flags - never as free text outside the JSON.

A. TECHNICAL DEPTH vs. TOOL DROPPING
   Locate bullets that merely name technologies without architecture, constraint, or scale.
   Rewrite them to expose the design decision made, the constraint it resolved, and the
   operating scale (users, data volume, environments, uptime, cost) - but ONLY using scale
   facts already present in the source. If no scale fact exists, express depth through the
   technical decision itself, never through an invented number.

B. OWNERSHIP & DELIVERY
   Find passive framing ("worked on", "helped with", "was part of", "assisted", "involved in",
   "responsible for"). Convert to first-line execution ownership. Ownership is scale-agnostic:
   a university capstone and an enterprise migration both warrant direct-ownership phrasing
   when the source supports it. Do NOT inflate team scope or invent direct reports.

C. LEADERSHIP & TRAJECTORY
   Surface buried signals of readiness for the target role: architecture or design authority,
   vendor and stakeholder negotiation, mentoring, standards definition, cost or risk ownership,
   incident command, roadmap input. Map each signal to a concrete requirement of the target
   role and record the mapping in audit_report.trajectory.

D. ATS COHESION
   Detect structural risks: unexplained chronological gaps, inconsistent date formats,
   unexplained title or seniority regressions, duplicate or contradictory skill naming,
   acronym-only usage where the JD spells the term out (or vice versa), and JD keywords
   absent from the resume body. Emit each as a flag with a concrete fix.

=== PHASE 1.5 - STAR GROUNDING (internal reasoning; DO NOT emit as prose) ===
This step happens BEFORE you write a single bullet, and it determines what the bullets say.

${STAR_GROUNDING}

Then populate "star_stories" with the 4-6 STRONGEST of these, weighted toward the most
recent and most senior roles, including at least one from the current or most recent role.
Each entry's "bullet" field MUST be copied VERBATIM, character for character, from a bullet
you actually emitted in "experience" - it is the interview-prep expansion of that exact
bullet, and entries that do not match an emitted bullet are discarded by the platform.
Set "role" and "company" to the role that bullet belongs to.

${starStoryStandard(framework)}

=== PHASE 2 - REWRITE ===

HARD CONSTRAINTS (violating any of these is a critical failure):

1. PRESERVE EVERY ROLE - HIGHEST PRIORITY, OUTRANKS ALL LENGTH RULES.
   ${roleCountRule}
   Reverse-chronological, no merging, no collapsing, no truncation, no gaps in the timeline.
   A dropped role reads as an unexplained employment gap and gets the candidate rejected.
   If content will not fit, remove BULLETS from the oldest roles - never a role.
   Losing a bullet is acceptable; losing a job is not.

2. ${ZERO_FABRICATION}

   ${EXCLUSION_RULE}

3. PRESERVE ALL CERTIFICATIONS AND TITLES verbatim, including issuer and date. Never
   normalise, "correct", re-case, or abbreviate a job title or company name.

${budgetSection}

5. ${BULLET_SHAPE}

6. ${METRIC_DISCIPLINE}

7. ${VERB_POLICY}

8. ${FAANG_BULLET_STANDARD}

9. SKILLS. Exactly 4 short Title Case category keys (e.g. "Cloud Infrastructure",
   "Security & Governance"). No snake_case, no underscores, no long unbroken strings.
   Only skills evidenced in the source.

10. PROJECTS. Output EVERY project. Maximum 2 sentences each: technical architecture first,
    then business outcome.

11. JD TAILORING - THIS IS WHAT MAKES THE DOCUMENT SPECIFIC TO THIS POSTING.
    Read the full job description below, not just the extracted keyword list. Two different
    postings for a similar title MUST produce visibly different documents: different summary
    framing, a different ordering of emphasis within each role, and a different selection of
    which source bullets are promoted or dropped.
    - Reorder and reselect bullets so the work closest to THIS posting's priorities appears
      first within each role.
    - Mirror the posting's own vocabulary where the underlying work genuinely occurred
      (if it says "observability" and the source says "monitoring", adopt the posting's term).
    - Rewrite the summary to answer this specific posting, never as a generic profile.
    - Weave JD vocabulary into bullets ONLY where the underlying work genuinely occurred.
      Genuinely missing keywords belong in "keyword_gap", never in a bullet.
    Tailoring changes EMPHASIS, SELECTION, and WORDING. It never changes facts.${section(
    evidenceBrief,
    `
    The REQUIREMENT EVIDENCE MAP below is authoritative: lead with its PROVEN requirements,
    claim a PARTIAL one only as far as its evidence goes, and never claim a NOT EVIDENCED or
    EXCLUDED one - those belong in "keyword_gap".`
  )}
${section(
    jdKeywords && jdKeywords.length > 0,
    `    Priority JD keywords: ${(jdKeywords || []).join(", ")}.`
  )}${section(trendBriefText, `\n${indentBlock(trendBriefText, "    ")}`)}

12. HUMANIZATION. The document must read as if a competent engineer wrote it under time
    pressure - specific, uneven, and concrete - not as a uniformly polished template.
    Deliberate unevenness is the goal: bullets of differing length, some roles richer than
    others, and no repeated sentence skeleton anywhere in the document.

13. CORPORATE DNA: ${corporateDna}
    Tailor emphasis only. Never rename, reframe, or alter a factual claim to fit a company.
${section(
    mode === "Player-Coach",
    `
14. PLAYER-COACH BALANCE: Weight bullets roughly 60% hands-on technical execution and
    40% leadership (mentoring, design review, standards, cross-team coordination). Use hybrid
    framing such as "Architected & Led", "Designed & Mentored", "Built & Standardized".
    Apply this balance only to roles where the source supports both dimensions.`
  )}

${inputLabel}:
${inputData}
${section(
    jobDescription,
    `
=== TARGET JOB DESCRIPTION (tailor against this in full - see rule 11) ===
${jobDescription}`
  )}
${section(evidenceBrief, `\n${evidenceBrief}\n`)}

OUTPUT:
Return ONE valid JSON object and nothing else. No markdown fences, no preamble, no commentary,
no trailing explanation. All Phase 1 findings go into audit_report.flags and improvement_notes.

SCORING RULES (read carefully - these fields are NOT yours to estimate):
- "match_score" and "baseline_score" MUST be returned as null. The platform computes
  JD-alignment scores deterministically from the actual job description, the actual source
  resume, and this generated document. Any number you invent here is discarded, and guessing
  one wastes output tokens.
- "ats_keywords_from_jd", "ats_keywords_added_to_resume" and "keyword_gap" must contain only
  terms that literally appear in the supplied job description. Never invent a keyword. These
  lists are verified against the posting and recomputed downstream.

AUDIT SCORE RUBRIC (audit_report.score - this one IS yours to compute):
Start at 100 and subtract, then report the integer result. Do NOT default to a round number.
  -15  a role, certification, or date from the source is missing or altered
  -10  any metric, employer, technology, or title that is not traceable to the source
${budgetRubricLine}
   -8  more than half of the bullets carry a number, or the same bullet skeleton repeats
   -6  each unresolved ATS cohesion flag (gap, inconsistent dates, acronym mismatch)
   -5  passive ownership phrasing survives anywhere in the document
   -4  a banned verb appears
    -4  a bullet uses "we", "our", "I" or "my", or a STAR action is told as "we"
   -3  a core JD requirement is absent from the resume body AND missing from keyword_gap
   -3  each star_stories entry whose "bullet" does not match a bullet you emitted verbatim
Two documents with different flaws MUST receive different scores.

OUTPUT JSON SCHEMA (MUST MATCH EXACTLY):
${OUTPUT_SCHEMA}
`;
}

export interface RoleBulletPromptOptions {
  role: { role?: string; company?: string; duration?: string };
  /** The role's source bullets: the only evidence the model may use. */
  sourceBullets: string[];
  budget: BulletBudget;
  targetRole?: string;
  targetCompany?: string;
  audience?: string;
  /** Reader brief from buildAudienceBrief(mix, "role"). */
  audienceBrief?: string;
  mode?: string;
  customPrompt?: string;
  brainDump?: string;
  jobDescription?: string;
  jdKeywords?: string[];
  /** STAR stories to draft from this role; 0 asks for none. */
  starStoryCount?: number;
  /** Pipeline-specific rules appended after the shared standard. */
  extraRules?: string[];
  /** Problems found in a previous attempt, fed back for one corrective retry. */
  retryFeedback?: { issues: string[]; previousBullets: string[] };
  currentDate?: string;
  /** The candidate's bullet rules, rendered ahead of the tenure tiers when active. */
  bulletRules?: BulletRules | null;
  /** How the platform rule chose its platform (planBulletBudgets().platform). */
  platformDecision?: PlatformDecision | null;
  /** The candidate's other material for this role; the caller adds it to the figure provenance index too. */
  supportingEvidence?: RoleSupportingEvidence;
  /**
   * formatRoleEvidenceBrief(analysis, sourceBullets): the posting requirements this
   * role's own bullets prove, and what must never be claimed.
   */
  evidenceBrief?: string;
  /** buildTrendBrief(trends, { scope: "role", ... }) for this role. */
  trendBrief?: string;
}

function roleBudgetSection(
  budget: BulletBudget,
  rules: BulletRules | null,
  platform: PlatformDecision | null | undefined,
  ruleRole: boolean,
  extras: { supporting: boolean; brainDump: boolean } = { supporting: false, brainDump: false }
): string {
  if (!rules && !ruleRole) {
    const shortStint = budget.max === 1
      ? "\n  For a stint this short, state the single thing that was actually delivered and stop."
      : "";
    return `BULLET BUDGET FOR THIS ROLE - HARD LIMIT: ${budgetCountPhrase(budget)}.
  Why: ${budget.reason}. Budgets follow tenure first, then recency (first match wins):
${describeBudgetRules("  ")}${shortStint}
  ${BUDGET_ENFORCEMENT}`;
  }

  const setBy = ruleRole
    ? "One of the candidate's own bullet rules set this count."
    : "No bullet rule claims this role, so the tenure tiers set its count.";
  const single = budget.max === 1
    ? ruleRole
      ? "\n  The candidate keeps this role to one bullet: state the achievement most relevant to the target posting and stop."
      : "\n  For a stint this short, state the single thing that was actually delivered and stop."
    : "";
  const sources = [
    extras.supporting ? "\n    * use the SUPPORTING EVIDENCE above where it is clearly about this role;" : "",
    extras.brainDump ? "\n    * use the brain dump above only where it is clearly about this role;" : "",
  ].join("");
  const expansion = ruleRole
    ? `

GROUNDED EXPANSION - this role's count is the candidate's own choice:
  - When the source lists fewer distinct achievements than the minimum, reach it by drawing out
    more of the work the source already shows:
    * split a compound source bullet into its separate, genuine achievements;
    * develop the systems, tools, and scope the title and bullets name - what was designed,
      built, secured, migrated, automated, or operated, and for whom;${sources}
  - When the source holds more achievements than the ceiling, keep the ones most relevant to the
    target posting. Never cram several achievements into one bullet to fit more in.
  - Never add a figure, employer, client, certification, or technology the candidate's material
    does not show, and never restate one achievement to reach the count. Falling short of the
    minimum is a failure the platform reports; inventing to reach it is a worse one.`
    : "";
  return `BULLET BUDGET FOR THIS ROLE - HARD LIMIT: ${budgetCountPhrase(budget)}.
  Why: ${budget.reason}. ${setBy}
  Budgets follow the candidate's bullet rules first, then tenure:
${describeBudgetRules("  ", { rules, platform })}${single}
  ${ruleRole ? RULE_ROLE_ENFORCEMENT : BUDGET_ENFORCEMENT}${expansion}`;
}

/**
 * The supporting evidence a role prompt actually shows: other versions minus the
 * role's own bullets, and the skills list for rule roles only. Callers index
 * exactly this, so the validator accepts what the model was shown and no more.
 */
export function supportingEvidenceLists(
  evidence: RoleSupportingEvidence | undefined,
  sourceBullets: string[],
  ruleRole: boolean
): { otherVersions: string[]; skills: string[] } {
  if (!evidence) return { otherVersions: [], skills: [] };
  const own = new Set(sourceBullets.map(evidenceKey).filter(Boolean));
  return {
    otherVersions: cleanEvidenceList(evidence.otherVersions, MAX_SUPPORTING_BULLETS, own),
    skills: ruleRole ? cleanEvidenceList(evidence.skills, MAX_SUPPORTING_SKILLS) : [],
  };
}

function supportingEvidenceSection(
  evidence: RoleSupportingEvidence | undefined,
  sourceBullets: string[],
  ruleRole: boolean
): string {
  const { otherVersions: versions, skills } = supportingEvidenceLists(evidence, sourceBullets, ruleRole);
  if (!versions.length && !skills.length) return "";
  const lines = [
    "",
    "SUPPORTING EVIDENCE - the candidate's own material beyond this role's bullets. Use it only to",
    "deepen work this role's source already shows; it never adds a new employer, client, or figure:",
  ];
  if (versions.length) {
    lines.push("  The candidate's other resume versions of this same role:");
    lines.push(...versions.map((text) => `    - ${text}`));
  }
  if (skills.length) {
    lines.push(
      "  The candidate's skills list - name one in this role only where it fits work this role's source",
      `  describes and the role's dates: ${skills.join(", ")}`
    );
  }
  return lines.join("\n");
}

/**
 * Prompt for rewriting ONE role, used by the default split-generation pipeline.
 *
 * Carries the same FAANG, STAR and budget standards as the whole-document
 * prompt, plus the job description, so bullets written role-by-role are tailored
 * and budgeted exactly like bullets written in a single pass.
 */
export function buildRoleBulletPrompt(options: RoleBulletPromptOptions): string {
  const {
    role,
    sourceBullets,
    budget,
    targetRole,
    targetCompany,
    audience,
    audienceBrief,
    mode,
    customPrompt,
    brainDump,
    jobDescription,
    jdKeywords,
    starStoryCount = 0,
    extraRules = [],
    retryFeedback,
    currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    bulletRules,
    platformDecision,
    supportingEvidence,
    trendBrief,
    evidenceBrief,
  } = options;

  const framework = starFrameworkFor(targetCompany);
  const evidence = sourceBullets.length > 0
    ? sourceBullets.map((b, i) => `  ${i + 1}. ${b}`).join("\n")
    : "  (no bullets in the source - write only what the title and company alone support)";
  const tenure = budget.tenureMonths !== null ? `${budget.tenureMonths} months` : "tenure unreadable";
  const rulesInForce = activeBulletRules(bulletRules);
  const ruleRole = isRuleBasis(budget.basis);
  const supporting = supportingEvidenceSection(supportingEvidence, sourceBullets, ruleRole);
  const budgetSection = roleBudgetSection(budget, rulesInForce, platformDecision, ruleRole, {
    supporting: supporting.length > 0,
    brainDump: Boolean(brainDump),
  });
  const evidenceHeader = supporting
    ? "SOURCE EVIDENCE FOR THIS ROLE (the primary record - every bullet must rest on it, or on the\nSUPPORTING EVIDENCE below):"
    : "SOURCE EVIDENCE FOR THIS ROLE (the only facts you may use):";
  const trendBriefText = typeof trendBrief === "string" ? trendBrief.trim() : "";
  const evidenceBriefText = typeof evidenceBrief === "string" ? evidenceBrief.trim() : "";

  const rules = [
    ZERO_FABRICATION,
    FAANG_BULLET_STANDARD,
    BULLET_SHAPE,
    METRIC_DISCIPLINE,
    VERB_POLICY,
    `JD TAILORING. Select which of this role's achievements to feature, and order them, by
   relevance to the target posting: the closest work comes first. Mirror the posting's
   vocabulary only where the underlying work genuinely occurred. Tailoring changes
   emphasis, selection, and wording - never facts.${
      jdKeywords && jdKeywords.length > 0 ? `\n   Priority JD keywords: ${jdKeywords.join(", ")}.` : ""
    }${
      evidenceBriefText
        ? `\n   The POSTING REQUIREMENTS THIS ROLE PROVES section above is authoritative: lead with the\n   bullets it names, and never claim what it says never to claim.`
        : ""
    }`,
    ...(trendBriefText ? [indentBlock(trendBriefText, "   ").trimStart()] : []),
    EXCLUSION_RULE,
    ...extraRules,
  ];

  const starSection = starStoryCount > 0
    ? `=== STAR STORIES (interview preparation) ===
Draft up to ${starStoryCount} STAR ${starStoryCount === 1 ? "story" : "stories"} from this role's strongest bullets. Each
"bullet" field MUST be copied VERBATIM from your "bullets" array - stories that match no
bullet are discarded by the platform. Draft fewer, or none, if the source cannot support a
real answer.

${starStoryStandard(framework)}`
    : `Return "star_stories" as an empty array for this role.`;

  const retrySection = retryFeedback && retryFeedback.issues.length > 0
    ? `
=== CORRECTIONS REQUIRED - your previous attempt was rejected ===
The platform's checks found these problems:
${retryFeedback.issues.map((issue) => `- ${issue}`).join("\n")}
Previous attempt, for reference only (fix every problem above; do not repeat them):
${retryFeedback.previousBullets.map((b) => `- ${b}`).join("\n")}
`
    : "";

  return `ACT AS:
Principal Resume Intelligence Architect + Tier-1 Technical Recruiter, holding the FAANG
hiring bar. You are rewriting ONE role of a resume; every other role is written separately.
${KEYWORD_TARGET_RULE}
Your output is consumed by a JSON parser, never read as prose by a human.

TARGET ROLE: ${targetRole || "Professional"}
TARGET COMPANY: ${targetCompany || "General Product Tech"}
AUDIENCE: ${audience || "Recruiters"} | MODE: ${mode || "Standard"} | CURRENT DATE: ${currentDate}
CORPORATE DNA: ${corporateDnaFor(targetCompany)}
  Tailor emphasis only. Never rename, reframe, or alter a factual claim to fit a company.
${section(audienceBrief, `\n${audienceBrief}\n`)}
${section(customPrompt, `CUSTOM INSTRUCTIONS: ${customPrompt}`)}

ROLE TO REWRITE:
  Title: ${role.role || "(untitled)"}
  Company: ${role.company || "(unnamed)"}
  Dates: ${role.duration || "(none given)"} - ${tenure}

${evidenceHeader}
${evidence}${supporting}
${section(evidenceBriefText, `\n${evidenceBriefText}\n`)}
${section(
    brainDump,
    `BRAIN DUMP (raw, unverified): ${brainDump}
Use only what is clearly about THIS role at THIS company. Ignore anything unverifiable.`
  )}

${budgetSection}

=== STAR GROUNDING (silent reasoning; DO NOT emit as prose) ===
${STAR_GROUNDING}

=== WRITING RULES (all mandatory) ===
${rules.map((rule, i) => `${i + 1}. ${rule}`).join("\n\n")}
${section(
    jobDescription,
    `
=== TARGET JOB DESCRIPTION (tailor this role against it) ===
${jobDescription}`
  )}

${starSection}
${retrySection}
OUTPUT:
Return ONE valid JSON object and nothing else - no markdown fences, no commentary:
{
  "bullets": ["string"],
  "star_stories": [ { "bullet": "string, copied VERBATIM from bullets", ${STAR_STORY_FIELDS} } ]
}
`;
}
