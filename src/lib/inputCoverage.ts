/**
 * What each step of an optimization actually read. Nothing is cut silently:
 * whenever part of the resume or the posting did not fit a step, the result
 * says so in plain words.
 *
 * Dependency-free: bundled by both esbuild (server) and vite (browser).
 */

import type { FocusedPosting } from "./matchScore";

/** structured = parsed from JSON in code; extracted = read by a model; full_text = given whole to the writer. */
export type ResumeReadMethod = "structured" | "extracted" | "full_text";

export interface InputCoverageReport {
  resume: {
    chars: number;
    method: ResumeReadMethod;
    /** Characters the extraction step did not read. */
    omitted_chars: number;
  };
  job_description: {
    chars: number;
    /** What the requirement analysis read; null when no analysis ran. */
    analysis_chars: number | null;
    generation_chars: number;
    boilerplate_removed: boolean;
    /** Characters no step read. */
    omitted_chars: number;
  };
  /** Plain-language disclosures; empty when everything was read in full. */
  notes: string[];
}

function count(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function buildInputCoverage(params: {
  resumeChars: number;
  resumeMethod: ResumeReadMethod;
  /** Resume characters the extraction step left out. */
  resumeOmittedChars?: number;
  /** Resume and notes characters the requirement analysis was not shown. */
  materialOmittedChars?: number;
  /** The posting as the requirement analysis read it; null when no analysis ran. */
  analysisPosting?: FocusedPosting | null;
  generationPosting: FocusedPosting;
}): InputCoverageReport {
  const notes: string[] = [];
  const resumeOmitted = count(params.resumeOmittedChars);
  const materialOmitted = count(params.materialOmittedChars);
  const analysis = params.analysisPosting ?? null;
  const generation = params.generationPosting;

  if (resumeOmitted > 0) {
    notes.push(
      `The last ${resumeOmitted} characters of your resume did not fit the extraction step and were not used. ` +
        "Shorten it, or optimize a structured master resume, which is read in full."
    );
  }
  if (materialOmitted > 0) {
    notes.push(
      `The last ${materialOmitted} characters of your resume and notes did not fit the requirement analysis ` +
        "and were not checked for evidence."
    );
  }
  if (analysis?.truncated) {
    notes.push(
      `The last ${analysis.omitted_chars} characters of the job description did not fit the requirement ` +
        "analysis and were not read. Paste only the role's description and requirements."
    );
  }
  if (generation.truncated) {
    notes.push(
      analysis && !analysis.truncated
        ? `The job description was shortened for the writing step (${generation.omitted_chars} characters ` +
            "left out); its requirements were still analysed in full."
        : `The last ${generation.omitted_chars} characters of the job description were left out of the writing step.`
    );
  }
  const boilerplate = Boolean(analysis?.boilerplate_removed || generation.boilerplate_removed);
  if (boilerplate) notes.push("Company, benefits and EEO sections of the posting were set aside to make room for the role itself.");

  return {
    resume: { chars: count(params.resumeChars), method: params.resumeMethod, omitted_chars: resumeOmitted },
    job_description: {
      chars: count(generation.original_chars),
      analysis_chars: analysis ? analysis.text.length : null,
      generation_chars: generation.text.length,
      boilerplate_removed: boilerplate,
      omitted_chars: analysis ? count(analysis.omitted_chars) : count(generation.omitted_chars),
    },
    notes,
  };
}

/** The posting given whole: what a step reads when nothing had to be cut. */
export function wholePosting(jobDescription: string): FocusedPosting {
  const text = typeof jobDescription === "string" ? jobDescription : "";
  return { text, original_chars: text.length, boilerplate_removed: false, truncated: false, omitted_chars: 0 };
}
