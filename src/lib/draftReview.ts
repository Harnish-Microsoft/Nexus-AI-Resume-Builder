/**
 * Reviews a generated resume and corrects it before it is delivered - a closed
 * loop, where the old multi-agent "review" produced feedback nothing applied.
 *
 *   1. Code checks every editable part of the draft: excluded capabilities,
 *      figures the candidate's material never states, and posting terms or
 *      skills the material never mentions.
 *   2. One model call reviews the draft against the candidate's material and the
 *      verified requirement evidence map: unsupported claims, and proven
 *      requirements the draft never surfaces.
 *   3. One model call rewrites ONLY the flagged parts. Each replacement is
 *      re-checked in code and rejected if it still breaks a rule; nothing else in
 *      the document can change.
 *   4. The candidate's exclusions are enforced in code, and whatever is still
 *      wrong is reported - never silently shipped.
 *
 * Bounded at one review call and one correction call. Never throws: a failed
 * call degrades to the checks in code.
 *
 * Dependency-free apart from the other src/lib modules (esbuild + vite).
 */

import { EXCLUSION_RULE, excludedTermsQuoted, findExcludedTerms, removeExcludedSkills } from "./exclusions";
import type { ExclusionRemoval } from "./exclusions";
import { buildFigureIndex, findUnsupportedFigures } from "./impactScore";
import type { FigureIndex } from "./impactScore";
import { jdRequirementTerms, prepareEvidenceText, termAbsent, termEvidence } from "./matchScore";
import type { Corpus } from "./matchScore";
import { formatDocumentEvidenceBrief, parseModelJson } from "./requirementEvidence";
import type { CandidateMaterial, RequirementAnalysis } from "./requirementEvidence";
import { deleteSegments, readSegment, resumeSegments, writeSegment } from "./resumeSegments";
import type { ResumeSegment, ResumeSegmentKind } from "./resumeSegments";

export type DraftIssueType =
  | "excluded_term"
  | "unsupported_figure"
  | "unsupported_term"
  | "unsupported_skill"
  | "unsupported_claim"
  | "missed_evidence";

export interface DraftIssue {
  /** A resumeSegments() id, e.g. "E2.3". */
  location: string;
  type: DraftIssueType;
  problem: string;
  fix?: string;
  /** "check" = found by code, "review" = found by the reviewer model. */
  origin: "check" | "review";
}

export interface DraftReviewContext {
  /** Everything a figure may come from: resume, brain dump, custom prompt, other resumes. */
  figureSourceText: string;
  /** The candidate's own material, which a named skill or posting term must appear in. */
  evidenceText: string;
  /** Shown to the reviewer and the editor; falls back to evidenceText. */
  material?: CandidateMaterial | null;
  analysis?: RequirementAnalysis | null;
  jobDescription: string;
  targetRole?: string;
  jdKeywords?: string[];
}

export interface VerificationFix {
  location: string;
  label: string;
  problems: string[];
  before: string;
  /** Empty when the item was deleted. */
  after: string;
}

export interface VerificationIssue {
  location: string;
  label: string;
  type: DraftIssueType;
  problem: string;
  text: string;
}

export interface DraftVerificationReport {
  method: "draft-review-v1";
  ai_review: "completed" | "skipped" | "failed";
  corrections: "applied" | "none_needed" | "skipped" | "failed";
  issues_found: number;
  fixed: VerificationFix[];
  remaining: VerificationIssue[];
  /** What code removed to enforce the candidate's exclusions. */
  removed: ExclusionRemoval[];
}

export type DraftModelCall = (prompt: string, purpose: "review" | "correction") => Promise<string>;

const MAX_REVIEW_ISSUES = 12;
const MAX_PROMPT_SEGMENT = 400;
/** Figures are checked where the impact audit checks them: bullets, plus project descriptions. */
const FIGURE_KINDS = new Set<ResumeSegmentKind>(["bullet", "project"]);
/**
 * Where naming a posting term the material never mentions is a claim. Not "why
 * this job", where wanting to grow into a missing skill is honest; the reviewer
 * still judges claims there.
 */
const TERM_KINDS = new Set<ResumeSegmentKind>(["summary", "skill", "bullet", "project", "project_title"]);
const DELETABLE = new Set<ResumeSegmentKind>(["bullet", "skill"]);
const MAX_LENGTH: Record<ResumeSegmentKind, number> = {
  summary: 1500,
  why_this_job: 1500,
  skill_category: 60,
  skill: 100,
  bullet: 450,
  project: 600,
  project_title: 120,
};
const KIND_GUIDE: Record<ResumeSegmentKind, string> = {
  summary: "a 50-100 word professional summary",
  why_this_job: "a 75-125 word answer",
  skill_category: "a skills category name of 1-4 words",
  skill: "one short skills entry",
  bullet: "one bullet",
  project: "a project description of at most 2 sentences",
  project_title: "a project title",
};

function clip(text: string, max: number): string {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 3).trimEnd()}...` : value;
}

function quoteList(items: string[]): string {
  return items.map((item) => `"${item}"`).join(", ");
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/* ------------------------------------------------------------------ *
 * Checks in code
 * ------------------------------------------------------------------ */

interface CheckTools {
  figures: FigureIndex | null;
  evidence: Corpus;
  /** Posting terms with no trace in the candidate's material (excluded ones are checked separately). */
  absentTerms: string[];
}

function prepareChecks(ctx: DraftReviewContext): CheckTools {
  let figures: FigureIndex | null = null;
  try {
    figures = buildFigureIndex(ctx.figureSourceText || "");
  } catch (e: any) {
    console.warn("[draftReview] Figure provenance unavailable:", e?.message || e);
  }
  const evidence = prepareEvidenceText(ctx.evidenceText || "");
  const absentTerms = jdRequirementTerms(ctx.jobDescription, ctx.targetRole, ctx.jdKeywords)
    .map((entry) => entry.term)
    .filter((term) => findExcludedTerms(term).length === 0 && termAbsent(term, evidence));
  return { figures, evidence, absentTerms };
}

type Finding = Omit<DraftIssue, "location" | "origin">;

/** What code finds wrong with one piece of text. */
function checkText(text: string, kind: ResumeSegmentKind, tools: CheckTools): Finding[] {
  const out: Finding[] = [];
  const excluded = findExcludedTerms(text);
  if (excluded.length > 0) {
    out.push({
      type: "excluded_term",
      problem: `Names ${quoteList(excluded)}, which the candidate has excluded.`,
      fix: "Describe the concrete work without naming it, or remove it.",
    });
  }
  if (tools.figures && FIGURE_KINDS.has(kind)) {
    const unsupported = findUnsupportedFigures(text, tools.figures);
    if (unsupported.length > 0) {
      out.push({
        type: "unsupported_figure",
        problem: `States ${quoteList(unsupported)}, which the candidate's material never states.`,
        fix: "Use the material's exact figure, or remove it.",
      });
    }
  }
  let named: string[] = [];
  if (TERM_KINDS.has(kind) && tools.absentTerms.length > 0) {
    const corpus = prepareEvidenceText(text);
    named = tools.absentTerms.filter((term) => termEvidence(term, corpus) === 1);
    if (named.length > 0) {
      out.push({
        type: "unsupported_term",
        problem: `Names ${quoteList(named)} from the posting, which the candidate's material never mentions.`,
        fix: "Remove it: a requirement the candidate cannot show belongs in the keyword gap.",
      });
    }
  }
  if (kind === "skill" && excluded.length === 0 && named.length === 0 && termAbsent(text, tools.evidence)) {
    out.push({
      type: "unsupported_skill",
      problem: `Lists "${clip(text, 60)}", which the candidate's material never mentions.`,
      fix: "Remove it unless the material shows it.",
    });
  }
  return out;
}

function inspectWith(resume: any, tools: CheckTools): DraftIssue[] {
  const issues: DraftIssue[] = [];
  for (const segment of resumeSegments(resume)) {
    for (const finding of checkText(segment.text, segment.kind, tools)) {
      issues.push({ location: segment.id, origin: "check", ...finding });
    }
  }
  return issues;
}

/** Every problem code can find in the draft. */
export function inspectDraft(resume: any, ctx: DraftReviewContext): DraftIssue[] {
  return inspectWith(resume, prepareChecks(ctx));
}

/** One issue per location and type, code's findings first. */
function mergeIssues(...lists: DraftIssue[][]): DraftIssue[] {
  const seen = new Set<string>();
  const out: DraftIssue[] = [];
  for (const issue of lists.flat()) {
    const key = `${issue.location}|${issue.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

function groupByLocation(issues: DraftIssue[]): Map<string, DraftIssue[]> {
  const groups = new Map<string, DraftIssue[]>();
  for (const issue of issues) groups.set(issue.location, [...(groups.get(issue.location) || []), issue]);
  return groups;
}

function toVerificationIssues(segments: ResumeSegment[], issues: DraftIssue[]): VerificationIssue[] {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  return issues.flatMap((issue) => {
    const segment = byId.get(issue.location);
    return segment
      ? [{ location: issue.location, label: segment.label, type: issue.type, problem: issue.problem, text: segment.text }]
      : [];
  });
}

/* ------------------------------------------------------------------ *
 * The review call
 * ------------------------------------------------------------------ */

function renderDraft(resume: any): string {
  return resumeSegments(resume)
    .map((segment) => `[${segment.id}] ${segment.label}: ${clip(segment.text, MAX_PROMPT_SEGMENT)}`)
    .join("\n");
}

function materialText(ctx: DraftReviewContext): string {
  return ctx.material?.text || ctx.evidenceText || "";
}

export function buildDraftReviewPrompt(resume: any, ctx: DraftReviewContext, known: DraftIssue[] = []): string {
  const evidenceMap = formatDocumentEvidenceBrief(ctx.analysis);
  const missedEvidence = evidenceMap
    ? `- "missed_evidence": a REQUIRED requirement the evidence map marks PROVEN that the draft never
  surfaces anywhere. Point at the least relevant bullet of the role the evidence comes from.\n`
    : "";
  const alreadyFound = known.length
    ? `\n=== ALREADY FOUND BY CODE (do not repeat) ===\n${known
        .map((issue) => `- [${issue.location}] ${issue.type}: ${issue.problem}`)
        .join("\n")}\n`
    : "";
  return `ACT AS:
A skeptical hiring manager and fact-checker. Compare the DRAFT resume with the CANDIDATE MATERIAL -
the only admissible facts - and report real problems only. Your output is parsed by code.

REPORT:
- "unsupported_claim": a draft statement the candidate material does not support - an invented or
  inflated tool, scope, scale, team size, ownership, leadership, outcome or metric, or a skill
  presented as held that the material never shows. Rewording real work in the posting's
  vocabulary is NOT a problem.
- "excluded_term": the draft names or implies one of the candidate's excluded capabilities
  (${excludedTermsQuoted()}), including through a synonym presented as a skill. Job titles,
  employer names and certification names are exempt.
${missedEvidence}DO NOT REPORT: style, tone, verb choice, bullet counts, ordering, or anything already found.

Each issue: { "location": a draft id in brackets, such as "E2.3", "type": one of the types above,
"problem": under 25 words, "fix": under 25 words }. At most ${MAX_REVIEW_ISSUES}, most serious first.
A clean draft returns { "issues": [] }.

OUTPUT - ONE JSON object, nothing else:
{ "issues": [ { "location": "E1.2", "type": "unsupported_claim", "problem": "string", "fix": "string" } ] }
${alreadyFound}${evidenceMap ? `\n${evidenceMap}\n` : ""}
=== CANDIDATE MATERIAL ===
${materialText(ctx)}

=== DRAFT (ids in brackets) ===
${renderDraft(resume)}
`;
}

const REVIEW_TYPES = new Set<DraftIssueType>(["unsupported_claim", "excluded_term", "missed_evidence"]);

/** The reviewer's issues that point at a real location. Throws when the reply is not JSON. */
export function parseDraftReview(raw: unknown, resume: any): DraftIssue[] {
  const data = parseModelJson(raw);
  if (data === null || typeof data !== "object") throw new Error("the review reply was not JSON");
  const list = Array.isArray(data) ? data : Array.isArray(data.issues) ? data.issues : [];
  const ids = new Set(resumeSegments(resume).map((segment) => segment.id));
  const out: DraftIssue[] = [];
  for (const item of list) {
    if (out.length >= MAX_REVIEW_ISSUES) break;
    const location = asText(item?.location).replace(/^\[|\]$/g, "");
    if (!ids.has(location)) continue;
    const problem = clip(asText(item?.problem), 200);
    if (!problem) continue;
    const type: DraftIssueType = REVIEW_TYPES.has(item?.type) ? item.type : "unsupported_claim";
    const fix = clip(asText(item?.fix), 200);
    out.push({ location, type, problem, ...(fix ? { fix } : {}), origin: "review" });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The correction call
 * ------------------------------------------------------------------ */

export function buildCorrectionPrompt(resume: any, ctx: DraftReviewContext, issues: DraftIssue[]): string {
  const segments = new Map(resumeSegments(resume).map((segment) => [segment.id, segment]));
  const items = Array.from(groupByLocation(issues))
    .map(([location, list]) => {
      const segment = segments.get(location);
      if (!segment) return "";
      const problems = list.map((issue) => `  - ${issue.type}: ${issue.problem}${issue.fix ? ` Fix: ${issue.fix}` : ""}`);
      return `[${location}] ${segment.label} - ${KIND_GUIDE[segment.kind]}\n  current: "${segment.text}"\n${problems.join("\n")}`;
    })
    .filter(Boolean);
  const evidenceMap = formatDocumentEvidenceBrief(ctx.analysis);
  return `ACT AS:
A meticulous resume editor. Fix ONLY the flagged items below, using nothing but the CANDIDATE
MATERIAL. Your output is parsed by code, and every replacement is checked again and rejected if it
still breaks a rule.

RULES:
1. Every fact must come from the CANDIDATE MATERIAL: no new tool, figure, scope, employer,
   certification or outcome. Remove an unsupported claim; never swap it for another one.
2. ${EXCLUSION_RULE}
3. Keep each item's job and style. A bullet stays ONE past-tense bullet, opening with a strong
   action verb, in implied first person, one to two lines. A skills entry stays a short skill name.
4. For "missed_evidence", rewrite the flagged bullet so it surfaces the quoted evidence, using only
   what that evidence states.
5. When nothing true can be said, return "" for a bullet or skills entry to delete it. A summary,
   project, title or "why this job" answer is never deleted - rewrite it instead.
6. Return ONLY the flagged ids; anything else is ignored.

OUTPUT - ONE JSON object, nothing else:
{ "corrections": [ { "location": "E1.2", "text": "the corrected text, or an empty string to delete" } ] }

=== FLAGGED ITEMS ===
${items.join("\n\n")}
${evidenceMap ? `\n${evidenceMap}\n` : ""}
=== CANDIDATE MATERIAL ===
${materialText(ctx)}
`;
}

/** The editor's replacements. Throws when the reply is not JSON. */
export function parseCorrections(raw: unknown): { location: string; text: string }[] {
  const data = parseModelJson(raw);
  if (data === null || typeof data !== "object") throw new Error("the correction reply was not JSON");
  const list = Array.isArray(data) ? data : Array.isArray(data.corrections) ? data.corrections : [];
  return list
    .filter((item: any) => item && typeof item.location === "string" && typeof item.text === "string")
    .map((item: any) => ({ location: item.location.trim().replace(/^\[|\]$/g, ""), text: item.text }));
}

/**
 * Applies replacements to flagged locations only, each re-checked in code;
 * deletions last, so the addresses they use stay valid. Returns what changed.
 */
function applyCorrections(
  resume: any,
  corrections: { location: string; text: string }[],
  issues: DraftIssue[],
  tools: CheckTools
): VerificationFix[] {
  const flagged = groupByLocation(issues);
  const segments = new Map(resumeSegments(resume).map((segment) => [segment.id, segment]));
  const fixed: VerificationFix[] = [];
  const deletions = new Map<string, VerificationFix>();
  const handled = new Set<string>();

  for (const correction of corrections) {
    const segment = segments.get(correction.location);
    const problems = flagged.get(correction.location);
    if (!segment || !problems || handled.has(segment.id)) continue;
    handled.add(segment.id);
    const text = correction.text.replace(/\s+/g, " ").trim();
    const record: VerificationFix = {
      location: segment.id,
      label: segment.label,
      problems: problems.map((issue) => issue.problem),
      before: segment.text,
      after: text,
    };
    if (!text) {
      if (DELETABLE.has(segment.kind)) deletions.set(segment.id, record);
      continue;
    }
    if (text === segment.text.trim() || text.length > MAX_LENGTH[segment.kind]) continue;
    if (checkText(text, segment.kind, tools).length > 0) continue;
    if (writeSegment(resume, segment.id, text)) fixed.push(record);
  }
  for (const id of deleteSegments(resume, Array.from(deletions.keys()))) {
    const record = deletions.get(id);
    if (record) fixed.push(record);
  }
  return fixed;
}

/* ------------------------------------------------------------------ *
 * The candidate's exclusions, enforced in code
 * ------------------------------------------------------------------ */

/**
 * Removes excluded capabilities from the skills section, and drops bullets that
 * still name one when their role keeps another bullet. Never throws.
 */
export function enforceExclusions(resume: any): ExclusionRemoval[] {
  const removed = removeExcludedSkills(resume);
  try {
    (Array.isArray(resume?.experience) ? resume.experience : []).forEach((role: any, index: number) => {
      if (!role || !Array.isArray(role.bullets)) return;
      const names = (bullet: unknown) => (typeof bullet === "string" ? findExcludedTerms(bullet) : []);
      const kept = role.bullets.filter((bullet: unknown) => names(bullet).length === 0);
      if (kept.length === role.bullets.length || kept.length === 0) return;
      const label = [role.role, role.company].filter((v: unknown) => typeof v === "string" && v.trim()).join(" @ ") || `Role ${index + 1}`;
      for (const bullet of role.bullets) {
        const terms = names(bullet);
        if (terms.length > 0) {
          removed.push({
            label,
            text: bullet,
            reason: `Named ${terms.join(", ")}, which you excluded, and could not be rewritten without it.`,
          });
        }
      }
      role.bullets = kept;
    });
  } catch (e: any) {
    console.warn("[draftReview] Could not enforce exclusions on bullets:", e?.message || e);
  }
  return removed;
}

function emptyReport(state: "skipped" | "failed"): DraftVerificationReport {
  return {
    method: "draft-review-v1",
    ai_review: state,
    corrections: state,
    issues_found: 0,
    fixed: [],
    remaining: [],
    removed: [],
  };
}

/** A verification report rebuilt from untrusted JSON (a server result), or null. */
export function coerceVerificationReport(value: unknown): DraftVerificationReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as Record<string, any>;
  if (report.method !== "draft-review-v1") return null;
  const list = (items: unknown) => (Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : []);
  const pick = <T extends string>(state: unknown, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly unknown[]).includes(state) ? (state as T) : fallback;
  return {
    method: "draft-review-v1",
    ai_review: pick(report.ai_review, ["completed", "skipped", "failed"] as const, "skipped"),
    corrections: pick(report.corrections, ["applied", "none_needed", "skipped", "failed"] as const, "skipped"),
    issues_found: Math.max(0, Number(report.issues_found) || 0),
    fixed: list(report.fixed),
    remaining: list(report.remaining),
    removed: list(report.removed),
  };
}

/**
 * The candidate's exclusions, enforced in code on the final document - roles the
 * client restores from the source after generation included. Idempotent; records
 * what it removes, and anything it cannot, in resume.draft_verification.
 */
export function applyExclusionGuarantee(resume: any): any {
  if (!resume || typeof resume !== "object") return resume;
  try {
    const removed = enforceExclusions(resume);
    const leftovers = resumeSegments(resume).filter((segment) => findExcludedTerms(segment.text).length > 0);
    const existing = coerceVerificationReport(resume.draft_verification);
    if (!existing && removed.length === 0 && leftovers.length === 0) {
      delete resume.draft_verification;
      return resume;
    }
    const report = existing || emptyReport("skipped");
    report.removed = [...report.removed, ...removed];
    report.remaining = [
      ...report.remaining.filter((issue) => issue.type !== "excluded_term"),
      ...leftovers.map((segment) => ({
        location: segment.id,
        label: segment.label,
        type: "excluded_term" as const,
        problem: `Names ${quoteList(findExcludedTerms(segment.text))}, which you excluded.`,
        text: segment.text,
      })),
    ];
    resume.draft_verification = report;
  } catch (e: any) {
    console.warn("[draftReview] Could not apply the exclusion guarantee:", e?.message || e);
  }
  return resume;
}

/**
 * Re-points the open issues at the delivered document. Call it after bullet
 * budgets and trend coverage, which can remove a flagged bullet or skill: an
 * issue whose text is gone is no longer the candidate's to review, and one whose
 * position moved gets its new address and label. Idempotent; never throws.
 */
export function refreshVerificationReport(resume: any): any {
  if (!resume || typeof resume !== "object") return resume;
  try {
    const report = coerceVerificationReport(resume.draft_verification);
    if (!report) return resume;
    const segments = resumeSegments(resume);
    report.remaining = report.remaining.flatMap((issue) => {
      const text = typeof issue?.text === "string" ? issue.text : "";
      const segment =
        segments.find((s) => s.id === issue.location && s.text === text) || segments.find((s) => s.text === text);
      return segment && text ? [{ ...issue, location: segment.id, label: segment.label }] : [];
    });
    resume.draft_verification = report;
  } catch (e: any) {
    console.warn("[draftReview] Could not refresh the remaining issues:", e?.message || e);
  }
  return resume;
}

/* ------------------------------------------------------------------ *
 * The loop
 * ------------------------------------------------------------------ */

/**
 * Checks, reviews and corrects the draft in place, and reports what happened.
 * Without a model call (fast mode) only the checks in code and the exclusion
 * guarantee run. Never throws.
 */
export async function reviewAndCorrectDraft(
  resume: any,
  ctx: DraftReviewContext,
  call?: DraftModelCall | null
): Promise<DraftVerificationReport> {
  const report = emptyReport(call ? "failed" : "skipped");
  if (!resume || typeof resume !== "object") return report;

  let tools: CheckTools | null = null;
  let checks: DraftIssue[] = [];
  try {
    tools = prepareChecks(ctx);
    checks = inspectWith(resume, tools);
  } catch (e: any) {
    console.warn("[draftReview] Checks in code failed:", e?.message || e);
  }

  let reviewed: DraftIssue[] = [];
  if (call) {
    try {
      reviewed = parseDraftReview(await call(buildDraftReviewPrompt(resume, ctx, checks), "review"), resume);
      report.ai_review = "completed";
    } catch (e: any) {
      console.warn("[draftReview] Review call failed; continuing with the checks in code:", e?.message || e);
    }
  }

  const issues = mergeIssues(checks, reviewed);
  report.issues_found = issues.length;
  // The reviewer's findings cannot be re-checked in code: they stay open while their text is unchanged.
  const reviewedText = new Map(reviewed.map((issue) => [issue, readSegment(resume, issue.location) ?? ""]));

  if (issues.length === 0) {
    report.corrections = call ? "none_needed" : "skipped";
  } else if (call && tools) {
    try {
      const corrections = parseCorrections(await call(buildCorrectionPrompt(resume, ctx, issues), "correction"));
      report.fixed = applyCorrections(resume, corrections, issues, tools);
      report.corrections = "applied";
    } catch (e: any) {
      console.warn("[draftReview] Correction call failed; the draft is kept as written:", e?.message || e);
    }
  } else {
    report.corrections = "skipped";
  }

  report.removed = enforceExclusions(resume);
  try {
    const segments = resumeSegments(resume);
    const unresolved = reviewed.flatMap((issue) => {
      const original = reviewedText.get(issue);
      const segment = original ? segments.find((s) => s.text === original) : undefined;
      return segment ? [{ ...issue, location: segment.id }] : [];
    });
    report.remaining = toVerificationIssues(segments, mergeIssues(tools ? inspectWith(resume, tools) : [], unresolved));
  } catch (e: any) {
    console.warn("[draftReview] Could not list the remaining issues:", e?.message || e);
  }
  return report;
}
