import React from 'react';
import { motion } from 'motion/react';
import { 
  FolderLock, 
  Layers, 
  Calendar, 
  CheckCircle, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  Database
} from 'lucide-react';
import { MasterResume } from '../../types';

interface MasterResumeIntelligencePanelProps {
  isDarkMode: boolean;
  masterResumes: MasterResume[];
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
  results: Record<string, any>;
  activeAudience: string | null;
}

export const MasterResumeIntelligencePanel: React.FC<MasterResumeIntelligencePanelProps> = ({
  isDarkMode,
  masterResumes,
  selectedResumeId,
  onSelectResume,
  results,
  activeAudience
}) => {
  const activeResult = activeAudience ? results[activeAudience] : null;
  const matchScore = activeResult?.match_score ?? null;

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="master-resume-intelligence-panel">
      
      {/* Visual background accents */}
      <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-emerald-500/10 blur-[50px] pointer-events-none -z-10" />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40 text-emerald-400">
            Vaulted Resume Index
          </h3>
          <p className="text-[10px] opacity-50 font-medium">Toggle active profile matrices</p>
        </div>
        <div className="flex items-center gap-1 opacity-60 text-[9px] font-mono uppercase">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>{masterResumes.length} profiles loaded</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {masterResumes.map((resume) => {
          const isSelected = resume.id === selectedResumeId;
          const formattedDate = resume.createdAt 
            ? new Date(resume.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Static';

          // Count experiences and skills in this specific resume data
          const expCount = Array.isArray(resume.data?.experience) ? resume.data.experience.length : 0;
          let skillsCount = 0;
          if (resume.data?.skills) {
            if (Array.isArray(resume.data.skills)) {
              skillsCount = resume.data.skills.length;
            } else if (typeof resume.data.skills === 'object') {
              Object.values(resume.data.skills).forEach((arr: any) => {
                if (Array.isArray(arr)) skillsCount += arr.length;
              });
            }
          }

          return (
            <div
              key={resume.id}
              onClick={() => onSelectResume(resume.id)}
              className={`relative cursor-pointer group text-left p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-[0_8px_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
                  : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10'
              }`}
            >
              {/* Core resume metadata */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FolderLock className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    <span className="font-bold text-xs truncate uppercase tracking-wider block">
                      {resume.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="shrink-0 flex items-center gap-1 text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      <CheckCircle className="w-2.5 h-2.5 fill-emerald-500/20" />
                      Active
                    </span>
                  )}
                </div>

                <p className="text-[10px] opacity-50 line-clamp-2 leading-relaxed font-medium mb-3">
                  {resume.description || 'Targeted Master Resume Profile'}
                </p>
              </div>

              {/* Lower info layer */}
              <div className="flex items-center justify-between border-t border-white/5 pt-2.5 mt-2.5 font-mono text-[9px] uppercase tracking-wider opacity-60">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{expCount}xp</span>
                  <span>•</span>
                  <span>{skillsCount} skills</span>
                </div>
              </div>

              {/* Highlight background light */}
              {isSelected && (
                <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-emerald-500/10 blur-xl rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default MasterResumeIntelligencePanel;
