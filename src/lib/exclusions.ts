/**
 * Capabilities the candidate has chosen never to claim, on every engine.
 *
 * The candidate's own decision: they lack the hands-on depth to present these as
 * skills, so no generated resume may name them, present a synonym as a stand-in
 * for them, or count them as a met requirement. A posting that asks for one gets
 * an honest gap instead.
 *
 * Job titles, employer names and certification names are never altered: they are
 * the candidate's verbatim history, even when they contain one of these words.
 *
 * Dependency-free: bundled by both esbuild (server) and vite (browser). No
 * lookbehind in any pattern (Safari 14, see matchScore.ts).
 */

export interface ExcludedCapability {
  /** The name shown to the candidate and in prompts. */
  term: string;
  /** Every wording that names it, spelled-out forms included. */
  pattern: RegExp;
}

export const EXCLUDED_CAPABILITIES: readonly ExcludedCapability[] = [
  {
    term: "CI/CD",
    pattern: /\bci\s*[\/&-]?\s*cd\b|\bcontinuous\s+(?:integration|delivery|deployment)\b/i,
  },
  { term: "Pipelines", pattern: /\bpipelines?\b/i },
  { term: "DevOps", pattern: /\bdevops\b/i },
  { term: "Terraform", pattern: /\bterraform\b/i },
];

/** The excluded capabilities a text names, in list order, each once. */
export function findExcludedTerms(text: unknown): string[] {
  if (typeof text !== "string" || !text) return [];
  return EXCLUDED_CAPABILITIES.filter((capability) => capability.pattern.test(text)).map((c) => c.term);
}

/** `"CI/CD", "Pipelines", "DevOps", "Terraform"`, for prompts. */
export function excludedTermsQuoted(): string {
  return EXCLUDED_CAPABILITIES.map((capability) => `"${capability.term}"`).join(", ");
}

/** The list without entries that name an excluded capability, e.g. for "priority keywords" in a prompt. */
export function withoutExcludedTerms(values: unknown): string[] {
  return (Array.isArray(values) ? values : []).filter(
    (value): value is string => typeof value === "string" && findExcludedTerms(value).length === 0
  );
}

/**
 * The rule every generation prompt carries, worded once so the whole-document,
 * meta and per-role prompts cannot drift apart.
 */
export const EXCLUSION_RULE = `CANDIDATE EXCLUSIONS - the candidate does not claim ${excludedTermsQuoted()}.
   - Never write these terms, including spelled-out forms such as "continuous integration".
   - Never list them, or a synonym standing in for them, as a skill, and never present them
     as a met requirement - even when the job description asks for them. A posting
     requirement for one of them is a gap and belongs in "keyword_gap".
   - Where the candidate's own material describes related work, describe only that concrete
     work in neutral terms (such as "infrastructure automation" or "workflow orchestration"),
     at the depth the material shows, without naming an excluded capability.
   - Job titles, employer names and certification names stay exactly as the source writes them.`;

export interface ExclusionRemoval {
  /** Where it was: "Skills", "Skills › Cloud", or a role. */
  label: string;
  text: string;
  reason: string;
}

const PLACEHOLDER = "\u0000";
const PART_SEPARATOR = /\s*(?:[,;|\/]|\s&\s|\sand\s)\s*/;

function balancedParentheses(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * The entry without the parts that name an excluded capability: "Bicep, Terraform"
 * keeps "Bicep". Null when nothing clean is left. The excluded wording is masked
 * before splitting, so "CI/CD" can never survive as "CI" and "CD".
 */
function stripExcludedParts(entry: string): string | null {
  let marked = entry;
  for (const capability of EXCLUDED_CAPABILITIES) {
    marked = marked.replace(new RegExp(capability.pattern.source, "gi"), PLACEHOLDER);
  }
  if (!marked.includes(PLACEHOLDER)) return entry;
  const kept = marked
    .split(PART_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part && !part.includes(PLACEHOLDER));
  if (kept.length === 0 || !kept.every(balancedParentheses)) return null;
  const text = kept.join(", ");
  return /[a-z0-9]/i.test(text) ? text : null;
}

/** The candidate's own renames for these category names, applied before anything is removed. */
const CATEGORY_RENAMES: Array<[RegExp, string]> = [
  [/\bci\s*[\/&-]?\s*cd(?:\s+pipelines?)?(?:\s+design)?\b/gi, "Infrastructure Provisioning"],
  [/\bdevops\b/gi, "Infrastructure Operations"],
];

/**
 * A category name without the excluded wording: "DevOps & Automation" becomes
 * "Infrastructure Operations & Automation", "Terraform & IaC" becomes "IaC".
 */
function cleanCategoryName(name: string): string {
  let cleaned = name;
  for (const [pattern, replacement] of CATEGORY_RENAMES) cleaned = cleaned.replace(pattern, replacement);
  for (const capability of EXCLUDED_CAPABILITIES) {
    cleaned = cleaned.replace(new RegExp(capability.pattern.source, "gi"), " ");
  }
  return cleaned
    .replace(/\s+/g, " ")
    .replace(/^(?:\s|[&,\/+|-]|and\b)+/i, "")
    .replace(/(?:\s|[&,\/+|-]|\band)+$/i, "")
    .replace(/\s*([&\/+|])\s*(?:[&\/+|]\s*)+/g, " $1 ")
    .trim();
}

function cleanEntries(entries: unknown[], label: string, removed: ExclusionRemoval[]): unknown[] {
  const out: unknown[] = [];
  for (const entry of entries) {
    if (typeof entry !== "string") {
      out.push(entry);
      continue;
    }
    if (findExcludedTerms(entry).length === 0) {
      out.push(entry);
      continue;
    }
    const kept = stripExcludedParts(entry);
    const terms = findExcludedTerms(entry).join(", ");
    removed.push({
      label,
      text: entry,
      reason: kept ? `Removed ${terms}, which you excluded; kept "${kept}".` : `Names ${terms}, which you excluded.`,
    });
    if (kept) out.push(kept);
  }
  return out;
}

/**
 * Removes the excluded capabilities from the skills section, whatever its shape:
 * entries that name one lose that part (or go entirely), and a category named
 * after one is renamed. Never throws; returns what was removed.
 */
export function removeExcludedSkills(resume: any): ExclusionRemoval[] {
  const removed: ExclusionRemoval[] = [];
  try {
    const skills = resume?.skills;
    if (Array.isArray(skills)) {
      resume.skills = cleanEntries(skills, "Skills", removed);
      return removed;
    }
    if (!skills || typeof skills !== "object") return removed;

    const rebuilt: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(skills as Record<string, unknown>)) {
      let key = name;
      if (!name.startsWith("_") && findExcludedTerms(name).length > 0) {
        key = cleanCategoryName(name) || "Additional Skills";
        removed.push({
          label: "Skills",
          text: name,
          reason: `Category renamed to "${key}": it named ${findExcludedTerms(name).join(", ")}, which you excluded.`,
        });
      }
      const label = `Skills \u203a ${key}`;
      let cleaned: unknown = value;
      if (Array.isArray(value)) {
        cleaned = cleanEntries(value, label, removed);
      } else if (typeof value === "string" && findExcludedTerms(value).length > 0) {
        cleaned = cleanEntries(value.split(","), label, removed)
          .map((entry) => String(entry).trim())
          .filter(Boolean)
          .join(", ");
      }
      const existing = rebuilt[key];
      if (Array.isArray(existing) && Array.isArray(cleaned)) {
        rebuilt[key] = [...existing, ...cleaned.filter((entry) => !existing.includes(entry))];
      } else {
        rebuilt[key] = cleaned;
      }
    }
    resume.skills = rebuilt;
  } catch (e: any) {
    console.warn("[exclusions] Could not clean the skills section:", e?.message || e);
  }
  return removed;
}
