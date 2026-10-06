/**
 * Evidence-first JD analysis: a structured job brief and a verified
 * requirement-to-evidence map.
 *
 * One model call reads the full posting and the candidate's own material, and
 * returns the job brief plus, for every requirement, verbatim quotes from that
 * material. The quotes are then checked here, in code: a quote that cannot be
 * found in the material is discarded, and a requirement left without a verified
 * quote is "not_evidenced" whatever the model claimed. A requirement naming one
 * of the candidate's excluded capabilities is "excluded" unless verified evidence
 * covers the rest of it.
 *
 * The verified map then drives everything downstream:
 *   - generation prompts lead with proven requirements and name the ones that
 *     must never be claimed (resumePrompt.ts, roleGenerator.ts);
 *   - the draft review checks the output against it (draftReview.ts);
 *   - the results show it, apart from keyword coverage and writing quality.
 *
 * Dependency-free apart from the other src/lib modules: bundled by both esbuild
 * (server) and vite (browser). No lookbehind (Safari 14, see matchScore.ts).
 */

import { excludedTermsQuoted, findExcludedTerms } from "./exclusions";
import type { RequirementTier } from "./matchScore";

export type RequirementKind =
  | "skill"
  | "tool"
  | "experience"
  | "responsibility"
  | "certification"
  | "education"
  | "years"
  | "domain"
  | "soft_skill"
  | "eligibility"
  | "other";

const KINDS: readonly RequirementKind[] = [
  "skill", "tool", "experience", "responsibility", "certification", "education",
  "years", "domain", "soft_skill", "eligibility", "other",
];

export type EvidenceStatus = "evidenced" | "partial" | "not_evidenced" | "excluded";
const STATUSES: readonly EvidenceStatus[] = ["evidenced", "partial", "not_evidenced", "excluded"];

export type EvidenceSource = "resume" | "brain_dump" | "other_resume";
const SOURCES: readonly EvidenceSource[] = ["resume", "brain_dump", "other_resume"];

export interface EvidenceQuote {
  /** Text from the candidate's material, verified to occur there. */
  text: string;
  source: EvidenceSource;
  role?: string;
  company?: string;
  /** From a certification name: the candidate's verbatim history, never a skill claim. */
  verbatim?: boolean;
}

export interface JobRequirement {
  id: string;
  /** The requirement in the posting's words. */
  text: string;
  tier: RequirementTier;
  kind: RequirementKind;
  /** A non-negotiable eligibility condition: certification, degree, years, clearance, location... */
  hard_gate: boolean;
  status: EvidenceStatus;
  evidence: EvidenceQuote[];
  note?: string;
  /** What the model claimed when verification overruled it. */
  claimed_status?: EvidenceStatus;
}

export interface JobBrief {
  title: string;
  seniority: string;
  required_years: number | null;
  /** What the role exists to do, in one sentence. */
  summary: string;
  responsibilities: string[];
  outcomes: string[];
  /** ATS vocabulary, each verified to occur in the posting. */
  keywords: string[];
}

export interface EvidenceVerification {
  quotes_proposed: number;
  quotes_verified: number;
  /** Requirements the model called evidenced or partial with no quote found in the material. */
  downgraded: string[];
}

export interface RequirementAnalysis {
  method: "verified-evidence-v1";
  brief: JobBrief;
  requirements: JobRequirement[];
  verification: EvidenceVerification;
}

export interface EvidenceTierSummary {
  total: number;
  evidenced: number;
  partial: number;
  not_evidenced: number;
  excluded: number;
}

/** The analysis as shown with the results. */
export interface RequirementEvidenceReport extends RequirementAnalysis {
  /**
   * 0-100: how much of what the posting asks for the candidate's own material
   * proves. Partial counts half; nice-to-haves weigh half. Rewriting cannot
   * change it - only real experience can.
   */
  qualification_evidence: number | null;
  required: EvidenceTierSummary;
  preferred: EvidenceTierSummary;
  /** Required eligibility gates the material does not fully evidence. */
  hard_gaps: string[];
}

/* ------------------------------------------------------------------ *
 * Text helpers
 * ------------------------------------------------------------------ */

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function clipText(text: string, max: number): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 3).trimEnd()}...` : value;
}

/** Case, quotes and punctuation removed, so a faithful copy matches whatever its formatting. */
export function normalizeQuote(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\\[nrt]/g, " ")
    .replace(/[\u2018\u2019\u201c\u201d"'`]/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Best-effort JSON from a model reply: fences stripped, the outermost object or array parsed. */
export function parseModelJson(raw: unknown): any {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstObject = cleaned.indexOf("{");
  const firstArray = cleaned.indexOf("[");
  const isArray = firstArray !== -1 && (firstObject === -1 || firstArray < firstObject);
  const start = isArray ? firstArray : firstObject;
  const end = isArray ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function stringList(values: unknown, maxItems: number, maxChars: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(values) ? values : []) {
    const text = clipText(asText(value), maxChars);
    const key = normalizeQuote(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The candidate's material
 * ------------------------------------------------------------------ */

export interface MaterialSegment {
  text: string;
  source: EvidenceSource;
  role?: string;
  company?: string;
  /** A certification name: verbatim history, kept as written even when it names an excluded capability. */
  verbatim?: boolean;
}

export interface CandidateMaterial {
  /** What the model is shown, cut to fit when it must be. */
  text: string;
  /** Every segment, for verification - including any the cut left out. */
  segments: MaterialSegment[];
  /** The resume was structured JSON and was rendered section by section. */
  structured: boolean;
  /** Characters of material the model was not shown. */
  omitted_chars: number;
}

export interface CandidateMaterialOptions {
  /**
   * The candidate's other resumes ({name, data} records, resume objects or JSON
   * text). Pass them exactly when the writer is shown them too, so the analysis
   * and the review judge against the same facts the writer may use.
   */
  otherResumes?: unknown[];
  limit?: number;
}

/** What the requirement analysis is shown. Comfortably inside a flash model's context. */
export const MATERIAL_LIMIT = 60000;

/** An inline list: "Certifications: AZ-104, AZ-305". */
const INLINE_CERTIFICATIONS = /^(?:licen[cs]es?\s*(?:&|and)\s*)?certifications?(?:\s*(?:&|and)\s*licen[cs]es?)?\s*:\s*\S/i;
const LIST_MARKER = /^(?:[-*\u2022\u25cf\u25aa\u2013]|\d+[.)])\s+/;
/** Words that name a resume section, so a short line built on one is a heading. */
const SECTION_WORDS =
  /\b(?:experience|employment|history|background|career|education|skills|projects|summary|profile|objective|competencies|achievements|accomplishments|awards|honou?rs|publications|languages|interests|hobbies|references|volunteer(?:ing)?|training|courses|coursework|affiliations|memberships|activities|leadership|expertise|qualifications|highlights)\b/i;

/** The heading text of a short line that reads like a section heading, or null for content. */
function headingOf(line: string): string | null {
  if (LIST_MARKER.test(line)) return null;
  const text = line.replace(/^#{1,6}\s*/, "").replace(/^[*_]+|[*_]+$/g, "").trim();
  if (!text || text.length > 50 || /[.!?;,]$/.test(text) || text.split(/\s+/).length > 6) return null;
  if (/:\s*\S/.test(text)) return null;
  return text.replace(/\s*:$/, "");
}

/** "Certifications", "Licenses & Certifications", "Education & Certifications" - never one certificate's name. */
function isCertificationHeading(heading: string): boolean {
  return /\bcertifications\b|\blicen[cs]es\b|^certification$/i.test(heading);
}

/** Any other section heading, which closes a certifications section. A certificate's name is never one. */
function isSectionHeading(heading: string, line: string): boolean {
  if (/\bcertified\b|\d/i.test(heading)) return false;
  return /:\s*$/.test(line) || SECTION_WORDS.test(heading);
}

/** The resume as a JSON object, or null for free-form text. */
export function parseResumeJson(resumeText: unknown): any | null {
  if (typeof resumeText !== "string") return null;
  const trimmed = resumeText.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const resumeKeys = ["experience", "work_experience", "skills", "summary", "personal_info", "projects", "education"];
    return resumeKeys.some((key) => key in data) ? data : null;
  } catch {
    return null;
  }
}

function entryText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const value = item as Record<string, unknown>;
    return asText(value.name ?? value.skill ?? value.text ?? value.bullet);
  }
  return "";
}

function roleBullets(role: any): string[] {
  const list = [role?.original_bullets, role?.achievements, role?.bullets].find(
    (candidate) => Array.isArray(candidate) && candidate.length > 0
  );
  const bullets = (Array.isArray(list) ? list : []).map(entryText).filter(Boolean);
  if (bullets.length === 0 && typeof role?.description === "string" && role.description.trim()) {
    return [role.description.trim()];
  }
  return bullets;
}

function skillLines(skills: unknown): string[] {
  if (Array.isArray(skills)) {
    const items = skills.map(entryText).filter(Boolean);
    return items.length ? [items.join(", ")] : [];
  }
  if (skills && typeof skills === "object") {
    return Object.entries(skills as Record<string, unknown>)
      .filter(([name]) => !name.startsWith("_"))
      .map(([name, items]) => {
        const list = Array.isArray(items) ? items.map(entryText).filter(Boolean).join(", ") : asText(items);
        return list ? `${name}: ${list}` : "";
      })
      .filter(Boolean);
  }
  return typeof skills === "string" && skills.trim() ? [skills.trim()] : [];
}

function describeEntry(entry: unknown, fields: string[]): string {
  if (typeof entry === "string") return entry.trim();
  if (!entry || typeof entry !== "object") return "";
  const value = entry as Record<string, unknown>;
  return fields.map((field) => asText(value[field])).filter(Boolean).join(" | ");
}

type AddLine = (line: string, segment?: MaterialSegment) => void;

/** One structured resume, section by section, every bullet attributed to its role. */
function renderStructuredResume(data: any, source: EvidenceSource, add: AddLine, indent = ""): void {
  const info = data.personal_info && typeof data.personal_info === "object" ? data.personal_info : {};
  const summary = asText(data.summary) || asText(info.summary);
  if (summary) add(`${indent}SUMMARY: ${summary}`, { text: summary, source });

  const roles = Array.isArray(data.experience) ? data.experience : Array.isArray(data.work_experience) ? data.work_experience : [];
  roles.forEach((role: any, index: number) => {
    if (!role || typeof role !== "object") return;
    const title = asText(role.role ?? role.title);
    const company = asText(role.company);
    const header = [title, company, asText(role.duration)].filter(Boolean).join(" | ");
    const attribution = { ...(title ? { role: title } : {}), ...(company ? { company } : {}) };
    add(`${indent}ROLE ${index + 1}: ${header}`, { text: header, source, ...attribution });
    for (const bullet of roleBullets(role)) add(`${indent}  - ${bullet}`, { text: bullet, source, ...attribution });
  });

  const early = Array.isArray(data.early_career) ? data.early_career.map(entryText).filter(Boolean) : [];
  if (early.length) {
    add(`${indent}EARLY CAREER:`);
    for (const item of early) add(`${indent}  - ${item}`, { text: item, source });
  }
  const skills = skillLines(data.skills);
  if (skills.length) {
    add(`${indent}SKILLS:`);
    for (const line of skills) add(`${indent}  ${line}`, { text: line, source });
  }
  for (const project of Array.isArray(data.projects) ? data.projects : []) {
    const text = describeEntry(project, ["title", "name", "description"]);
    if (text) add(`${indent}PROJECT: ${text}`, { text, source });
  }
  for (const entry of Array.isArray(data.education) ? data.education : []) {
    const text = describeEntry(entry, ["degree", "institution", "expected_completion"]);
    if (text) add(`${indent}EDUCATION: ${text}`, { text, source, verbatim: true });
  }
  for (const entry of Array.isArray(data.certifications) ? data.certifications : []) {
    const text = describeEntry(entry, ["name", "issuer", "date"]);
    if (text) add(`${indent}CERTIFICATION: ${text}`, { text, source, verbatim: true });
  }
}

/**
 * Free text, one segment per line. Only lines in a certifications section - or an
 * inline "Certifications: ..." list - are verbatim history; a bullet that merely
 * says "certified" is not. The section ends at the next heading.
 */
function renderFreeText(raw: string, source: EvidenceSource, add: AddLine, segmentsOnly: (segment: MaterialSegment) => void): void {
  add(raw);
  let inCertifications = false;
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    const heading = headingOf(text);
    if (heading && isCertificationHeading(heading)) {
      inCertifications = true;
      segmentsOnly({ text, source });
      continue;
    }
    if (heading && isSectionHeading(heading, text)) {
      inCertifications = false;
      segmentsOnly({ text, source });
      continue;
    }
    const verbatim = inCertifications || INLINE_CERTIFICATIONS.test(text);
    segmentsOnly({ text, source, ...(verbatim ? { verbatim: true } : {}) });
  }
}

/** The data of one of the candidate's other resumes, whatever form it arrived in. */
function otherResumeData(entry: unknown): { name: string; data: any | null; text: string } {
  const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
  const name = record ? asText(record.name) : "";
  const value = record && "data" in record ? record.data : entry;
  if (typeof value === "string") return { name, data: parseResumeJson(value), text: value };
  if (value && typeof value === "object" && !Array.isArray(value)) return { name, data: value, text: "" };
  return { name, data: null, text: "" };
}

/**
 * The candidate's resume, notes and - when the writer is shown them - other
 * resumes, as the requirement analysis reads them, plus the segments its quotes
 * are verified against. JSON resumes are rendered section by section, so every
 * bullet is attributed to its role.
 */
export function buildCandidateMaterial(
  resumeText: string,
  brainDump?: string,
  options: CandidateMaterialOptions = {}
): CandidateMaterial {
  const lines: string[] = [];
  const segments: MaterialSegment[] = [];
  const add: AddLine = (line, segment) => {
    lines.push(line);
    if (segment && segment.text) segments.push(segment);
  };
  const segmentOnly = (segment: MaterialSegment) => {
    if (segment.text) segments.push(segment);
  };

  const data = parseResumeJson(resumeText);
  if (data) renderStructuredResume(data, "resume", add);
  else renderFreeText(typeof resumeText === "string" ? resumeText : "", "resume", add, segmentOnly);

  const notes = typeof brainDump === "string" ? brainDump.trim() : "";
  if (notes) {
    lines.push("", "CANDIDATE NOTES (brain dump, in the candidate's own words):", notes);
    for (const line of notes.split(/\r?\n/)) {
      const text = line.trim();
      if (text) segments.push({ text, source: "brain_dump" });
    }
  }

  (Array.isArray(options.otherResumes) ? options.otherResumes : []).forEach((entry, index) => {
    const other = otherResumeData(entry);
    if (!other.data && !other.text.trim()) return;
    add("", undefined);
    add(`OTHER RESUME VERSION ${index + 1}${other.name ? ` ("${other.name}")` : ""} - the candidate's own:`);
    if (other.data) renderStructuredResume(other.data, "other_resume", add, "  ");
    else renderFreeText(other.text, "other_resume", add, segmentOnly);
  });

  let text = lines.join("\n");
  let omitted = 0;
  const cap = Math.max(2000, Math.floor(Number(options.limit) || MATERIAL_LIMIT));
  if (text.length > cap) {
    const cut = text.lastIndexOf("\n", cap);
    const head = text.slice(0, cut > cap * 0.6 ? cut : cap);
    omitted = text.length - head.length;
    text = `${head}\n[... ${omitted} more characters of the candidate's material not shown]`;
  }
  return { text, segments, structured: Boolean(data), omitted_chars: omitted };
}

/* ------------------------------------------------------------------ *
 * The analysis prompt
 * ------------------------------------------------------------------ */

export const MAX_REQUIREMENTS = 25;

export function buildRequirementAnalysisPrompt(options: {
  jobDescription: string;
  targetRole?: string;
  material: CandidateMaterial;
  currentDate?: string;
}): string {
  const currentDate =
    options.currentDate ||
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `ACT AS:
A senior technical recruiter and the hiring manager for this posting. Read the posting and the
candidate's own material, and decide - requirement by requirement - what the candidate can
actually prove. Your output is parsed by code, and every quote you give is checked verbatim
against the candidate's material.

TARGET ROLE (the candidate's label): ${options.targetRole || "not given"} | CURRENT DATE: ${currentDate}

1. JOB BRIEF - from the posting only:
   "title", "seniority" (e.g. "Senior", "Lead", "Mid-level"), "required_years" (the minimum
   years of experience the posting states, or null), "summary" (one sentence: what the role
   exists to do), "responsibilities" (the top ones, at most 8), "outcomes" (what success looks
   like, at most 5, only when the posting says), "keywords" (at most 20 ATS terms, copied
   exactly as the posting writes them).

2. REQUIREMENTS - the distinct things a recruiter screens on, most important first, at most
   ${MAX_REQUIREMENTS}. Merge duplicates; ignore company boilerplate, benefits and EEO text.
   - "text": the requirement in the posting's words, under 15 words.
   - "tier": "required", or "preferred" for nice-to-have, desirable, bonus or "a plus".
   - "kind": skill | tool | experience | responsibility | certification | education | years |
     domain | soft_skill | eligibility | other.
   - "hard_gate": true only for a non-negotiable condition checked before anything else - a
     named certification or license, a degree, a minimum number of years, security clearance,
     work authorization, location or onsite presence, a language.

3. EVIDENCE - for each requirement, judged from the CANDIDATE MATERIAL alone:
   - "evidenced": the material directly shows the candidate doing or holding it;
   - "partial": the material shows closely related work but not the requirement itself -
     say in "note" what is missing;
   - "not_evidenced": nothing in the material shows it.
   For "evidenced" and "partial", give 1-3 "quotes": exact, contiguous text copied character
   for character from the CANDIDATE MATERIAL - a bullet or part of one, at least four words
   where possible. Never paraphrase, merge or shorten words inside a quote: a quote that is
   not found verbatim is discarded, and its requirement becomes "not_evidenced".
   The posting, the target role label and general plausibility are never evidence.
   Similar-sounding is not evidence: Docker does not prove Kubernetes, using a tool does not
   prove administering it, and a team's result does not prove the candidate led it.

4. EXCLUSIONS - the candidate has chosen never to claim ${excludedTermsQuoted()}. A
   requirement about one of them is "not_evidenced" with the note "excluded by the
   candidate", whatever the material shows.

OUTPUT - ONE JSON object, nothing else:
{
  "brief": { "title": "string", "seniority": "string", "required_years": null, "summary": "string",
             "responsibilities": ["string"], "outcomes": ["string"], "keywords": ["string"] },
  "requirements": [
    { "text": "string", "tier": "required", "kind": "skill", "hard_gate": false,
      "status": "evidenced", "quotes": ["string"], "note": "string" }
  ]
}

=== JOB POSTING ===
${options.jobDescription}

=== CANDIDATE MATERIAL (the only admissible evidence) ===
${options.material.text}
`;
}

/* ------------------------------------------------------------------ *
 * Verification
 * ------------------------------------------------------------------ */

const QUOTE_STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "for", "on", "with", "by", "at", "or", "as", "is",
  "was", "were", "be", "from", "into", "via", "per", "its", "their", "that", "this",
]);
const MAX_EVIDENCE_TEXT = 300;
/**
 * A drifted copy (a dropped word, changed punctuation) is accepted only when it
 * is long and every number and meaningful word in it occurs in ONE segment: only
 * stopwords and punctuation may differ, never the skill, scope or figure claimed.
 */
const FUZZY_MIN_TOKENS = 6;
const FUZZY_MIN_SIGNIFICANT = 4;
/** Coverage that matches a verified quote to an extracted bullet, which may differ slightly from the source. */
const FUZZY_COVERAGE = 0.85;

interface PreparedSegment {
  segment: MaterialSegment;
  padded: string;
  tokens: Set<string>;
}

interface PreparedMaterial {
  segments: PreparedSegment[];
  /** Whole-source text, so a quote spanning a line break in a pasted resume still verifies. */
  full: Record<EvidenceSource, string>;
}

function prepareMaterial(material: CandidateMaterial): PreparedMaterial {
  const segments = (Array.isArray(material?.segments) ? material.segments : []).map((segment) => {
    const norm = normalizeQuote(segment.text);
    return { segment, padded: ` ${norm} `, tokens: new Set(norm.split(" ").filter(Boolean)) };
  });
  const joined = (source: EvidenceSource) =>
    ` ${normalizeQuote(segments.filter((s) => s.segment.source === source).map((s) => s.segment.text).join(" "))} `;
  return {
    segments,
    full: { resume: joined("resume"), brain_dump: joined("brain_dump"), other_resume: joined("other_resume") },
  };
}

/** Every number, and every word that is not a stopword: what a quote actually claims. */
function significantTokens(norm: string): string[] {
  return norm
    .split(" ")
    .filter((token) => token && (/\d/.test(token) || token.length >= 2) && !QUOTE_STOPWORDS.has(token));
}

function attribution(segment: MaterialSegment): Pick<EvidenceQuote, "role" | "company" | "verbatim"> {
  return {
    ...(segment.role ? { role: segment.role } : {}),
    ...(segment.company ? { company: segment.company } : {}),
    ...(segment.verbatim ? { verbatim: true } : {}),
  };
}

const YEARS = /\b(?:years?|yrs?)\b/;
/** A requirement offering alternatives, any one of which meets it: "Python, PowerShell or Bash". */
const ALTERNATIVES = /\bor\b|\//i;
/** Words a requirement adds around the thing it names: "CISSP certification required". */
const GENERIC_WORDS = new Set([
  "certification", "certifications", "certified", "certificate", "certificates", "cert", "certs", "license",
  "licence", "licenses", "licences", "licensed", "degree", "required", "requirement", "mandatory", "preferred",
  "must", "valid", "current", "active", "equivalent", "qualification", "credential", "credentials", "holder",
]);

function numberValue(token: string): number {
  const match = /\d+(?:\.\d+)?/.exec(token);
  return match ? Number(match[0]) : NaN;
}

/** The words that identify what a requirement names: its significant words without the generic ones. */
function distinguishingWords(requirementText: string): string[] {
  return significantTokens(normalizeQuote(requirementText)).filter((token) => !GENERIC_WORDS.has(token));
}

type ShortQuoteVerdict = "accept" | "certification_entry_only" | "reject";

/**
 * A one- or two-word quote proves something only when it names the requirement
 * itself: two of its distinguishing words, all of a short requirement, or one
 * whole option of an either/or requirement. A credential may also be named by
 * its acronym ("CKA" for "Certified Kubernetes Administrator (CKA)"), but only
 * from a certification or education entry. A quote may never add a number the
 * requirement does not state ("AZ-104" is no proof of "AZ-500"), and a
 * requirement naming a code must be named by it - except years, where any
 * number at or above the stated minimum proves it ("16+ years" for "5+ years").
 */
function shortQuoteVerdict(significant: string[], requirementText: string, credential: boolean): ShortQuoteVerdict {
  const requirementNorm = normalizeQuote(requirementText);
  const named = new Set(significantTokens(requirementNorm));
  const required = distinguishingWords(requirementText);
  const quoteNumbers = significant.filter((token) => /\d/.test(token));
  const requiredNumbers = required.filter((token) => /\d/.test(token));
  if (quoteNumbers.length > 0 && YEARS.test(requirementNorm) && significant.some((token) => YEARS.test(token))) {
    const minimum = Math.min(...requiredNumbers.map(numberValue).filter(Number.isFinite));
    const stated = Math.max(...quoteNumbers.map(numberValue).filter(Number.isFinite));
    return Number.isFinite(minimum) && Number.isFinite(stated) && stated >= minimum ? "accept" : "reject";
  }
  if (!quoteNumbers.every((token) => named.has(token))) return "reject";
  if (requiredNumbers.length > 0 && !quoteNumbers.some((token) => named.has(token))) return "reject";
  const distinct = significant.filter((token) => !GENERIC_WORDS.has(token));
  if (distinct.length === 0) return "reject";
  const allNamed = distinct.every((token) => named.has(token));
  if (distinct.filter((token) => named.has(token)).length >= 2) return "accept";
  if (required.length > 0 && required.length <= 2 && required.every((token) => significant.includes(token))) return "accept";
  if (ALTERNATIVES.test(requirementText) && allNamed) return "accept";
  return credential && allNamed ? "certification_entry_only" : "reject";
}

/**
 * The verified form of a quote, or null when the material does not contain it.
 * For a credential requirement, a certification segment that contains the quote
 * wins over a summary or skills line repeating the same name.
 */
function verifyQuote(
  quote: string,
  requirementText: string,
  material: PreparedMaterial,
  preferVerbatim = false
): EvidenceQuote | null {
  const norm = normalizeQuote(quote);
  const tokens = norm ? norm.split(" ") : [];
  const significant = significantTokens(norm);
  if (significant.length === 0) return null;
  const verdict = tokens.length < 3 ? shortQuoteVerdict(significant, requirementText, preferVerbatim) : "accept";
  if (verdict === "reject") return null;
  const pick = (candidates: PreparedSegment[]) =>
    (preferVerbatim ? candidates.find((candidate) => candidate.segment.verbatim) : undefined) || candidates[0];

  const needle = ` ${norm} `;
  const exact = pick(material.segments.filter((s) => s.padded.includes(needle)));
  if (verdict === "certification_entry_only") {
    return exact?.segment.verbatim
      ? { text: clipText(quote, MAX_EVIDENCE_TEXT), source: exact.segment.source, ...attribution(exact.segment) }
      : null;
  }
  if (exact) return { text: clipText(quote, MAX_EVIDENCE_TEXT), source: exact.segment.source, ...attribution(exact.segment) };
  for (const source of SOURCES) {
    if (material.full[source].includes(needle)) return { text: clipText(quote, MAX_EVIDENCE_TEXT), source };
  }

  // Keep the segment's real text rather than the model's drifted copy.
  if (tokens.length >= FUZZY_MIN_TOKENS && significant.length >= FUZZY_MIN_SIGNIFICANT) {
    const match = pick(material.segments.filter((candidate) => significant.every((token) => candidate.tokens.has(token))));
    if (match) {
      return { text: clipText(match.segment.text, MAX_EVIDENCE_TEXT), source: match.segment.source, ...attribution(match.segment) };
    }
  }
  return null;
}

function normalizeStatus(value: unknown): EvidenceStatus {
  const key = asText(value).toLowerCase().replace(/[^a-z]+/g, "_");
  if (["evidenced", "proven", "met", "yes", "strong", "fully_evidenced"].includes(key)) return "evidenced";
  if (key.startsWith("partial")) return "partial";
  if (key === "excluded") return "excluded";
  return "not_evidenced";
}

function normalizeTier(value: unknown): RequirementTier {
  const key = asText(value).toLowerCase();
  return /prefer|nice|optional|bonus|desir|plus|advantage/.test(key) ? "preferred" : "required";
}

function normalizeKind(value: unknown): RequirementKind {
  const key = asText(value).toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "");
  if ((KINDS as readonly string[]).includes(key)) return key as RequirementKind;
  if (/certif|licen/.test(key)) return "certification";
  if (/degree|educat/.test(key)) return "education";
  if (/year/.test(key)) return "years";
  if (/soft/.test(key)) return "soft_skill";
  if (/tool|technolog|platform/.test(key)) return "tool";
  return "other";
}

/** A requirement for a credential: its evidence is a name the candidate holds, kept verbatim. */
const CREDENTIAL_REQUIREMENT = /certif|degree|diploma|licen[cs]e/i;

function isCredentialRequirement(kind: RequirementKind, text: string): boolean {
  return kind === "certification" || kind === "education" || CREDENTIAL_REQUIREMENT.test(text);
}

/**
 * The candidate's exclusions hold whatever the model or a saved result says: a
 * requirement naming one is "excluded", unless verified evidence covers it
 * without claiming the excluded capability - another option it names
 * ("Terraform or Bicep"), or a credential the candidate holds under that name
 * ("DevOps Engineer Expert (AZ-400)"), which is history, not a skill claim. A
 * held credential must come from a certification or education entry and name
 * the requirement: any code it states, or else most of its distinguishing words.
 */
function applyExclusion(requirement: Omit<JobRequirement, "id">): void {
  const excluded = findExcludedTerms(requirement.text);
  if (excluded.length === 0) return;
  const backed = requirement.status === "evidenced" || requirement.status === "partial";
  const words = distinguishingWords(requirement.text);
  const codes = words.filter((token) => /\d/.test(token));
  const namesRequirement = (quote: EvidenceQuote) => {
    const text = ` ${normalizeQuote(quote.text)} `;
    if (codes.length > 0) return codes.some((code) => text.includes(` ${code} `));
    return words.filter((word) => text.includes(` ${word} `)).length >= Math.ceil((words.length * 2) / 3);
  };
  const held = isCredentialRequirement(requirement.kind, requirement.text)
    ? requirement.evidence.filter((quote) => quote.verbatim && namesRequirement(quote))
    : [];
  if (backed && held.length > 0) {
    requirement.evidence = held;
    requirement.note = `Held under this name, which stays verbatim; you still don't claim ${excluded.join(", ")} as a skill.`;
    return;
  }
  const clean = requirement.evidence.filter((quote) => findExcludedTerms(quote.text).length === 0);
  if (backed && clean.length > 0) {
    requirement.status = "partial";
    requirement.evidence = clean;
    requirement.note = `You don't claim ${excluded.join(", ")}; the evidence covers the rest of this requirement.`;
  } else {
    requirement.status = "excluded";
    requirement.evidence = [];
    requirement.note = `You chose not to claim ${excluded.join(", ")}.`;
  }
}

function parseBrief(raw: unknown, jobDescription?: string): JobBrief {
  const brief = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const yearsValue = brief.required_years;
  // The first number only: a range such as "3-5" is a minimum of 3, never 35.
  const yearsMatch = /\d+(?:\.\d+)?/.exec(typeof yearsValue === "number" ? String(yearsValue) : asText(yearsValue));
  const years = yearsMatch ? Number(yearsMatch[0]) : NaN;
  const posting = typeof jobDescription === "string" && jobDescription.trim() ? ` ${normalizeQuote(jobDescription)} ` : null;
  return {
    title: clipText(asText(brief.title), 120),
    seniority: clipText(asText(brief.seniority), 40),
    required_years: Number.isFinite(years) && years > 0 && years <= 40 ? Math.round(years * 10) / 10 : null,
    summary: clipText(asText(brief.summary), 300),
    responsibilities: stringList(brief.responsibilities, 8, 200),
    outcomes: stringList(brief.outcomes, 5, 200),
    keywords: stringList(brief.keywords, 20, 60).filter(
      (keyword) => !posting || posting.includes(` ${normalizeQuote(keyword)} `)
    ),
  };
}

/** Required first, in the model's order of importance, then nice-to-haves; ids follow that order. */
function finalizeRequirements(list: Omit<JobRequirement, "id">[]): JobRequirement[] {
  return [...list.filter((r) => r.tier === "required"), ...list.filter((r) => r.tier === "preferred")]
    .slice(0, MAX_REQUIREMENTS)
    .map((requirement, index) => ({ id: `R${index + 1}`, ...requirement }));
}

/**
 * Parses the model's analysis and verifies every quote against the candidate's
 * material. Null when the reply holds no usable requirement.
 */
export function parseRequirementAnalysis(
  raw: unknown,
  material: CandidateMaterial,
  options: { jobDescription?: string } = {}
): RequirementAnalysis | null {
  const data = parseModelJson(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const prepared = prepareMaterial(material);
  let proposed = 0;
  let verified = 0;
  const seen = new Set<string>();
  const parsed: Omit<JobRequirement, "id">[] = [];

  for (const item of Array.isArray(data.requirements) ? data.requirements : []) {
    if (!item || typeof item !== "object") continue;
    const text = clipText(asText(item.text ?? item.requirement), 160);
    const key = normalizeQuote(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const tier = normalizeTier(item.tier);
    const claimed = normalizeStatus(item.status);
    const offersEvidence = claimed === "evidenced" || claimed === "partial";
    const kind = normalizeKind(item.kind);
    const credential = isCredentialRequirement(kind, text);
    const rawQuotes = Array.isArray(item.quotes) ? item.quotes : Array.isArray(item.evidence) ? item.evidence : [];
    const evidence: EvidenceQuote[] = [];
    if (offersEvidence) {
      for (const quote of rawQuotes.slice(0, 3)) {
        const quoteText = typeof quote === "string" ? quote : asText(quote?.quote ?? quote?.text);
        if (!quoteText) continue;
        proposed += 1;
        const found = verifyQuote(quoteText, text, prepared, credential);
        if (found && !evidence.some((e) => normalizeQuote(e.text) === normalizeQuote(found.text))) {
          evidence.push(found);
          verified += 1;
        }
      }
    }

    const note = clipText(asText(item.note), 200);
    const requirement: Omit<JobRequirement, "id"> = {
      text,
      tier,
      kind,
      hard_gate: tier === "required" && (item.hard_gate === true || asText(item.hard_gate).toLowerCase() === "true"),
      status: offersEvidence && evidence.length > 0 ? claimed : "not_evidenced",
      evidence,
      ...(note ? { note } : {}),
    };
    applyExclusion(requirement);
    if (offersEvidence && requirement.status !== claimed && requirement.status !== "excluded") {
      requirement.claimed_status = claimed;
    }
    parsed.push(requirement);
  }

  if (parsed.length === 0) return null;
  const requirements = finalizeRequirements(parsed);
  return {
    method: "verified-evidence-v1",
    brief: parseBrief(data.brief, options.jobDescription),
    requirements,
    verification: {
      quotes_proposed: proposed,
      quotes_verified: verified,
      downgraded: requirements.filter((r) => r.claimed_status && r.status === "not_evidenced").map((r) => r.id),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Re-validation of an analysis carried in a result (server JSON, saved results)
 * ------------------------------------------------------------------ */

function coerceQuote(value: unknown): EvidenceQuote | null {
  if (!value || typeof value !== "object") return null;
  const quote = value as Record<string, unknown>;
  const text = clipText(asText(quote.text), MAX_EVIDENCE_TEXT);
  if (!text) return null;
  const role = asText(quote.role);
  const company = asText(quote.company);
  return {
    text,
    source: (SOURCES as readonly unknown[]).includes(quote.source) ? (quote.source as EvidenceSource) : "resume",
    ...(role ? { role } : {}),
    ...(company ? { company } : {}),
    ...(quote.verbatim === true ? { verbatim: true } : {}),
  };
}

/**
 * An analysis rebuilt from untrusted JSON. Statuses were verified when it was
 * made, so they are kept - but an evidence-backed status without evidence, and
 * a claimed excluded capability, are corrected. Null when nothing usable is left.
 */
export function coerceRequirementAnalysis(value: unknown): RequirementAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, any>;
  if (!Array.isArray(source.requirements)) return null;
  const list: Omit<JobRequirement, "id">[] = [];
  for (const item of source.requirements) {
    if (!item || typeof item !== "object") continue;
    const text = clipText(asText(item.text), 160);
    if (!text) continue;
    const tier = normalizeTier(item.tier);
    const evidence = (Array.isArray(item.evidence) ? item.evidence : [])
      .map(coerceQuote)
      .filter((quote: EvidenceQuote | null): quote is EvidenceQuote => quote !== null)
      .slice(0, 3);
    let status: EvidenceStatus = (STATUSES as readonly string[]).includes(item.status) ? item.status : "not_evidenced";
    if ((status === "evidenced" || status === "partial") && evidence.length === 0) status = "not_evidenced";
    const note = clipText(asText(item.note), 200);
    const claimed = (STATUSES as readonly string[]).includes(item.claimed_status) ? (item.claimed_status as EvidenceStatus) : null;
    const requirement: Omit<JobRequirement, "id"> = {
      text,
      tier,
      kind: normalizeKind(item.kind),
      hard_gate: tier === "required" && item.hard_gate === true,
      status,
      evidence: status === "evidenced" || status === "partial" ? evidence : [],
      ...(note ? { note } : {}),
      ...(claimed && claimed !== status ? { claimed_status: claimed } : {}),
    };
    applyExclusion(requirement);
    list.push(requirement);
  }
  if (list.length === 0) return null;
  const verification = source.verification && typeof source.verification === "object" ? source.verification : {};
  const requirements = finalizeRequirements(list);
  return {
    method: "verified-evidence-v1",
    brief: parseBrief(source.brief),
    requirements,
    verification: {
      quotes_proposed: Math.max(0, Number(verification.quotes_proposed) || 0),
      quotes_verified: Math.max(0, Number(verification.quotes_verified) || 0),
      downgraded: requirements.filter((r) => r.claimed_status && r.status === "not_evidenced").map((r) => r.id),
    },
  };
}

/** Posting vocabulary for scoring and prompts: the brief's keywords, then short requirement names. */
export function analysisKeywords(analysis: RequirementAnalysis | null | undefined): string[] {
  if (!analysis) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const key = normalizeQuote(value);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  };
  analysis.brief.keywords.forEach(add);
  for (const requirement of analysis.requirements) {
    if (requirement.text.split(/\s+/).length <= 4) add(requirement.text);
  }
  return out.slice(0, 30);
}

/* ------------------------------------------------------------------ *
 * Prompt sections
 * ------------------------------------------------------------------ */

const MAX_PROMPT_QUOTE = 220;
const MAX_NEVER_CLAIM = 12;

function requirementTag(requirement: JobRequirement): string {
  return [requirement.id, requirement.tier, requirement.hard_gate ? "eligibility gate" : ""].filter(Boolean).join(", ");
}

function quoteLine(quote: EvidenceQuote): string {
  const role = [quote.role, quote.company].filter(Boolean).join(" @ ");
  const where =
    quote.source === "brain_dump"
      ? "candidate notes"
      : quote.source === "other_resume"
        ? `candidate's other resume${role ? `, ${role}` : ""}`
        : role;
  return `"${clipText(quote.text, MAX_PROMPT_QUOTE)}"${where ? ` (${where})` : ""}`;
}

function hasRequirements(analysis: RequirementAnalysis | null | undefined): analysis is RequirementAnalysis {
  return Boolean(analysis && Array.isArray(analysis.requirements) && analysis.requirements.length > 0);
}

/**
 * The job brief and the verified evidence map, for prompts that write or review
 * the whole document. Empty when there is no analysis, which leaves those
 * prompts exactly as they were.
 */
export function formatDocumentEvidenceBrief(analysis: RequirementAnalysis | null | undefined): string {
  if (!hasRequirements(analysis)) return "";
  const { brief } = analysis;
  const lines: string[] = ["=== JOB BRIEF (structured from the full posting) ==="];
  const head = [
    brief.title ? `Title: ${brief.title}` : "",
    brief.seniority ? `Seniority: ${brief.seniority}` : "",
    brief.required_years !== null ? `Minimum experience: ${brief.required_years} years` : "",
  ].filter(Boolean);
  if (head.length) lines.push(head.join(" | "));
  if (brief.summary) lines.push(`Purpose: ${brief.summary}`);
  if (brief.responsibilities.length) lines.push("Top responsibilities:", ...brief.responsibilities.map((r) => `  - ${r}`));
  if (brief.outcomes.length) lines.push("What success looks like:", ...brief.outcomes.map((o) => `  - ${o}`));

  lines.push(
    "",
    "=== REQUIREMENT EVIDENCE MAP (every quote verified against the candidate's own material) ===",
    "Authoritative for tailoring: build the document around it."
  );
  const group = (status: EvidenceStatus) => analysis.requirements.filter((r) => r.status === status);
  const withEvidence = (requirement: JobRequirement, suffix = "") => {
    lines.push(`  [${requirementTag(requirement)}] ${requirement.text}${suffix}`);
    for (const quote of requirement.evidence.slice(0, 2)) lines.push(`      evidence: ${quoteLine(quote)}`);
  };
  const proven = group("evidenced");
  if (proven.length) {
    lines.push("PROVEN - feature these prominently, most important first, using the evidence shown:");
    proven.forEach((r) => withEvidence(r));
  }
  const partial = group("partial");
  if (partial.length) {
    lines.push("PARTIAL - claim only what the evidence shows, never the full requirement:");
    partial.forEach((r) => withEvidence(r, r.note ? ` - ${r.note}` : ""));
  }
  const missing = group("not_evidenced");
  if (missing.length) {
    lines.push("NOT EVIDENCED - never claim, imply, or list these as the candidate's; they belong in keyword_gap:");
    for (const r of missing) lines.push(`  [${requirementTag(r)}] ${r.text}`);
  }
  const excluded = group("excluded");
  if (excluded.length) {
    lines.push("EXCLUDED BY THE CANDIDATE - never write or imply these (see CANDIDATE EXCLUSIONS):");
    for (const r of excluded) lines.push(`  [${requirementTag(r)}] ${r.text}`);
  }
  return lines.join("\n");
}

function quoteMatchesBullet(quote: string, bullet: string): boolean {
  if (!quote || !bullet) return false;
  if (` ${bullet} `.includes(` ${quote} `) || ` ${quote} `.includes(` ${bullet} `)) return true;
  const tokens = quote.split(" ");
  if (tokens.length < FUZZY_MIN_TOKENS) return false;
  const words = new Set(bullet.split(" "));
  return tokens.filter((token) => words.has(token)).length / tokens.length >= FUZZY_COVERAGE;
}

/** Proven or partial requirements whose verified evidence is one of these source bullets (0-based). */
export function roleRequirementMatches(
  analysis: RequirementAnalysis | null | undefined,
  roleBullets: string[]
): { requirement: JobRequirement; bullets: number[] }[] {
  if (!hasRequirements(analysis)) return [];
  const bullets = (Array.isArray(roleBullets) ? roleBullets : []).map((b) => normalizeQuote(String(b || "")));
  const out: { requirement: JobRequirement; bullets: number[] }[] = [];
  for (const requirement of analysis.requirements) {
    if (requirement.status !== "evidenced" && requirement.status !== "partial") continue;
    const hits = new Set<number>();
    for (const quote of requirement.evidence) {
      if (quote.source !== "resume") continue;
      const normalized = normalizeQuote(quote.text);
      bullets.forEach((bullet, index) => {
        if (quoteMatchesBullet(normalized, bullet)) hits.add(index);
      });
    }
    if (hits.size > 0) out.push({ requirement, bullets: Array.from(hits).sort((a, b) => a - b) });
  }
  return out;
}

/**
 * The part of the evidence map one role needs: the posting requirements its own
 * source bullets prove, and what must never be claimed. Empty without an analysis.
 */
export function formatRoleEvidenceBrief(analysis: RequirementAnalysis | null | undefined, roleBullets: string[]): string {
  if (!hasRequirements(analysis)) return "";
  const lines = ["=== POSTING REQUIREMENTS THIS ROLE PROVES (verified against its source bullets) ==="];
  const matches = roleRequirementMatches(analysis, roleBullets);
  if (matches.length > 0) {
    lines.push("Lead with the bullets that prove these, most important first:");
    for (const { requirement, bullets } of matches) {
      const where = ` - source bullet${bullets.length === 1 ? "" : "s"} ${bullets.map((i) => i + 1).join(", ")}`;
      const partial = requirement.status === "partial" ? ` (partial${requirement.note ? `: ${requirement.note}` : ""})` : "";
      lines.push(`  - [${requirementTag(requirement)}] ${requirement.text}${where}${partial}`);
    }
  } else {
    lines.push(
      "None of the posting's requirements is evidenced by this role's source bullets: describe the role's",
      "own work accurately and never stretch it toward the posting."
    );
  }
  const never = analysis.requirements
    .filter((r) => r.status === "not_evidenced" || r.status === "excluded")
    .slice(0, MAX_NEVER_CLAIM);
  if (never.length > 0) {
    lines.push(
      "Never claim in this role (not evidenced by the candidate's material, or excluded by the candidate):",
      `  ${never.map((r) => clipText(r.text, 80)).join("; ")}`
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * The report shown with the results
 * ------------------------------------------------------------------ */

function tierSummary(requirements: JobRequirement[], tier: RequirementTier): EvidenceTierSummary {
  const list = requirements.filter((r) => r.tier === tier);
  const count = (status: EvidenceStatus) => list.filter((r) => r.status === status).length;
  return {
    total: list.length,
    evidenced: count("evidenced"),
    partial: count("partial"),
    not_evidenced: count("not_evidenced"),
    excluded: count("excluded"),
  };
}

export function buildEvidenceReport(analysis: RequirementAnalysis): RequirementEvidenceReport {
  let earned = 0;
  let total = 0;
  for (const requirement of analysis.requirements) {
    const weight = requirement.tier === "required" ? 1 : 0.5;
    total += weight;
    earned += weight * (requirement.status === "evidenced" ? 1 : requirement.status === "partial" ? 0.5 : 0);
  }
  return {
    method: analysis.method,
    brief: analysis.brief,
    requirements: analysis.requirements,
    verification: analysis.verification,
    qualification_evidence: total > 0 ? Math.round((earned / total) * 100) : null,
    required: tierSummary(analysis.requirements, "required"),
    preferred: tierSummary(analysis.requirements, "preferred"),
    hard_gaps: analysis.requirements
      .filter((r) => r.tier === "required" && r.hard_gate && r.status !== "evidenced")
      .map((r) => (r.status === "partial" ? `${r.text} (partial)` : r.text)),
  };
}

/**
 * Attaches the evidence report to a generated resume. Pass the analysis made for
 * this run, null when none was made, or omit it to rebuild the report the result
 * already carries (the client re-finalizing a server result). Mutates and returns
 * the resume; never throws.
 */
export function applyRequirementEvidence(resume: any, analysis?: RequirementAnalysis | RequirementEvidenceReport | null): any {
  if (!resume || typeof resume !== "object") return resume;
  try {
    const normalized = coerceRequirementAnalysis(analysis === undefined ? resume.requirement_evidence : analysis);
    if (normalized) resume.requirement_evidence = buildEvidenceReport(normalized);
    else delete resume.requirement_evidence;
  } catch (e: any) {
    console.warn("[requirementEvidence] Could not attach the evidence report:", e?.message || e);
    delete resume.requirement_evidence;
  }
  return resume;
}
