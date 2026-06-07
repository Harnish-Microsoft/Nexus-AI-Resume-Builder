import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  SearchCode, 
  Layers, 
  Cpu, 
  CheckCircle2, 
  ArrowDown,
  Loader2,
  Sparkles
} from 'lucide-react';

interface OptimizationPipelinePanelProps {
  isDarkMode: boolean;
  jobDescription: string;
  isFetchingJob: boolean;
  isCheckingSuitability: boolean;
  selectedResumeId: string;
  isOptimizing: boolean;
  results: Record<string, any>;
  isDownloading: boolean;
}

export const OptimizationPipelinePanel: React.FC<OptimizationPipelinePanelProps> = ({
  isDarkMode,
  jobDescription,
  isFetchingJob,
  isCheckingSuitability,
  selectedResumeId,
  isOptimizing,
  results,
  isDownloading
}) => {
  const hasJD = jobDescription?.trim().length > 0;
  const hasAnalysis = Object.keys(results).length > 0 || isCheckingSuitability;
  const hasMasterSelected = !!selectedResumeId;
  const hasOptimization = Object.keys(results).length > 0;
  const isFinalReady = hasOptimization && !isOptimizing;

  const stages = [
    {
      id: 1,
      title: 'Job Description Input',
      description: 'Analyze keyword taxonomy & weight',
      icon: FileText,
      isCompleted: hasJD,
      isActive: isFetchingJob,
    },
    {
      id: 2,
      title: 'Multimodal Resume Analysis',
      description: 'Calculate semantic gap matrices',
      icon: SearchCode,
      isCompleted: hasAnalysis && hasJD,
      isActive: isCheckingSuitability,
    },
    {
      id: 3,
      title: 'Master Resume Selection',
      description: 'Choose matching source experiences',
      icon: Layers,
      isCompleted: hasMasterSelected && hasJD,
      isActive: false,
    },
    {
      id: 4,
      title: 'ATS Core Optimization',
      description: 'Inject tailored bullet proofs & terms',
      icon: Cpu,
      isCompleted: hasOptimization,
      isActive: isOptimizing,
    },
    {
      id: 5,
      title: 'Final Export Output',
      description: 'Generate dynamic paginated PDF/DOCX',
      icon: Sparkles,
      isCompleted: isFinalReady && !isDownloading,
      isActive: isDownloading,
    }
  ];

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="optimization-pipeline-panel">
      
      <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40 mb-6 text-emerald-400">
        AI Target Alignment Pipeline
      </h3>

      <div className="flex flex-col space-y-4">
        {stages.map((stage, idx) => {
          const IconComponent = stage.icon;
          const isLast = idx === stages.length - 1;

          return (
            <React.Fragment key={stage.id}>
              {/* Stage Element row */}
              <div 
                className={`relative flex items-center p-3.5 rounded-2xl border transition-all duration-300 ${
                  stage.isActive 
                    ? 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : stage.isCompleted 
                      ? 'border-emerald-500/10 bg-white/[0.01]' 
                      : 'border-white/5 opacity-50'
                }`}
              >
                {/* Visual completion / active state bubble */}
                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mr-4 transition-all duration-300 ${
                  stage.isActive 
                    ? 'bg-emerald-500 text-black animate-pulse' 
                    : stage.isCompleted 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-500/10 text-slate-400'
                }`}>
                  {stage.isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : stage.isCompleted ? (
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  ) : (
                    <IconComponent className="w-4.5 h-4.5" />
                  )}
                </div>

                {/* Text details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold tracking-wide ${
                      stage.isActive ? 'text-emerald-400' : 'text-white'
                    }`}>
                      {stage.title}
                    </span>
                    <span className={`text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded ${
                      stage.isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' 
                        : stage.isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-500/70' 
                          : 'bg-slate-500/10 text-slate-400/50'
                    }`}>
                      {stage.isActive ? 'Active' : stage.isCompleted ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[9px] opacity-50 mt-0.5 truncate leading-normal">
                    {stage.description}
                  </p>
                </div>
              </div>

              {/* Arrow linking connecting stages */}
              {!isLast && (
                <div className="flex justify-center -my-2 py-0.5">
                  <ArrowDown className={`w-3.5 h-3.5 ${
                    stage.isCompleted ? 'text-emerald-500/40' : 'text-white/10'
                  }`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
export default OptimizationPipelinePanel;
