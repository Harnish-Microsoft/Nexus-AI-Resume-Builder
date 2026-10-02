/**
 * Read-only views of the candidate's bullet rules for the settings panel: the
 * plan each role of the current resume would get, computed with the same
 * planner the optimizer uses, plus small helpers for editing the rules.
 */
import {
  BULLET_RULE_LIMITS,
  activeBulletRules,
  companiesMatch,
  companyMatchKey,
  isRuleBasis,
  planBulletBudgets,
  rolesFromResumeText,
  type BudgetPlan,
  type BulletBudget,
  type BulletRange,
  type PageFitDecision,
  type PlatformDecision,
} from "./bulletBudget";

export type PreviewBadge = "pinned" | "recent" | "platform" | "tenure" | "unreadable";

export interface PreviewRow {
  key: string;
  role: string;
  company: string;
  duration: string;
  /** "6-7", "2", or "up to 7" when the dates cannot be read. */
  label: string;
  max: number;
  /** "rule" when a bullet rule set the count, "system" for the tenure tiers. */
  source: "rule" | "system";
  badge: PreviewBadge;
  badgeText: string;
  reason: string;
  /** The label before the page-fit cap lowered it; null when untouched. */
  fitFrom: string | null;
  matchedTerms: string[];
}

export interface RulesPreview {
  /** The rules are switched on; otherwise the rows show the tenure-only plan. */
  active: boolean;
  /**
   * ready: rows planned from a JSON resume. free-text: roles are only known after
   * extraction. empty: no resume yet. error: the roles could not be planned.
   */
  status: "ready" | "free-text" | "empty" | "error";
  rows: PreviewRow[];
  /** Sum of every role's ceiling: the most bullets the document can carry. */
  totalMax: number;
  platform: PlatformDecision | null;
  platformNote: string | null;
  pageFit: PageFitDecision | null;
  pageFitNote: string | null;
}

/** "6-7", or "2" when the range is a single count. */
export function rangeText(range: BulletRange): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function badgeFor(budget: BulletBudget, platform: PlatformDecision | null): { badge: PreviewBadge; text: string } {
  switch (budget.basis) {
    case "pinned":
      return { badge: "pinned", text: "Pinned" };
    case "recent":
      return { badge: "recent", text: "Recent" };
    case "platform_match": {
      const names = platform && platform.names.length > 0 ? platform.names.join("/") : "Platform";
      return { badge: "platform", text: `${names} (${platform?.source === "jd" ? "JD" : "keyword"})` };
    }
    case "unparseable":
      return { badge: "unreadable", text: "Dates unreadable" };
    default:
      return { badge: "tenure", text: "Tenure" };
  }
}

function toRow(budget: BulletBudget, platform: PlatformDecision | null): PreviewRow {
  const { badge, text } = badgeFor(budget, platform);
  return {
    key: `${budget.index}`,
    role: budget.role,
    company: budget.company,
    duration: budget.duration,
    label: budget.label ?? `up to ${budget.max}`,
    max: budget.max,
    source: isRuleBasis(budget.basis) ? "rule" : "system",
    badge,
    badgeText: text,
    reason: budget.reason,
    fitFrom: budget.fit ? budget.fit.label ?? `up to ${budget.fit.max}` : null,
    matchedTerms: budget.matchedTerms ?? [],
  };
}

function describePlatform(plan: BudgetPlan, rows: PreviewRow[]): string | null {
  const decision = plan.platform;
  if (!plan.rules || !decision) return null;
  const shown = rows.filter((row) => row.badge === "platform").length;
  const jd = decision.jd_platforms.join("/");
  const keywords = plan.rules.platform.keywords;
  if (decision.source === "jd") {
    return `${decision.names.join("/")} is named in the job description; ${plural(shown, "other role")} show${shown === 1 ? "s" : ""} it.`;
  }
  if (decision.source === "keywords") {
    const lead = jd
      ? `The job description names ${jd}, but no other role shows it, so your keywords were used`
      : plan.rules.platform.detectFromJd
        ? "No platform is named in the job description, so your keywords were used"
        : "Your keywords were used";
    return `${lead}: ${plural(shown, "other role")} show${shown === 1 ? "s" : ""} ${decision.names.join("/")}.`;
  }
  const terms = Array.from(new Set([...decision.jd_platforms, ...keywords]));
  if (terms.length === 0) {
    return "No platform to look for: add a keyword or paste a job description that names one.";
  }
  return `No other role shows ${terms.join("/")} experience, so the platform rule changes nothing here.`;
}

function describePageFit(fit: PageFitDecision | null): string | null {
  if (!fit) return null;
  if (fit.before <= fit.cap) {
    return `${fit.before} bullets at most - within the ${fit.cap}-bullet cap, nothing trimmed.`;
  }
  if (fit.after <= fit.cap) {
    return `${fit.before} -> ${fit.after} bullets: ${plural(fit.trimmed_roles, "older system role")} trimmed to fit the ${fit.cap}-bullet cap.`;
  }
  return (
    `${fit.before} -> ${fit.after} bullets, still over the ${fit.cap}-bullet cap: system roles are at 1 bullet and ` +
    "rule roles are never trimmed, so the PDF auto-fit takes over."
  );
}

/** What each role of the current resume would get under these rules. */
export function buildRulesPreview(
  rulesInput: unknown,
  resumeText: string,
  jobDescription: string,
  now: Date = new Date()
): RulesPreview {
  const rules = activeBulletRules(rulesInput);
  const empty: RulesPreview = {
    active: rules !== null,
    status: "empty",
    rows: [],
    totalMax: 0,
    platform: null,
    platformNote: null,
    pageFit: null,
    pageFitNote: null,
  };
  if (typeof resumeText !== "string" || !resumeText.trim()) return empty;
  const roles = rolesFromResumeText(resumeText);
  if (!roles) return { ...empty, status: "free-text" };
  try {
    const plan = planBulletBudgets(roles, { now, rules, jobDescription });
    const rows = plan.budgets.map((budget) => toRow(budget, plan.platform));
    return {
      ...empty,
      status: "ready",
      rows,
      totalMax: plan.budgets.reduce((sum, budget) => sum + budget.max, 0),
      platform: plan.platform,
      platformNote: describePlatform(plan, rows),
      pageFit: plan.pageFit,
      pageFitNote: describePageFit(plan.pageFit),
    };
  } catch {
    return { ...empty, status: "error" };
  }
}

/** Keywords typed as one line: commas, semicolons or new lines separate them. */
export function splitKeywords(text: string): string[] {
  return String(text ?? "")
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface PinRowStatus {
  /** "empty": no usable company name; "duplicate": an earlier row names the same company. */
  issue: "empty" | "duplicate" | null;
  /** Roles this row would claim (first matching pin wins, as in the planner); null when unknown. */
  matches: number | null;
}

/**
 * Mirrors normalizeBulletRules and planBulletBudgets for the pinned rows being
 * edited: which rows would be ignored, and how many roles each one would claim.
 * Pass roles = undefined for a free-text resume, whose roles are not known yet.
 */
export function pinRowStatus(roles: unknown, companies: string[]): PinRowStatus[] {
  const seen = new Set<string>();
  const cleaned = companies.map((company) =>
    String(company ?? "").replace(/\s+/g, " ").trim().slice(0, BULLET_RULE_LIMITS.maxTextLength)
  );
  const issues = cleaned.map((company) => {
    const key = companyMatchKey(company);
    if (!key) return "empty" as const;
    if (seen.has(key)) return "duplicate" as const;
    seen.add(key);
    return null;
  });
  const counts = cleaned.map(() => 0);
  const list = Array.isArray(roles) ? roles : null;
  for (const role of list ?? []) {
    const owner = cleaned.findIndex((company, i) => issues[i] === null && companiesMatch(company, role?.company));
    if (owner >= 0) counts[owner] += 1;
  }
  return issues.map((issue, i) => ({ issue, matches: list && issue === null ? counts[i] : null }));
}

/** One short phrase per active rule, in precedence order; empty when the rules are off. */
export function bulletRulesSummary(rulesInput: unknown): string[] {
  const rules = activeBulletRules(rulesInput);
  if (!rules) return [];
  const parts: string[] = [];
  for (const pin of rules.pinned) parts.push(`${pin.company}: ${rangeText(pin)}`);
  if (rules.recent.enabled && rules.recent.count > 0) {
    const which = rules.recent.count === 1 ? "Latest role" : `${rules.recent.count} latest roles`;
    parts.push(`${which}: ${rangeText(rules.recent)}`);
  }
  if (rules.platform.enabled) {
    const keywords = rules.platform.keywords.join("/");
    const what = rules.platform.detectFromJd
      ? keywords
        ? `JD platform or ${keywords}`
        : "JD platform"
      : keywords;
    if (what) parts.push(`${what}: ${rangeText(rules.platform)}`);
  }
  if (rules.pageFit.enabled) parts.push(`max ${rules.pageFit.maxTotalBullets} total`);
  return parts;
}
