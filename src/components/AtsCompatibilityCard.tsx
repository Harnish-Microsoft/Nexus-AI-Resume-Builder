import React, { useMemo } from "react";
import { applicationFields, ATS_FONTS, structuredResumeWarnings } from "../lib/atsDocument";
import type { AtsFont } from "../lib/atsDocument";
import { computeKeywordCoverageTarget } from "../lib/matchScore";
import { buildCandidateMaterial } from "../lib/requirementEvidence";
import type { OptimizationResult } from "../services/geminiService";
import type { ValidationContext } from "../lib/resumeValidation";

interface Props {
  resume: OptimizationResult;
  context: ValidationContext;
  safe: boolean;
  font: AtsFont;
  masked: boolean;
  onSafe: (value: boolean) => void;
  onFont: (font: AtsFont) => void;
  onCopy: (text: string) => void;
}

export function AtsCompatibilityCard({ resume, context, safe, font, masked, onSafe, onFont, onCopy }: Props) {
  const material = useMemo(() => buildCandidateMaterial(context.resumeText, context.brainDump, { otherResumes: context.otherResumes }), [context]);
  const goal = useMemo(() => computeKeywordCoverageTarget(resume, context.jobDescription, material.text, context.targetRole), [resume, context, material]);
  const warnings = structuredResumeWarnings(resume);
  return <section className="p-4 rounded-xl border space-y-3 text-xs">
    <h3 className="font-bold">Greenhouse + Workday compatibility</h3>
    <label className="flex gap-2 items-center">
      <input type="checkbox" checked={safe} onChange={event => onSafe(event.target.checked)} />
      ATS-safe layout (recommended)
    </label>
    <label className="block">Resume font
      <select className="ml-2 bg-transparent border rounded p-1" value={font} onChange={event => onFont(event.target.value as AtsFont)}>
        {ATS_FONTS.map(value => <option key={value} className="text-black" value={value}>{value}</option>)}
      </select>
    </label>
    <p>{safe ? "Single-column text, 11 pt body, 1.25 line spacing, normal letter spacing and 16 mm margins. No shrinking to force two pages." : "Custom layout: extraction, completeness and font/spacing warnings are checked at export."} These are readability defaults, not mandated ATS standards.</p>
    {goal ? <div>
      <strong>Evidence-limited keyword coverage: {goal.actual}% / {goal.target}% target</strong>
      <p>Source-supported ceiling: {goal.evidence_ceiling}%. Weighted posting vocabulary, not hiring probability or an ATS pass.</p>
      <p>{goal.status === "met" ? "Target met with source-supported wording." : goal.status === "evidence_limited"
        ? "Your supplied evidence cannot support 80%. Add real experience through the gap form; unsupported keywords will not be invented."
        : "Supported vocabulary is still missing. Run Optimize to surface that evidence; the target is not guaranteed."}</p>
      {!!goal.supported_missing.length && <details><summary>Supported vocabulary still missing</summary><p>{goal.supported_missing.join(", ")}</p></details>}
      {!!goal.unsupported.length && <details><summary>Not fully supported or excluded vocabulary</summary><p>{goal.unsupported.join(", ")}</p></details>}
    </div> : <p>Keyword target not scored: the posting has insufficient signal.</p>}
    <p>Greenhouse: warn above its documented 2.5 MB parsing limit. Workday: follow the particular employer portal's accepted formats and size limits.</p>
    <details><summary className="cursor-pointer font-bold">Application fields and source checks</summary>
      {warnings.map((warning, index) => <p className="mt-1" key={index}>{warning}</p>)}
      <p className="mt-2">Review each autofilled employer, title, date, current-role flag, institution and degree. Never infer authorization or sponsorship answers.</p>
      {masked ? <p className="mt-2">Application field summary hidden while PII masking is enabled.</p> : <>
        <pre className="mt-2 whitespace-pre-wrap max-h-64 overflow-y-auto">{applicationFields(resume)}</pre>
        <button className="mt-2 border rounded px-2 py-1" onClick={() => onCopy(applicationFields(resume))}>Copy application field summary</button>
      </>}
    </details>
    <p className="opacity-60">Compatibility checks only; not ATS certification. No resume is uploaded to an employer by this card.</p>
  </section>;
}
