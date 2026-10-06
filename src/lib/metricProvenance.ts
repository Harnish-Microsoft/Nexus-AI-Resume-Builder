import { extractFigures } from "./impactScore";
import type { Figure } from "./impactScore";
import { normalizeQuote } from "./requirementEvidence";
import type { CandidateMaterial, MaterialSegment } from "./requirementEvidence";
import type { ResumeSegment } from "./resumeSegments";

export interface MetricProvenance {
  location: string;
  figure: string;
  text: string;
  status: "supported" | "needs_review";
  source?: MaterialSegment;
  reason?: string;
}

const STOP = new Set("a an the and or for to of in on with by from at as using through led managed delivered improved reduced increased developed designed implemented achieved cut built".split(" "));

function words(text: string): string[] {
  return normalizeQuote(text).split(" ").filter(word => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word));
}

function terms(text: string): Set<string> {
  return new Set(words(text));
}

function unit(text: string, figure: Figure): string {
  const suffix = text.slice(figure.start + figure.raw.length).match(/^\s*(%|percent\b|pct\b|[a-zA-Z]+)/)?.[1]?.toLowerCase() || "";
  if (/%$/.test(figure.raw) || /^(percent|pct|%)$/.test(suffix)) return "%";
  const currency = figure.raw.match(/^[$£€₹]/)?.[0];
  if (currency) return currency;
  const attached = figure.raw.match(/[a-z]+$/i)?.[0]?.toLowerCase();
  return attached || suffix;
}

function measurement(text: string, figure: Figure): string {
  return words(text.slice(0, figure.start)).at(-1) || "";
}

/** Conservative provenance: matching numbers alone never establish a claim. */
export function inspectMetricProvenance(
  segment: ResumeSegment,
  material: CandidateMaterial,
  employer?: string,
  role?: string,
  projectTitle?: string
): MetricProvenance[] {
  if (!["bullet", "project", "summary"].includes(segment.kind)) return [];
  const targetTerms = terms(segment.text);
  return extractFigures(segment.text).map(figure => {
    const source = material.segments.find(candidate => {
      if (candidate.verbatim) return false;
      if (segment.kind === "bullet" && !employer) return false;
      if (employer && (
        candidate.company
          ? normalizeQuote(candidate.company) !== normalizeQuote(employer)
          : !normalizeQuote(candidate.text).includes(normalizeQuote(employer))
      )) return false;
      if (role && candidate.role && normalizeQuote(role) !== normalizeQuote(candidate.role)) return false;
      if (projectTitle && !normalizeQuote(candidate.text).includes(normalizeQuote(projectTitle))) return false;
      const exact = normalizeQuote(candidate.text).includes(normalizeQuote(segment.text));
      const overlap = [...terms(candidate.text)].filter(word => targetTerms.has(word)).length;
      if (!exact && overlap < 2) return false;
      return extractFigures(candidate.text).some(original =>
        original.value === figure.value &&
        original.scaled === figure.scaled &&
        unit(candidate.text, original) === unit(segment.text, figure) &&
        (exact || measurement(candidate.text, original) === measurement(segment.text, figure))
      );
    });
    return {
      location: segment.id,
      figure: figure.raw,
      text: segment.text,
      status: source ? "supported" : "needs_review",
      ...(source ? { source } : {
        reason: "No source statement verifies this figure with the same employer, measurement context and units. Confirm it or remove it.",
      }),
    };
  });
}
