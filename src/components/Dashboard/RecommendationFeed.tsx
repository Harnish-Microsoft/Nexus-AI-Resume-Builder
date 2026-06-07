import React from 'react';
import { motion } from 'motion/react';
import { 
  Compass, 
  Sparkles, 
  ShieldAlert, 
  Lightbulb, 
  CheckSquare, 
  HelpCircle 
} from 'lucide-react';

interface RecommendationFeedProps {
  isDarkMode: boolean;
  results: Record<string, any>;
  activeAudience: string | null;
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({
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
      }`} id="recommendation-feed">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4 border border-teal-500/20">
          <Lightbulb className="w-5 h-5 text-teal-400" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-widest mb-1.5 text-white">
          No Strategic Recommendations
        </h3>
        <p className="text-[10px] opacity-60 max-w-[340px] mx-auto leading-relaxed">
          Operational advices, targeting guidance indicators and critique items will be generated here upon active parsing of your resume against target JDs!
        </p>
      </div>
    );
  }

  const improvements = activeResult.improvement_notes ?? [];
  const rejectionReasons = activeResult.rejection_reasons ?? [];
  const whyJob = activeResult.why_this_job ?? '';

  const hasContent = improvements.length > 0 || rejectionReasons.length > 0 || whyJob;

  if (!hasContent) {
    return (
      <div className={`p-8 rounded-3xl border text-center select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
        isDarkMode 
          ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
          : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
      }`} id="recommendation-feed">
        <h3 className="text-xs font-bold uppercase tracking-widest mb-1 text-white">
          Recommendations Standby
        </h3>
        <p className="text-[9px] opacity-50">
          Target optimization is updated but returned empty strategic gaps.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="recommendation-feed">
      
      <div className="flex items-center gap-2 mb-5 border-b border-white/5 pb-3">
        <Sparkles className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
            Targeting Advisories
          </h3>
          <p className="text-[9px] opacity-50 font-medium">Formed by Nexus model layers</p>
        </div>
      </div>

      <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
        {/* Rejection fears / warning advisories */}
        {rejectionReasons.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Risk Shield Deficiencies Detected
            </span>
            <div className="space-y-2">
              {rejectionReasons.map((reason: string, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-[10px] leading-relaxed text-rose-300 text-left">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvements / Positive pointers */}
        {improvements.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-white/5">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" />
              Corrective Adjustments Formulated
            </span>
            <div className="space-y-2">
              {improvements.map((imp: string, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-white/[0.01] border border-white/5 text-[10px] leading-relaxed text-slate-200 text-left">
                  {imp}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default RecommendationFeed;
