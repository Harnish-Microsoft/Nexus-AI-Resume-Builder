import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { resumeHealth } from '../lib/resumeHealth';

interface ResumeHealthScoreProps {
  resumeText: string;
  isDarkMode: boolean;
}

export const ResumeHealthScore: React.FC<ResumeHealthScoreProps> = ({ resumeText, isDarkMode }) => {
  const health = useMemo(() => resumeHealth(resumeText), [resumeText]);
  if (!health) return null;
  return (
    <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-sm flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-500" />Source Resume Impact Audit</h3>
        <span className="font-bold">{health.audit ? `${health.audit.score}/100` : 'Not scored'}</span>
      </div>
      <p className="text-xs opacity-70 mb-3">
        Uses the same bullet-quality rules as the results Impact Audit. Not ATS compatibility or hiring probability.
        {!health.audit && ' At least three experience bullets are needed to score.'}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <span>Experience bullets: <strong>{health.bullets}</strong></span>
        <span>Strong opening verbs: <strong>{health.strongLeads}</strong></span>
        <span>Quantified bullets: <strong>{health.quantified}</strong></span>
        <span>Vague-language bullets: <strong>{health.vague}</strong></span>
      </div>
      {health.audit && <div className="mt-3 space-y-1 text-xs">
        {health.audit.components.map(component => (
          <p key={component.id}><strong>{component.label}: {Math.round(component.score * 100)}/100</strong> — {component.detail}</p>
        ))}
      </div>}
    </div>
  );
};
