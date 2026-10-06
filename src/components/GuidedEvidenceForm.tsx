import React, { useState } from "react";
import type { RequirementEvidenceReport } from "../lib/requirementEvidence";
import { evidenceNote, evidenceQuestions } from "../lib/evidenceCollection";

interface Props {
  report?: RequirementEvidenceReport;
  onSave: (note: string) => void;
}

export function GuidedEvidenceForm({ report, onSave }: Props) {
  const [selected, setSelected] = useState("");
  const [employer, setEmployer] = useState("");
  const [role, setRole] = useState("");
  const [evidence, setEvidence] = useState("");
  const [saved, setSaved] = useState(false);
  const questions = evidenceQuestions(report);
  if (!questions.length) return null;
  const requirement = questions.find(item => item.id === selected) || questions[0];
  return (
    <details className="mt-3 pt-3 border-t border-white/10">
      <summary className="cursor-pointer text-xs font-bold">Add real evidence for a gap</summary>
      <form className="mt-2 space-y-2 text-xs" onSubmit={event => {
        event.preventDefault();
        onSave(evidenceNote(employer, role, evidence));
        setEvidence("");
        setSaved(true);
      }}>
        <p>Only add work you actually did. These notes feed the next optimization; they do not change the current resume or its score.</p>
        <label className="block">Requirement
          <select className="block w-full p-2 rounded bg-transparent border" value={requirement.id} onChange={event => { setSelected(event.target.value); setSaved(false); }}>
            {questions.map(item => <option className="text-black" key={item.id} value={item.id}>{item.text}</option>)}
          </select>
        </label>
        <label className="block">Employer, institution or project
          <input required className="block w-full p-2 rounded bg-transparent border" value={employer} onChange={event => { setEmployer(event.target.value); setSaved(false); }} />
        </label>
        <label className="block">Your role
          <input required className="block w-full p-2 rounded bg-transparent border" value={role} onChange={event => { setRole(event.target.value); setSaved(false); }} />
        </label>
        <label className="block">What did you personally do, using which tools, and what changed?
          <textarea required minLength={20} className="block w-full p-2 rounded bg-transparent border" value={evidence} onChange={event => { setEvidence(event.target.value); setSaved(false); }} placeholder="Describe the action and outcome. Include scope, units and timeframe only when known. For eligibility, state the actual qualification or status." />
        </label>
        <button type="submit" disabled={!employer.trim() || !role.trim() || evidence.trim().length < 20} className="px-3 py-2 rounded border font-bold disabled:opacity-40">Save to candidate notes</button>
        {saved && <p role="status">Saved to your brain dump. Run Optimize again to use this evidence.</p>}
      </form>
    </details>
  );
}
