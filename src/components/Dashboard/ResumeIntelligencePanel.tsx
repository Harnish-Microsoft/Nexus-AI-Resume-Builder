import React from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  CheckCircle2, 
  HelpCircle, 
  AlertTriangle,
  Lightbulb, 
  Zap,
  Flame,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface ResumeIntelligencePanelProps {
  isDarkMode: boolean;
  results: Record<string, any>;
  activeAudience: string | null;
  data: any;
  jobDescription: string;
  targetRole: string;
  companyName: string;
}

export const ResumeIntelligencePanel: React.FC<ResumeIntelligencePanelProps> = ({
  isDarkMode,
  results,
  activeAudience,
  data,
  jobDescription,
  targetRole,
  companyName,
}) => {
  // Extract active optimization result
  const activeResult = activeAudience ? results[activeAudience] : null;

  // 1. ATS Score
  const baselineScore = activeResult?.baseline_score ?? 0;
  const matchScore = activeResult?.match_score ?? 0;
  const hasScore = matchScore > 0;

  // 2. Skills Match count
  let matchedSkillsCount = 0;
  let gapSkillsCount = 0;
  if (activeResult?.skills) {
    // If skills are partitioned by category
    const skillsObj = activeResult.skills;
    if (typeof skillsObj === 'object' && !Array.isArray(skillsObj)) {
      Object.values(skillsObj).forEach((arr: any) => {
        if (Array.isArray(arr)) {
          matchedSkillsCount += arr.length;
        }
      });
    } else if (Array.isArray(skillsObj)) {
      matchedSkillsCount = skillsObj.length;
    }
  } else if (data?.skills) {
    matchedSkillsCount = Array.isArray(data.skills) ? data.skills.length : 0;
  }

  // 3. Keyword Match (from JD keywords)
  const keywordsAdded = activeResult?.ats_keywords_added_to_resume?.length ?? 0;
  const keywordGap = activeResult?.keyword_gap?.length ?? 0;
  const totalKeywords = keywordsAdded + keywordGap;
  const keywordMatchPercent = totalKeywords > 0 ? Math.round((keywordsAdded / totalKeywords) * 100) : 0;

  // 4. Resume Health Score - Calculated constructively based on completeness of real data
  let healthScore = 40; // baseline
  if (data?.personal_info?.name) healthScore += 10;
  if (data?.personal_info?.email && data?.personal_info?.phone) healthScore += 10;
  if (data?.experience?.length > 0) healthScore += 15;
  if (data?.skills?.length > 0 || matchedSkillsCount > 0) healthScore += 15;
  if (data?.projects?.length > 0) healthScore += 5;
  if (data?.education?.length > 0) healthScore += 5;
  // Caps at 100
  healthScore = Math.min(healthScore, 100);

  // 5. Optimization Readiness - based on filled inputs
  let readinessScore = 0;
  if (targetRole) readinessScore += 30;
  if (companyName) readinessScore += 20;
  if (jobDescription) readinessScore += 50;

  // SVG parameters for radial gauge
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((hasScore ? matchScore : healthScore) / 100) * circumference;

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="resume-intelligence-panel">
      {/* Decorative ambient aurora behind the dial */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-[80px] bg-emerald-500/10 pointer-events-none -z-10 animate-pulse" />

      <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40 mb-5 text-emerald-400">
        Resume Intelligence DNA
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Radial Progress Display */}
        <div className="md:col-span-4 flex flex-col items-center justify-center p-3 relative h-full">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Background Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                className={isDarkMode ? "stroke-white/5" : "stroke-neutral-200"}
                strokeWidth="10"
                fill="transparent"
              />
              {/* Highlight Circle */}
              <motion.circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-emerald-400"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.5))'
                }}
              />
            </svg>

            {/* Inner text values */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <motion.span 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-black tracking-tight"
              >
                {hasScore ? matchScore : healthScore}%
              </motion.span>
              <span className="text-[8px] font-bold tracking-widest opacity-60 uppercase text-emerald-400">
                {hasScore ? 'ATS Score' : 'Health Score'}
              </span>
            </div>
          </div>

          {/* Baseline score indicator */}
          {hasScore && (
            <div className="mt-2 text-center">
              <span className="text-[10px] opacity-60">Baseline Score: </span>
              <span className="text-xs font-black line-through opacity-40 mr-1.5">{baselineScore}%</span>
              <span className="text-xs font-black text-emerald-400">+{matchScore - baselineScore}% Gain</span>
            </div>
          )}
        </div>

        {/* Intelligence KPIs details */}
        <div className="md:col-span-8 grid grid-cols-2 gap-4">
          
          {/* ATS Score Card */}
          <div className={`p-4 rounded-2xl border transition-all hover:bg-white/5 ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.01] border-black/5'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-bold tracking-wider opacity-60 uppercase">Match Matcher</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black">{hasScore ? matchScore : 'TBD'}</span>
              <span className="text-[8px] font-mono opacity-50">/100 Max</span>
            </div>
            <div className="w-full bg-slate-500/10 h-1 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full" 
                style={{ width: `${hasScore ? matchScore : 0}%` }}
              />
            </div>
          </div>

          {/* Skills Match Card */}
          <div className={`p-4 rounded-2xl border transition-all hover:bg-white/5 ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.01] border-black/5'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-bold tracking-wider opacity-60 uppercase">Skills Count</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black">{matchedSkillsCount}</span>
              <span className="text-[8px] font-mono opacity-50">Skills total</span>
            </div>
            <div className="w-full bg-slate-500/10 h-1 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full" 
                style={{ width: `${Math.min((matchedSkillsCount / 30) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Keyword Match Card */}
          <div className={`p-4 rounded-2xl border transition-all hover:bg-white/5 ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.01] border-black/5'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-bold tracking-wider opacity-60 uppercase">Keyword Gaps</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              {hasScore ? (
                <>
                  <span className="text-lg font-black">{keywordsAdded}</span>
                  <span className="text-[8px] font-mono opacity-50">/ {totalKeywords} keywords</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-black text-amber-500">None</span>
                  <span className="text-[8px] font-mono opacity-50">Yet parsed</span>
                </>
              )}
            </div>
            <div className="w-full bg-slate-500/10 h-1 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${hasScore ? 'bg-emerald-400' : 'bg-amber-500'}`} 
                style={{ width: `${hasScore ? keywordMatchPercent : 0}%` }}
              />
            </div>
          </div>

          {/* Readiness Score Card */}
          <div className={`p-4 rounded-2xl border transition-all hover:bg-white/5 ${
            isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.01] border-black/5'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Flame className="w-4 h-4 text-emerald-400" />
              <span className="text-[9px] font-bold tracking-wider opacity-60 uppercase">Readiness</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black">{readinessScore}%</span>
              <span className="text-[8px] font-mono opacity-50">Configured</span>
            </div>
            <div className="w-full bg-slate-500/10 h-1 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${readinessScore === 100 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default ResumeIntelligencePanel;
