import React from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Check, 
  HelpCircle, 
  ArrowRight, 
  FileCheck2, 
  Shuffle, 
  Compass, 
  Zap, 
  FileText
} from 'lucide-react';

interface OptimizationResultsPanelProps {
  isDarkMode: boolean;
  results: Record<string, any>;
  activeAudience: string | null;
}

export const OptimizationResultsPanel: React.FC<OptimizationResultsPanelProps> = ({
  isDarkMode,
  results,
  activeAudience,
}) => {
  const activeResult = activeAudience ? results[activeAudience] : null;

  if (!activeResult) {
    return (
      <div className={`p-8 rounded-3xl border text-center select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
        isDarkMode 
          ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
          : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
      }`} id="optimization-results-panel">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] bg-emerald-500/5 pointer-events-none -z-10" />
        <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
          <FileText className="w-5 h-5 text-emerald-400" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest mb-1.5 text-white">
          No Optimization Output Captured
        </h3>
        <p className="text-[10px] opacity-60 max-w-[340px] mx-auto leading-relaxed">
          Supply a Target Role and Job Description, then trigger the <b>Optimize</b> action above. Live tailored keywords, skills and audit notes will populate this space.
        </p>
      </div>
    );
  }

  const baselineScore = activeResult.baseline_score ?? 0;
  const matchScore = activeResult.match_score ?? 0;
  const keywordsAdded = activeResult.ats_keywords_added_to_resume ?? [];
  const keywordGap = activeResult.keyword_gap ?? [];
  const improvements = activeResult.improvement_notes ?? [];
  const whyJob = activeResult.why_this_job ?? '';

  // Extract skills tailored from results
  const skillsObj = activeResult.skills ?? {};
  const matchedSkills: string[] = [];
  if (typeof skillsObj === 'object' && !Array.isArray(skillsObj)) {
    Object.entries(skillsObj).forEach(([category, list]) => {
      if (Array.isArray(list)) matchedSkills.push(...list);
    });
  } else if (Array.isArray(skillsObj)) {
    matchedSkills.push(...skillsObj);
  }

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="optimization-results-panel">
      
      {/* Decorative gradient corner indicator */}
      <div className="absolute -top-12 -left-12 w-28 h-28 bg-emerald-500/10 blur-[40px] pointer-events-none -z-10" />

      <div className="flex items-center gap-2.5 mb-5 border-b border-white/5 pb-4">
        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
            Optimization Synthesis Engine
          </h3>
          <p className="text-[9px] opacity-50 uppercase tracking-widest font-bold">Injected Resume Delta Logs</p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* Comparison Scoring visual row */}
        {(baselineScore > 0 || matchScore > 0) && (
          <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase opacity-40">Parser Performance Match</span>
              <span className="text-[10px] opacity-75 font-semibold mt-1">Match increase driven by semantic additions</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-[8px] opacity-40 font-bold block uppercase">Baseline</span>
                <span className="text-sm font-bold opacity-50 line-through">{baselineScore}%</span>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400/60" />
              <div className="text-center">
                <span className="text-[8px] text-emerald-400 font-bold block uppercase">Optimized</span>
                <span className="text-lg font-black text-emerald-400">{matchScore}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Why this job narrative paragraph */}
        {whyJob && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-black uppercase opacity-40 tracking-wider">
              Strategic Target Fit Formulation
            </h4>
            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-[10px] leading-relaxed opacity-85 text-left italic">
              "{whyJob}"
            </div>
          </div>
        )}

        {/* Tailored Keywords injection list */}
        {keywordsAdded.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-black uppercase opacity-40 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Keywords Tailored into System ({keywordsAdded.length})
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
              {keywordsAdded.map((kw: string, i: number) => (
                <span 
                  key={i} 
                  className="text-[9px] font-medium font-mono border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 px-2 py-0.5 rounded-md hover:bg-emerald-500/15 transition-all text-left"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic skills categories match if present */}
        {matchedSkills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-black uppercase opacity-40 tracking-wider">
              Injected Skills Alignments ({matchedSkills.length})
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
              {matchedSkills.map((sk: string, i: number) => (
                <span 
                  key={i} 
                  className="text-[9px] font-medium font-mono border border-blue-500/10 bg-blue-500/5 text-blue-400 px-2 py-0.5 rounded-md hover:bg-blue-500/15 transition-all"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Improvement lists */}
        {improvements.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[9px] font-black uppercase opacity-40 tracking-wider">
              Bullet Proof & Layout Adjustments
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {improvements.map((note: string, i: number) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-xl bg-white/[0.01] border border-white/5 transition-all hover:bg-white/[0.03]">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-relaxed text-slate-300 text-left">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keyword core gap left */}
        {keywordGap.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-black uppercase opacity-40 tracking-wider text-amber-500">
              Outstanding Core Relevance Holes ({keywordGap.length})
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
              {keywordGap.map((kw: string, i: number) => (
                <span 
                  key={i} 
                  className="text-[9px] font-medium font-mono border border-amber-500/10 bg-amber-500/5 text-amber-400 px-2 py-0.5 rounded-md"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default OptimizationResultsPanel;
