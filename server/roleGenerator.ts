/**
 * Per-role bullet generation for the default split-generation pipeline
 * (POST /api/v2/optimize, hybrid-gemini branch).
 *
 * Each role is rewritten by its own model call using the shared per-role prompt
 * from src/lib/resumePrompt.ts, so the FAANG, STAR and budget standards are the
 * same ones the whole-document path uses. The output is then checked
 * mechanically (bullet count, lead verbs, ownership voice, figure provenance,
 * trending skills the candidate's material does not show), and a role that fails
 * gets one corrective retry that names the exact problems.
 *
 * Budgets follow the candidate's bullet rules first, then the tenure tiers. A
 * role whose count a rule set must reach the rule's minimum, through grounded
 * expansion of the candidate's own material: its source bullets, the same role
 * in the candidate's other resumes, the skills list and the brain dump.
 *
 * The final ceiling is applied later to the assembled document by
 * enforceBulletBudgets, so the report can show what was generated as well as
 * what was delivered.
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildRoleBulletPrompt, supportingEvidenceLists } from "../src/lib/resumePrompt";
import type { RoleBulletPromptOptions } from "../src/lib/resumePrompt";
import {
  companiesMatch,
  isRuleBasis,
  parseDurationRange,
  pickStrongestBullets,
  planBulletBudgets,
} from "../src/lib/bulletBudget";
import type { BudgetBasis, BudgetPlan, BulletBudget, BulletRules, DurationRange } from "../src/lib/bulletBudget";
import { buildTrendBrief, trendEvidenceText, unsupportedTrendMentions } from "../src/lib/linkedinTrends";
import type { LinkedInTrends, UnsupportedTrendMention } from "../src/lib/linkedinTrends";
import {
  buildFigureIndex,
  findUnsupportedFigures,
  inspectBullet,
  isWeVoice,
  linkStarStories,
} from "../src/lib/impactScore";
import type { FigureIndex } from "../src/lib/impactScore";

const PRIMARY_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";
/** Failed or unparseable calls tolerated per role before falling back to the source bullets. */
const MAX_CALL_FAILURES = 3;

/** This pipeline's long-standing terminology ban, now verified rather than only requested. */
const FORBIDDEN_TERMS: { pattern: RegExp; term: string }[] = [
  { pattern: /\bci\s*\/\s*cd\b/i, term: "CI/CD" },
  { pattern: /\bpipelines?\b/i, term: "Pipelines" },
  { pattern: /\bdevops\b/i, term: "DevOps" },
];

const TERMINOLOGY_RULE = `TERMINOLOGY BAN: the terms "CI/CD", "Pipelines", and "DevOps" are FORBIDDEN. Use
   "Infrastructure Automation", "Workflow Orchestration", or "Release Engineering" instead.`;

/** STAR stories drafted per role; depth follows the same tiers as the bullets. */
const STAR_QUOTA: Record<BudgetBasis, number> = {
  current_long: 2,
  current_mid: 2,
  recent: 2,
  platform_match: 1,
  pinned: 1,
  earlier_long: 1,
  earlier_mid: 1,
  sub_year: 1,
  unparseable: 1,
  brief: 0,
  short_stint: 0,
  older_than_10y: 0,
};

/** A role pinned to a short list gets no story of its own, like the other short tiers. */
function starQuotaFor(budget: BulletBudget): number {
  if (budget.basis === "pinned" && budget.max < 3) return 0;
  return STAR_QUOTA[budget.basis] ?? 0;
}

const RECENT_BASES = new Set<BudgetBasis>(["current_long", "current_mid", "recent"]);

export interface RoleOutput {
  bullets: string[];
  star_stories: any[];
}

export interface RoleValidation {
  /** Problems worth a corrective retry. */
  hard: string[];
  /** Problems handled deterministically downstream, recorded for the logs. */
  soft: string[];
}

export interface RoleGenerationResult {
  id: string;
  role: string;
  company: string;
  duration: string;
  bullets: string[];
  star_stories: any[];
  generation: {
    model_calls: number;
    retried: boolean;
    /** True when every call failed and the source bullets were used instead. */
    fallback: boolean;
    budget: string | null;
    basis: BudgetBasis;
    /** Problems remaining in the delivered attempt. */
    issues: string[];
  };
}

export interface GeneratePerRoleOptions {
  /** The target posting, already trimmed by the caller. */
  jobDescription?: string;
  jdKeywords?: string[];
  /** Reader brief from buildAudienceBrief(mix, "role"), shared by every role. */
  audienceBrief?: string;
  /**
   * Budgets the caller planned over these same roles, so the prompts, this
   * generator and the final enforcement agree. Used only when it holds one budget
   * per role; otherwise the plan is made here from bulletRules and the posting.
   */
  budgetPlan?: BudgetPlan | null;
  /** The candidate's bullet rules. Omitted or null: the tenure tiers alone. */
  bulletRules?: BulletRules | null;
  /** The candidate's other resumes ({name, data} records or resume objects). */
  referenceResumes?: unknown[];
  /** The candidate's skills: a list, categories, or comma-separated text. */
  skills?: unknown;
  /** Skills trending on LinkedIn for the target role. */
  trends?: LinkedInTrends | null;
  now?: Date;
}

export interface RoleValidationContext {
  /** Bullets in the role's own source. */
  sourceCount: number;
  figureIndex: FigureIndex | null;
  /** Bullets from the candidate's other versions of this role that the prompt showed. */
  supportingCount?: number;
  /** Trending skills; naming one that trendEvidence does not support is a hard issue. */
  trends?: LinkedInTrends | null;
  /** Everything the candidate's material shows for this role. */
  trendEvidence?: string;
}

/** Per-role material beyond the source bullets. */
interface RoleExtras {
  /** Bullets for this role from the candidate's other resumes, before filtering. */
  otherVersions: string[];
  /** The candidate's whole skills list. */
  skills: string[];
  trends: LinkedInTrends | null;
}

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const v = value as { text?: unknown; bullet?: unknown };
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.bullet === "string") return v.bullet.trim();
  }
  return "";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** The role's own evidence, whichever field the upstream extraction used. */
function sourceBulletsOf(role: any): string[] {
  const list = [role?.original_bullets, role?.achievements, role?.bullets].find(
    (candidate) => Array.isArray(candidate) && candidate.length > 0
  );
  return (Array.isArray(list) ? list : []).map(toText).filter(Boolean);
}

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function quoteList(items: string[]): string {
  return items.map((item) => `"${item}"`).join(", ");
}

function validDate(now: unknown): Date {
  return now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
}

/** Non-empty strings, trimmed, first occurrence kept. */
function stringList(values: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(values) ? values : []) {
    const text = toText(value);
    const key = normalizeKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** Every skill entry, whatever the section's shape: a list, categories, or comma-separated text. */
function skillList(skills: unknown): string[] {
  const split = (text: string) => text.split(",");
  const entry = (item: unknown) =>
    typeof item === "string"
      ? item
      : item && typeof item === "object"
        ? asText((item as any).name ?? (item as any).skill)
        : "";
  let entries: string[] = [];
  if (typeof skills === "string") entries = split(skills);
  else if (Array.isArray(skills)) entries = skills.map(entry);
  else if (skills && typeof skills === "object") {
    entries = Object.entries(skills as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("_"))
      .flatMap(([, items]) =>
        typeof items === "string" ? split(items) : Array.isArray(items) ? items.map(entry) : []
      );
  }
  return stringList(entries);
}

interface ReferenceRole {
  company: string;
  duration: string;
  bullets: string[];
}

/** The experience entries of the candidate's other resumes: {name, data} records, resume objects or JSON text. */
function referenceRolesOf(referenceResumes: unknown): ReferenceRole[] {
  const roles: ReferenceRole[] = [];
  for (const entry of Array.isArray(referenceResumes) ? referenceResumes : []) {
    let data: any = entry && typeof entry === "object" && "data" in entry ? (entry as any).data : entry;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        continue;
      }
    }
    const experience = data && typeof data === "object" && Array.isArray(data.experience) ? data.experience : [];
    for (const role of experience) {
      if (!role || typeof role !== "object") continue;
      const company = asText(role.company).trim();
      const bullets = sourceBulletsOf(role);
      if (company && bullets.length > 0) roles.push({ company, duration: asText(role.duration), bullets });
    }
  }
  return roles;
}

function rangesOverlap(a: DurationRange, b: DurationRange): boolean {
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

/**
 * Bullets for this same role in the candidate's other resumes: the same employer
 * and, when both entries have readable dates, overlapping dates, so two stints
 * at one employer stay apart.
 */
function otherVersionsOf(role: any, references: ReferenceRole[], now: Date): string[] {
  if (!references.length || !asText(role?.company).trim()) return [];
  const range = parseDurationRange(role?.duration, now);
  const out: string[] = [];
  for (const reference of references) {
    if (!companiesMatch(reference.company, role.company)) continue;
    const referenceRange = parseDurationRange(reference.duration, now);
    if (range && referenceRange && !rangesOverlap(range, referenceRange)) continue;
    out.push(...reference.bullets);
  }
  return out;
}

/** Parses the model's reply: the {bullets, star_stories} object, or a bare bullet array. */
export function parseRoleOutput(text: string): RoleOutput {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  const rawBullets = Array.isArray(parsed) ? parsed : parsed?.bullets;
  if (!Array.isArray(rawBullets)) throw new Error("response has no bullets array");
  const stories =
    !Array.isArray(parsed) && Array.isArray(parsed?.star_stories)
      ? parsed.star_stories.filter((story: unknown) => story !== null && typeof story === "object")
      : [];
  return { bullets: rawBullets.map(toText).filter(Boolean), star_stories: stories };
}

/** Words that carry no content, for the restatement check. */
const FILLER_WORDS = new Set([
  "the", "and", "for", "with", "across", "through", "into", "from", "that", "this", "their", "which",
  "while", "over", "via", "per", "its", "all", "each", "both", "using", "under",
]);
/** Bullets sharing this share of their content words say the same thing twice. */
const RESTATEMENT_SIMILARITY = 0.75;
const RESTATEMENT_MIN_WORDS = 5;

function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((word) => word.length >= 3 && !FILLER_WORDS.has(word))
      .map(stem)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function describeTrendMentions(mentions: UnsupportedTrendMention[]): string {
  const names = mentions.map((mention) => mention.name);
  return `the trending skill${names.length === 1 ? "" : "s"} ${quoteList(names)}`;
}

/**
 * Mechanical checks on one role's output against the rules its prompt states.
 *
 * For a role the tenure tiers budget, a count below the floor is only raised
 * when the source holds enough evidence to meet it: asking for more bullets than
 * the source supports would ask for fabrication. A role one of the candidate's
 * bullet rules budgets must reach the rule's minimum - the prompt shows it how to
 * by grounded expansion - unless it has no evidence at all to expand.
 *
 * With trends, a bullet naming a trending skill the role's material does not
 * show is a hard issue: trends are used only where the candidate has the evidence.
 */
export function validateRoleOutput(
  output: RoleOutput,
  budget: BulletBudget,
  context: RoleValidationContext
): RoleValidation {
  const hard: string[] = [];
  const soft: string[] = [];
  const count = output.bullets.length;
  const target = budget.label === null ? `at most ${budget.max}` : budget.label;
  const ruleMin = isRuleBasis(budget.basis) && budget.min !== null ? budget.min : null;
  const supportingCount = Math.max(0, Number(context.supportingCount) || 0);

  if (ruleMin !== null) {
    if (count < ruleMin && context.sourceCount + supportingCount > 0) {
      const written = count === 1 ? "Only 1 bullet was" : `Only ${count} bullets were`;
      const shown = supportingCount > 0 ? "source bullets and supporting evidence" : "source bullets";
      hard.push(
        `${written} written. This role's budget is ${target} (${budget.reason}) - the candidate's own ` +
          `rule - so write at least ${ruleMin} distinct achievements. Reach it by grounded expansion: ` +
          `split compound source bullets into their separate achievements, and develop the systems, ` +
          `tools, and scope the title and ${shown} show. Never add a figure, employer, client, ` +
          `certification, or technology the material does not show, and never restate an achievement.`
      );
    } else if (count < ruleMin) {
      soft.push(
        `${count} bullet${count === 1 ? "" : "s"} against the rule minimum of ${ruleMin}; the source has ` +
          `no bullets to expand.`
      );
    }
  } else if (context.sourceCount > 0) {
    const floor = Math.min(budget.min ?? 1, context.sourceCount);
    if (count < floor) {
      hard.push(
        `Only ${count} bullet${count === 1 ? "" : "s"} were written. This role's budget is ${target} ` +
          `(${budget.reason}) and the source lists ${context.sourceCount} items of evidence: write at ` +
          `least ${floor} distinct achievements drawn from it - never invent one.`
      );
    }
  }
  if (count > budget.max) {
    soft.push(
      `${count} bullets exceed the ceiling of ${budget.max}; the weakest ${count - budget.max} will be trimmed.`
    );
  }

  const trends = context.trends && Array.isArray(context.trends.skills) && context.trends.skills.length > 0
    ? context.trends
    : null;
  const trendEvidence = typeof context.trendEvidence === "string" ? context.trendEvidence : null;

  const seen = new Map<string, number>();
  const distinct: Array<{ n: number; words: Set<string> }> = [];
  output.bullets.forEach((bullet, i) => {
    const n = i + 1;
    const inspection = inspectBullet(bullet);
    if (inspection.bannedLead) {
      hard.push(`Bullet ${n} opens with the banned verb "${inspection.lead}".`);
    }
    if (inspection.passive) {
      hard.push(`Bullet ${n} uses "${inspection.passive}" - state exactly what this person did.`);
    } else if (inspection.firstPerson) {
      hard.push(`Bullet ${n} uses "I" or "my" - write in implied first person, verb first.`);
    }
    const unsupported = context.figureIndex ? findUnsupportedFigures(bullet, context.figureIndex) : [];
    if (unsupported.length > 0) {
      hard.push(
        `Bullet ${n} states ${quoteList(unsupported)}, which the source never states - use the ` +
          `source's exact figure or remove it.`
      );
    }
    const forbidden = FORBIDDEN_TERMS.find((entry) => entry.pattern.test(bullet));
    if (forbidden) hard.push(`Bullet ${n} uses the forbidden term "${forbidden.term}".`);
    if (trends && trendEvidence !== null) {
      const mentions = unsupportedTrendMentions(bullet, trends, trendEvidence);
      if (mentions.length > 0) {
        hard.push(
          `Bullet ${n} names ${describeTrendMentions(mentions)}, which the candidate's material for this ` +
            `role never shows - describe the work the source shows instead.`
        );
      }
    }

    const key = normalizeKey(bullet);
    const first = seen.get(key);
    if (first !== undefined) {
      hard.push(`Bullet ${n} repeats bullet ${first}.`);
      return;
    }
    seen.set(key, n);
    if (ruleMin === null) return;
    // A rule's count invites padding: a reworded achievement is still one achievement.
    const words = contentWords(bullet);
    if (words.size < RESTATEMENT_MIN_WORDS) return;
    const twin = distinct.find((other) => jaccard(other.words, words) >= RESTATEMENT_SIMILARITY);
    if (twin) {
      hard.push(
        `Bullet ${n} restates bullet ${twin.n} in different words - each bullet must be a distinct ` +
          `achievement from the evidence.`
      );
    } else {
      distinct.push({ n, words });
    }
  });

  output.star_stories.forEach((story, j) => {
    const n = j + 1;
    if (isWeVoice(asText(story?.action))) {
      hard.push(`STAR story ${n}'s action is told as "we" - rewrite it in first person singular.`);
    }
    const narrative = ["situation", "task", "action", "result", "learning"]
      .map((field) => asText(story?.[field]))
      .join("\n");
    const unsupported = context.figureIndex ? findUnsupportedFigures(narrative, context.figureIndex) : [];
    if (unsupported.length > 0) {
      hard.push(
        `STAR story ${n} states ${quoteList(unsupported)}, which the source never states - list the ` +
          `missing detail in prep_gaps instead.`
      );
    }
  });

  return { hard, soft };
}

/** Keeps only the stories that quote one of this role's bullets, as the final audit will. */
function linkRoleStories(output: RoleOutput, role: any): number {
  const mini = {
    experience: [{ role: asText(role?.role), company: asText(role?.company), bullets: output.bullets }],
    star_stories: output.star_stories,
  };
  const { dropped } = linkStarStories(mini);
  output.star_stories = mini.star_stories;
  return dropped;
}

async function callModel(genAI: GoogleGenAI, prompt: string): Promise<string> {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  try {
    const res = await genAI.models.generateContent({
      model: PRIMARY_MODEL,
      contents,
      config: {
        responseMimeType: "application/json",
        // Low thinking keeps per-role calls cheap; the validator and retry carry the quality bar.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    return res.text || "";
  } catch (e: any) {
    console.warn(`[RoleGen] ${PRIMARY_MODEL} failed (${e?.message || e}), trying ${FALLBACK_MODEL}...`);
    const res = await genAI.models.generateContent({
      model: FALLBACK_MODEL,
      contents,
      config: { responseMimeType: "application/json" },
    });
    return res.text || "";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Prompt options every role shares. */
type SharedPromptOptions = Omit<
  RoleBulletPromptOptions,
  "role" | "sourceBullets" | "budget" | "starStoryCount" | "retryFeedback" | "supportingEvidence" | "trendBrief"
>;

/** The generatePerRole arguments that go into every role's prompt. */
export interface RolePromptContext {
  targetCompany?: string;
  targetRole?: string;
  audience?: string;
  mode?: string;
  customPrompt?: string;
  brainDump?: string;
}

/** Everything one role's generation needs, prepared without a model call. */
export interface RoleJob {
  index: number;
  /** The role as given, for linking STAR stories. */
  source: any;
  identity: { id: string; role: string; company: string; duration: string };
  /** For the logs. */
  label: string;
  budget: BulletBudget;
  sourceBullets: string[];
  /** buildRoleBulletPrompt options, without retry feedback. */
  prompt: Omit<RoleBulletPromptOptions, "retryFeedback">;
  validation: RoleValidationContext;
}

export interface RoleJobPlan {
  plan: BudgetPlan;
  jobs: RoleJob[];
}

function resolveBudgetPlan(roles: any[], options: GeneratePerRoleOptions, now: Date): BudgetPlan {
  const given = options.budgetPlan;
  if (given && Array.isArray(given.budgets) && given.budgets.length === roles.length) return given;
  return planBulletBudgets(roles, { now, rules: options.bulletRules ?? null, jobDescription: options.jobDescription });
}

function prepareRoleJob(
  role: any,
  index: number,
  budget: BulletBudget,
  shared: SharedPromptOptions,
  extras: RoleExtras
): RoleJob {
  const id = typeof role?.id === "string" && role.id ? role.id : `role_${index + 1}`;
  const identity = {
    id,
    role: asText(role?.role),
    company: asText(role?.company),
    duration: asText(role?.duration),
  };
  const label = `${id} (${[identity.role, identity.company].filter(Boolean).join(" @ ") || "untitled"})`;
  const sourceBullets = sourceBulletsOf(role);
  // Grounded expansion is for the roles the candidate's own rules set; the
  // system's roles keep exactly their own source.
  const ruleRole = isRuleBasis(budget.basis);
  // Exactly what the prompt will show, so the checks accept that and no more.
  const shown = supportingEvidenceLists(
    ruleRole ? { otherVersions: extras.otherVersions, skills: extras.skills } : undefined,
    sourceBullets,
    ruleRole
  );
  const hasSupport = shown.otherVersions.length > 0 || shown.skills.length > 0;

  let figureIndex: FigureIndex | null = null;
  try {
    figureIndex = buildFigureIndex(
      [
        ...sourceBullets,
        identity.role,
        identity.company,
        identity.duration,
        shared.brainDump,
        shared.customPrompt,
        ...shown.otherVersions,
        ...shown.skills,
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e: any) {
    // Provenance checks are skipped rather than failing the role.
    console.warn(`[RoleGen] ${label}: figure provenance unavailable:`, e?.message || e);
  }

  let trendBrief: string | undefined;
  let trendEvidence: string | undefined;
  if (extras.trends) {
    const own = [identity.role, ...sourceBullets, ...shown.otherVersions];
    trendBrief = buildTrendBrief(extras.trends, {
      scope: "role",
      evidenceText: trendEvidenceText(own),
      secondaryEvidenceText: trendEvidenceText(extras.skills),
    });
    // The brief lets a listed skill in where the source describes that work, and
    // the prompt lets the brain dump in where it is about this role.
    trendEvidence = trendEvidenceText([...own, ...extras.skills, asText(shared.brainDump)]);
  }

  return {
    index,
    source: role,
    identity,
    label,
    budget,
    sourceBullets,
    prompt: {
      ...shared,
      role: identity,
      sourceBullets,
      budget,
      starStoryCount: starQuotaFor(budget),
      ...(hasSupport ? { supportingEvidence: shown } : {}),
      ...(trendBrief ? { trendBrief } : {}),
    },
    validation: {
      sourceCount: sourceBullets.length,
      figureIndex,
      supportingCount: shown.otherVersions.length,
      trends: extras.trends,
      trendEvidence,
    },
  };
}

/**
 * Budgets, prompts and validation context for every role, without a model call.
 * Budgets need the whole list: recency is decided by comparing end dates.
 */
export function prepareRoleJobs(
  experience: unknown,
  context: RolePromptContext = {},
  options: GeneratePerRoleOptions = {}
): RoleJobPlan {
  const roles: any[] = Array.isArray(experience) ? experience : [];
  const now = validDate(options.now);
  const plan = resolveBudgetPlan(roles, options, now);
  const trends =
    options.trends && Array.isArray(options.trends.skills) && options.trends.skills.length > 0 ? options.trends : null;
  const skills = skillList(options.skills);
  const references = referenceRolesOf(options.referenceResumes);
  const shared: SharedPromptOptions = {
    targetRole: context.targetRole,
    targetCompany: context.targetCompany,
    audience: context.audience,
    audienceBrief: options.audienceBrief,
    mode: context.mode,
    customPrompt: context.customPrompt,
    brainDump: context.brainDump,
    jobDescription: options.jobDescription,
    jdKeywords: options.jdKeywords,
    extraRules: [TERMINOLOGY_RULE],
    currentDate: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    bulletRules: plan.rules,
    platformDecision: plan.platform,
  };

  const jobs = roles.map((role, index) =>
    prepareRoleJob(role, index, plan.budgets[index], shared, {
      otherVersions: otherVersionsOf(role, references, now),
      skills,
      trends,
    })
  );
  return { plan, jobs };
}

export type RoleModelCall = (prompt: string) => Promise<string>;

/**
 * Generates one role: a model call, the mechanical checks, and at most one
 * corrective retry. Falls back to the strongest source bullets when every call
 * fails.
 */
export async function runRoleJob(
  job: RoleJob,
  call: RoleModelCall,
  pause: (ms: number) => Promise<void> = sleep
): Promise<RoleGenerationResult> {
  const { identity, label, budget, sourceBullets } = job;

  let best: { output: RoleOutput; validation: RoleValidation } | null = null;
  let retryFeedback: RoleBulletPromptOptions["retryFeedback"];
  let modelCalls = 0;
  let failures = 0;
  let retried = false;

  while (failures < MAX_CALL_FAILURES) {
    const prompt = buildRoleBulletPrompt({ ...job.prompt, retryFeedback });

    let output: RoleOutput;
    try {
      modelCalls += 1;
      output = parseRoleOutput(await call(prompt));
    } catch (err: any) {
      failures += 1;
      console.warn(`[RoleGen] ${label}: call failed (${failures}/${MAX_CALL_FAILURES}):`, err?.message || err);
      // A failed corrective retry keeps the attempt already in hand.
      if (best) break;
      if (failures < MAX_CALL_FAILURES) await pause(1000 * failures);
      continue;
    }

    const droppedStories = linkRoleStories(output, job.source);
    const validation = validateRoleOutput(output, budget, job.validation);
    if (droppedStories > 0) {
      validation.soft.push(
        `${droppedStories} STAR ${droppedStories === 1 ? "story" : "stories"} did not quote a bullet verbatim and ${
          droppedStories === 1 ? "was" : "were"
        } discarded.`
      );
    }

    // A retry replaces the first attempt only when it is strictly cleaner.
    if (!best || validation.hard.length < best.validation.hard.length) best = { output, validation };
    if (validation.hard.length === 0 || retried) break;

    retried = true;
    retryFeedback = { issues: validation.hard, previousBullets: output.bullets };
    console.log(`[RoleGen] ${label}: ${validation.hard.length} issue(s), retrying with corrections.`);
  }

  if (!best) {
    const { kept } = pickStrongestBullets(sourceBullets, budget.max);
    console.warn(`[RoleGen] ${label}: all calls failed; using ${kept.length} source bullet(s).`);
    return {
      ...identity,
      bullets: kept,
      star_stories: [],
      generation: {
        model_calls: modelCalls,
        retried,
        fallback: true,
        budget: budget.label,
        basis: budget.basis,
        issues: ["generation failed; the source bullets were used"],
      },
    };
  }

  const issues = [...best.validation.hard, ...best.validation.soft];
  console.log(
    `[RoleGen] ${label}: ${best.output.bullets.length} bullet(s) for budget ${budget.label ?? `max ${budget.max}`}, ` +
      `${best.output.star_stories.length} STAR, ${modelCalls} call(s)` +
      (issues.length > 0 ? `; remaining: ${issues.join(" | ")}` : "")
  );
  return {
    ...identity,
    bullets: best.output.bullets,
    star_stories: best.output.star_stories,
    generation: {
      model_calls: modelCalls,
      retried,
      fallback: false,
      budget: budget.label,
      basis: budget.basis,
      issues,
    },
  };
}

export async function generatePerRole(
  experience: any[],
  geminiKey: string,
  targetCompany?: string,
  targetRole?: string,
  audience?: string,
  mode?: string,
  customPrompt?: string,
  brainDump?: string,
  options: GeneratePerRoleOptions = {}
): Promise<RoleGenerationResult[]> {
  const genAI = new GoogleGenAI({ apiKey: geminiKey });
  const { jobs } = prepareRoleJobs(
    experience,
    { targetCompany, targetRole, audience, mode, customPrompt, brainDump },
    options
  );
  const call: RoleModelCall = (prompt) => callModel(genAI, prompt);
  return Promise.all(jobs.map((job) => runRoleJob(job, call)));
}

function competencyKey(story: any): string {
  return asText(story?.competency).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Chooses the document's interview-prep stories from the per-role drafts: the
 * current role first, then one story per role per pass in document order, with
 * distinct competencies preferred because each interviewer in a loop is assigned
 * different ones.
 */
export function selectStarStories(
  roleResults: Array<{ star_stories?: any[]; generation?: { basis?: BudgetBasis } }>,
  limit = 6
): any[] {
  const results = Array.isArray(roleResults) ? roleResults : [];
  const isRecent = (r: { generation?: { basis?: BudgetBasis } }) =>
    r?.generation?.basis !== undefined && RECENT_BASES.has(r.generation.basis);
  const ordered = [...results.filter(isRecent), ...results.filter((r) => !isRecent(r))];
  const queues = ordered.map((r) => (Array.isArray(r?.star_stories) ? r.star_stories.filter(Boolean) : []));

  const picked: any[] = [];
  const deferred: any[] = [];
  const competencies = new Set<string>();

  for (let pass = 0; picked.length < limit; pass++) {
    let found = false;
    for (const queue of queues) {
      if (picked.length >= limit) break;
      const story = queue[pass];
      if (!story) continue;
      found = true;
      const key = competencyKey(story);
      if (key && competencies.has(key)) {
        deferred.push(story);
        continue;
      }
      if (key) competencies.add(key);
      picked.push(story);
    }
    if (!found) break;
  }
  for (const story of deferred) {
    if (picked.length >= limit) break;
    picked.push(story);
  }
  return picked;
}
