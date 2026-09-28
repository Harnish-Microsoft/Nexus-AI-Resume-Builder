/**
 * Tenure-proportionate bullet budgets: the single source of truth for how many
 * bullets each role may carry, and the deterministic enforcement of that rule.
 *
 * The rule used to exist only as prompt text. The default hybrid-gemini pipeline
 * writes bullets with a per-role prompt that never referenced it, and no path
 * checked the model's output, so counts were whatever the model chose. The budget
 * is now computed here, rendered into every generation prompt, and applied to the
 * finished document, where an over-budget role is trimmed weakest-first.
 *
 * Only imports impactScore.ts, which is itself dependency-free: this module is
 * bundled by both esbuild (server) and vite (browser).
 */

import { bulletStrength, buildFigureIndex, findUnsupportedFigures } from "./impactScore";
import type { FigureIndex } from "./impactScore";

export type BudgetBasis =
  | "short_stint"
  | "brief"
  | "sub_year"
  | "current_long"
  | "current_mid"
  | "older_than_10y"
  | "earlier_long"
  | "earlier_mid"
  | "unparseable";

interface BudgetTier {
  min: number;
  max: number;
  rule: string;
}

/**
 * Tiers in precedence order: tenure first, then recency, then age. Tenure
 * dominates deliberately - a long bullet list under a very short stint reads as
 * padding and undermines the credibility of the whole document.
 */
export const BUDGET_TIERS: Record<Exclude<BudgetBasis, "unparseable">, BudgetTier> = {
  short_stint: { min: 1, max: 1, rule: "Tenure of 2 months or less" },
  brief: { min: 1, max: 2, rule: "Tenure of 3 to 6 months" },
  sub_year: { min: 2, max: 3, rule: "Tenure of 7 to 12 months" },
  current_long: { min: 6, max: 7, rule: "Current or most recent substantial role, 24+ months" },
  current_mid: { min: 4, max: 5, rule: "Current or most recent substantial role, 13 to 23 months" },
  older_than_10y: { min: 1, max: 2, rule: "Earlier role that ended more than 10 years ago" },
  earlier_long: { min: 3, max: 4, rule: "Earlier role, 24+ months" },
  earlier_mid: { min: 2, max: 3, rule: "Earlier role, 13 to 23 months" },
};

/** A role whose dates cannot be read is never allowed deeper than the deepest tier. */
export const UNPARSEABLE_MAX = 7;

export interface BulletBudget {
  index: number;
  id?: string;
  role: string;
  company: string;
  duration: string;
  tenureMonths: number | null;
  /** Fewest bullets the tenure warrants; null when the dates are unparseable. */
  min: number | null;
  /** Hard ceiling, enforced after generation. */
  max: number;
  /** "6-7", "1", or null when the model decides. */
  label: string | null;
  basis: BudgetBasis;
  /** Short human-readable justification, e.g. "55 months, current role". */
  reason: string;
}

export interface BulletBudgetReportRole {
  role: string;
  company: string;
  duration: string;
  tenure_months: number | null;
  budget: string | null;
  min: number | null;
  max: number;
  basis: BudgetBasis;
  reason: string;
  /** Bullets the model produced before enforcement. */
  generated: number;
  /** Bullets that remain in the document. */
  delivered: number;
  status: "within" | "trimmed" | "under" | "unbudgeted";
  /** Bullets removed by enforcement, in their original order. */
  removed: string[];
}

export interface BulletBudgetReport {
  method: string;
  roles: BulletBudgetReportRole[];
  trimmed: number;
  /** True when every role with a budget sits inside it. */
  compliant: boolean;
}

/* ------------------------------------------------------------------ *
 * Date parsing
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const ONGOING_PATTERN = /\b(?:present|current|currently|now|ongoing|today)\b/;

/** "Jan 2024", "Jan-2024", "Jan/2024", "January 15, 2024", "Sept. 2021". */
const MONTH_YEAR_PATTERN = /\b([a-z]{3,9})\.?(?:[\s\-/]*\d{1,2}(?:st|nd|rd|th)?)?[\s,\-/]*(\d{4})\b/g;
/** "Jan '24", "Jan-24", "Jan/24" - a bare space is ambiguous with a day, so it is not accepted. */
const MONTH_SHORT_YEAR_PATTERN = /\b([a-z]{3,9})\.?\s*['\u2019\-/]\s*(\d{2})\b/g;
/** "2024 Jan", "2024-January". */
const YEAR_MONTH_PATTERN = /\b(\d{4})[\s,\-/]*([a-z]{3,9})\b/g;
const MONTH_WORD =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/;

interface Endpoint {
  date: Date;
  ongoing: boolean;
}

/** First month-name/year pair in the text whose word is a real month. */
function findMonthYear(
  s: string,
  pattern: RegExp,
  monthGroup = 1,
  yearGroup = 2
): { month: number; year: string } | null {
  const re = new RegExp(pattern.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(s)) !== null) {
    const month = MONTHS[match[monthGroup].slice(0, 3)];
    if (month !== undefined) return { month, year: match[yearGroup] };
  }
  return null;
}

function expandShortYear(yy: number, now: Date): number {
  return yy <= (now.getFullYear() % 100) + 1 ? 2000 + yy : 1900 + yy;
}

function parseEndpoint(part: string, isEnd: boolean, now: Date): Endpoint | null {
  const s = part.trim().toLowerCase();
  if (!s) return null;
  if (ONGOING_PATTERN.test(s)) return { date: now, ongoing: true };

  const monthYear = findMonthYear(s, MONTH_YEAR_PATTERN);
  if (monthYear) return { date: new Date(Number(monthYear.year), monthYear.month, 1), ongoing: false };

  const monthShortYear = findMonthYear(s, MONTH_SHORT_YEAR_PATTERN);
  if (monthShortYear) {
    return {
      date: new Date(expandShortYear(Number(monthShortYear.year), now), monthShortYear.month, 1),
      ongoing: false,
    };
  }

  const yearMonth = findMonthYear(s, YEAR_MONTH_PATTERN, 2, 1);
  if (yearMonth) return { date: new Date(Number(yearMonth.year), yearMonth.month, 1), ongoing: false };

  const numeric = s.match(/\b(\d{1,2})[/\-.](\d{4})\b/);
  if (numeric) {
    const m = Number(numeric[1]);
    if (m >= 1 && m <= 12) return { date: new Date(Number(numeric[2]), m - 1, 1), ongoing: false };
  }

  const isoish = s.match(/\b(\d{4})[/\-.](\d{1,2})\b/);
  if (isoish) {
    const m = Number(isoish[2]);
    if (m >= 1 && m <= 12) return { date: new Date(Number(isoish[1]), m - 1, 1), ongoing: false };
  }

  // A month we could not pin down must not silently widen to a whole year.
  if (MONTH_WORD.test(s)) return null;

  const yearOnly = s.match(/\b(?:19|20)\d{2}\b/);
  if (yearOnly) {
    const y = Number(yearOnly[0]);
    // A bare year covers the whole year: Jan 1 as a start, Dec 31 as an end.
    return { date: isEnd ? new Date(y, 11, 31) : new Date(y, 0, 1), ongoing: false };
  }

  return null;
}

export interface DurationRange {
  start: Date;
  end: Date;
  ongoing: boolean;
}

/**
 * Best-effort parse of a duration string such as "Mar 2022 - Present",
 * "Jan 2024 - Feb 2024", "Jan-2024 - Feb-2024", "Jan '24 - Mar '24", "2016 - 2019",
 * "05/2019 - 08/2021", "2019-05 - 2021-08" or "Jan 2020 to date". Returns null for
 * anything it cannot read confidently, such as "Freelance" - a wrong budget is
 * worse than no budget.
 */
export function parseDurationRange(duration: unknown, now: Date = new Date()): DurationRange | null {
  if (typeof duration !== "string") return null;
  const text = duration
    .replace(/\b(?:till|to|until|up to)\s+(?:date|now|today)\b/gi, " - Present")
    .trim();
  if (!text) return null;

  let parts = text
    .split(/\s+[-\u2013\u2014]+\s+|\s*[\u2013\u2014]+\s*|\s+(?:to|until|through|thru)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  // "2016-2019" and "Jan 2024-Feb 2024" use an unspaced hyphen. Only split on it
  // when nothing else separated the endpoints, so "2019-05 - 2021-08" survives.
  if (parts.length < 2) {
    parts = text.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean);
  }
  if (parts.length < 2) return null;

  const start = parseEndpoint(parts[0], false, now);
  const end = parseEndpoint(parts[parts.length - 1], true, now);
  if (!start || !end) return null;
  if (end.date.getTime() < start.date.getTime()) return null;
  return { start: start.date, end: end.date, ongoing: end.ongoing };
}

function monthsInclusive(start: Date, end: Date): number {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, months + 1);
}

/** Tenure of a role in whole months (inclusive), or null when the duration cannot be parsed. */
export function parseTenureMonths(duration: unknown, now: Date = new Date()): number | null {
  const range = parseDurationRange(duration, now);
  return range ? monthsInclusive(range.start, range.end) : null;
}

/* ------------------------------------------------------------------ *
 * Budget computation
 * ------------------------------------------------------------------ */

function asText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function validNow(now: unknown): Date {
  return now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
}

function basisPhrase(basis: BudgetBasis, ongoing: boolean): string {
  switch (basis) {
    case "short_stint":
      return "short stint";
    case "brief":
      return "brief role";
    case "sub_year":
      return "under a year";
    case "current_long":
    case "current_mid":
      return ongoing ? "current role" : "most recent substantial role";
    case "older_than_10y":
      return "ended over 10 years ago";
    case "earlier_long":
    case "earlier_mid":
      return "earlier role";
    default:
      return "dates unreadable";
  }
}

/**
 * Computes the budget for every role in a list. Recency is decided by the actual
 * end dates rather than array position, so an out-of-order extraction cannot hand
 * the "current role" depth to the wrong job.
 *
 * The recency tier goes to any ongoing role and to the most recent SUBSTANTIAL
 * (over 12 months) role, so a candidate whose latest gig was a short contract
 * still gets full depth on the multi-year role that preceded it.
 */
export function computeBulletBudgets(roles: unknown, options: { now?: Date } = {}): BulletBudget[] {
  const list: any[] = Array.isArray(roles) ? roles : [];
  const now = validNow(options.now);
  const ranges = list.map((role) => parseDurationRange(role?.duration, now));
  const tenure = ranges.map((range) => (range ? monthsInclusive(range.start, range.end) : null));

  let latestSubstantialEnd = -Infinity;
  ranges.forEach((range, i) => {
    const months = tenure[i];
    if (range && months !== null && months > 12) {
      latestSubstantialEnd = Math.max(latestSubstantialEnd, range.end.getTime());
    }
  });
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate()).getTime();

  return list.map((raw, index) => {
    const base = {
      index,
      id: typeof raw?.id === "string" && raw.id ? raw.id : undefined,
      role: asText(raw?.role ?? raw?.title),
      company: asText(raw?.company),
      duration: asText(raw?.duration),
    };
    const range = ranges[index];
    const months = tenure[index];

    if (!range || months === null) {
      return {
        ...base,
        tenureMonths: null,
        min: null,
        max: UNPARSEABLE_MAX,
        label: null,
        basis: "unparseable" as const,
        reason: `dates unreadable - model decides, max ${UNPARSEABLE_MAX}`,
      };
    }

    let basis: Exclude<BudgetBasis, "unparseable">;
    if (months <= 2) basis = "short_stint";
    else if (months <= 6) basis = "brief";
    else if (months <= 12) basis = "sub_year";
    else if (range.ongoing || range.end.getTime() === latestSubstantialEnd) {
      basis = months >= 24 ? "current_long" : "current_mid";
    } else if (range.end.getTime() < tenYearsAgo) basis = "older_than_10y";
    else basis = months >= 24 ? "earlier_long" : "earlier_mid";

    const tier = BUDGET_TIERS[basis];
    return {
      ...base,
      tenureMonths: months,
      min: tier.min,
      max: tier.max,
      label: tier.min === tier.max ? `${tier.min}` : `${tier.min}-${tier.max}`,
      basis,
      reason: `${months} months, ${basisPhrase(basis, range.ongoing)}`,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Prompt rendering (so the prompt text can never drift from the code)
 * ------------------------------------------------------------------ */

/** The tier rules as prompt lines, in precedence order. */
export function describeBudgetRules(indent = "   "): string {
  const lines = (Object.keys(BUDGET_TIERS) as (keyof typeof BUDGET_TIERS)[]).map((key) => {
    const tier = BUDGET_TIERS[key];
    const count = tier.min === tier.max ? `exactly ${tier.min} bullet` : `${tier.min}-${tier.max} bullets`;
    return `${indent}- ${tier.rule}: ${count}`;
  });
  lines.push(
    `${indent}- Dates that cannot be read (e.g. "Freelance"): proportionate to the evidence, never more than ${UNPARSEABLE_MAX}`
  );
  return lines.join("\n");
}

/** One line per role, for the whole-document prompt. */
export function formatBudgetTable(budgets: BulletBudget[], indent = "   "): string {
  return budgets
    .map((budget) => {
      const who = [budget.role, budget.company].filter(Boolean).join(" @ ") || `Role ${budget.index + 1}`;
      const ref = budget.id ? `${budget.id}: ` : "";
      const count =
        budget.label === null
          ? `model decides, never more than ${budget.max}`
          : budget.min === budget.max
            ? `EXACTLY ${budget.min}`
            : `${budget.min}-${budget.max}`;
      return `${indent}- ${ref}${who} (${budget.duration || "no dates"}) -> ${count} bullets [${budget.reason}]`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * Enforcement
 * ------------------------------------------------------------------ */

function normalizeKey(text: unknown): string {
  return asText(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function roleKey(entry: any): string {
  return [entry?.company, entry?.role ?? entry?.title, entry?.duration].map(normalizeKey).join("|");
}

function isUsableBullet(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The strongest `max` bullets, in their original order. Strength uses the same
 * signals the impact audit scores; bullets carrying a figure the source never
 * states are pushed down, bullets backing a STAR story are protected, and a small
 * prior respects the model's own ordering (which the prompts tie to relevance to
 * the posting). Ties go to the earlier bullet.
 */
export function pickStrongestBullets(
  bullets: string[],
  max: number,
  options: { protectedKeys?: Set<string>; figureIndex?: FigureIndex | null } = {}
): { kept: string[]; removed: string[] } {
  const usable = bullets.filter(isUsableBullet);
  const limit = Math.max(0, Math.floor(max));
  if (usable.length <= limit) return { kept: usable, removed: [] };

  const total = usable.length;
  const ranked = usable.map((text, idx) => {
    let score = bulletStrength(text);
    if (options.figureIndex && findUnsupportedFigures(text, options.figureIndex).length > 0) score -= 3;
    if (options.protectedKeys && options.protectedKeys.has(normalizeKey(text))) score += 3;
    score += total > 1 ? 1 - idx / (total - 1) : 0;
    return { idx, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const keep = new Set(ranked.slice(0, limit).map((r) => r.idx));
  return {
    kept: usable.filter((_, idx) => keep.has(idx)),
    removed: usable.filter((_, idx) => !keep.has(idx)),
  };
}

/** Provenance only refines the trim order, so a failure here must never block enforcement. */
function safeFigureIndex(sourceText: string | undefined): FigureIndex | null {
  if (!sourceText) return null;
  try {
    return buildFigureIndex(sourceText);
  } catch (e: any) {
    console.warn("[bulletBudget] Figure provenance unavailable; trimming by strength alone:", e?.message || e);
    return null;
  }
}

/**
 * Enforces every role's ceiling on a generated resume, mutating resume.experience
 * and attaching resume.bullet_budget_report.
 *
 * Over-budget roles keep their strongest bullets (by the same signals the impact
 * audit scores), with bullets backing a STAR story protected and a small prior for
 * the model's own ordering, which the prompts tie to relevance to the posting.
 * Kept bullets retain their original order.
 *
 * A role below its minimum is reported, never padded: inventing a bullet to meet
 * a count is exactly the fabrication the rest of the pipeline exists to prevent.
 *
 * Idempotent, and it carries a previous report forward so a second application
 * (server, then client) still shows what the first one removed. Never throws.
 */
export function enforceBulletBudgets(
  resume: any,
  options: { now?: Date; sourceText?: string } = {}
): BulletBudgetReport | null {
  if (!resume || typeof resume !== "object" || !Array.isArray(resume.experience)) return null;

  try {
    const experience: any[] = resume.experience;
    const budgets = computeBulletBudgets(experience, { now: options.now });

    const previous = new Map<string, BulletBudgetReportRole>();
    const priorRoles = resume.bullet_budget_report?.roles;
    if (Array.isArray(priorRoles)) {
      for (const prior of priorRoles) {
        if (prior && typeof prior === "object") previous.set(roleKey(prior), prior);
      }
    }

    const protectedBullets = new Set<string>();
    if (Array.isArray(resume.star_stories)) {
      for (const story of resume.star_stories) {
        const key = normalizeKey(story?.bullet);
        if (key) protectedBullets.add(key);
      }
    }

    const figureIndex = safeFigureIndex(options.sourceText);

    const roles: BulletBudgetReportRole[] = experience.map((entry, i) => {
      const budget = budgets[i];
      const bullets: string[] = Array.isArray(entry?.bullets) ? entry.bullets.filter(isUsableBullet) : [];
      let kept = bullets;
      let removed: string[] = [];

      if (bullets.length > budget.max) {
        const picked = pickStrongestBullets(bullets, budget.max, { protectedKeys: protectedBullets, figureIndex });
        kept = picked.kept;
        removed = picked.removed;
        entry.bullets = kept;
      }

      const prior = previous.get(roleKey(entry));
      const priorRemoved = Array.isArray(prior?.removed) ? prior!.removed.filter(isUsableBullet) : [];
      const allRemoved = [...priorRemoved, ...removed];
      const generated = Math.max(
        typeof prior?.generated === "number" ? prior.generated : 0,
        bullets.length
      );
      const delivered = kept.length;

      let status: BulletBudgetReportRole["status"];
      if (allRemoved.length > 0) status = "trimmed";
      else if (budget.label === null) status = "unbudgeted";
      else if (budget.min !== null && delivered < budget.min) status = "under";
      else status = "within";

      return {
        role: budget.role,
        company: budget.company,
        duration: budget.duration,
        tenure_months: budget.tenureMonths,
        budget: budget.label,
        min: budget.min,
        max: budget.max,
        basis: budget.basis,
        reason: budget.reason,
        generated,
        delivered,
        status,
        removed: allRemoved,
      };
    });

    const report: BulletBudgetReport = {
      method: "tenure-bullet-budget-v1",
      roles,
      trimmed: roles.reduce((sum, r) => sum + r.removed.length, 0),
      compliant: roles.every((r) => r.status !== "under" && r.delivered <= r.max),
    };
    resume.bullet_budget_report = report;
    return report;
  } catch (e: any) {
    console.warn("[bulletBudget] Budget enforcement failed; document left as generated:", e?.message || e);
    return null;
  }
}
