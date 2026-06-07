import React from 'react';
import { motion } from 'motion/react';
import { 
  Bot, 
  Cpu, 
  Hash, 
  ShieldCheck, 
  SlidersHorizontal, 
  Compass, 
  Zap, 
  Workflow, 
  Sparkles 
} from 'lucide-react';

interface AIInsightsPanelProps {
  isDarkMode: boolean;
  isOptimizing: boolean;
  isFetchingJob: boolean;
  isCheckingSuitability: boolean;
  isDownloading: boolean;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
  isDarkMode,
  isOptimizing,
  isFetchingJob,
  isCheckingSuitability,
  isDownloading
}) => {
  const isAnyAgentWorking = isOptimizing || isFetchingJob || isCheckingSuitability || isDownloading;

  const agents = [
    {
      id: 'ats',
      name: 'ATS Guard Agent',
      duty: 'Optimize semantic scoring & layout parsing',
      icon: ShieldCheck,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
      isActive: isFetchingJob,
      statusLabel: 'Analyzing JD...'
    },
    {
      id: 'keyword',
      name: 'Taxonomy Agent',
      duty: 'Trace keyword weight, density & gaps',
      icon: Hash,
      color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
      isActive: isOptimizing && !isDownloading,
      statusLabel: 'Resolving Gaps...'
    },
    {
      id: 'skills',
      name: 'Skills Group Agent',
      duty: 'Compile Technical Taxonomies',
      icon: Cpu,
      color: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
      isActive: isCheckingSuitability,
      statusLabel: 'Fitting Skills...'
    },
    {
      id: 'leadership',
      name: 'Impact Agent',
      duty: 'Scale measurable business outcome vectors',
      icon: Zap,
      color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
      isActive: isOptimizing,
      statusLabel: 'Forming Bullets...'
    },
    {
      id: 'formatting',
      name: 'Audit Layout Agent',
      duty: 'Calibrate margins, alignment & line cuts',
      icon: SlidersHorizontal,
      color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
      isActive: isDownloading,
      statusLabel: 'Sizing PDF...'
    },
    {
      id: 'career',
      name: 'Career Pathfinder',
      duty: 'Map target roles suitability & tracks',
      icon: Compass,
      color: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
      isActive: isCheckingSuitability,
      statusLabel: 'Rating Verdict...'
    }
  ];

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="ai-insights-panel">
      
      {/* Decorative top pulse */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-[30px] pointer-events-none -z-10" />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
            Nexus Agent Workforce
          </h3>
          <p className="text-[10px] opacity-50 font-medium mt-0.5">Autonomous intelligence modules</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1.5 px-3 rounded-full text-[8px] font-black uppercase tracking-wider text-emerald-400">
          <Workflow className="w-3.5 h-3.5" />
          <span>{isAnyAgentWorking ? 'ACTIVE CONCURRENCY' : 'STANDBY IDLE'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5">
        {agents.map((agent) => {
          const IconComponent = agent.icon;
          const showPulse = agent.isActive || (!isAnyAgentWorking && agent.id === 'ats'); // ATS pulse fallback standby

          return (
            <div 
              key={agent.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all duration-300 ${
                agent.isActive 
                  ? 'border-emerald-500/30 bg-emerald-500/10 shadow-[0_4px_15px_rgba(16,185,129,0.1)]' 
                  : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.02]'
              }`}
            >
              {/* Left element with icon & titles */}
              <div className="flex items-center gap-3">
                <div className={`w-8.5 h-8.5 rounded-xl border flex items-center justify-center shrink-0 ${agent.color}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className={`text-[11px] font-bold tracking-wide block ${
                    agent.isActive ? 'text-emerald-400' : 'text-slate-100'
                  }`}>
                    {agent.name}
                  </span>
                  <span className="text-[9px] opacity-50 leading-normal block max-w-xs truncate md:max-w-none">
                    {agent.duty}
                  </span>
                </div>
              </div>

              {/* Status pulse label */}
              <div className="flex items-center gap-2">
                {showPulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                <span className={`text-[8px] font-mono font-black uppercase tracking-widest ${
                  agent.isActive ? 'text-emerald-400' : 'opacity-40'
                }`}>
                  {agent.isActive ? agent.statusLabel : isAnyAgentWorking ? 'PAUSED' : 'READY'}
                </span>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
export default AIInsightsPanel;
