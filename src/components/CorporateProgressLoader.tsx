import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSearch,
  ListChecks,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface CorporateProgressLoaderProps {
  isLoading: boolean;
  progress: number;
  currentStage?: string;
  isDarkMode?: boolean;
}

// A calm, business-appropriate set of milestones. No jargon, no sci-fi flourishes.
const STEPS = [
  { id: 1, label: 'Reviewing Resume', threshold: 0, icon: FileSearch },
  { id: 2, label: 'Matching Job Requirements', threshold: 25, icon: ListChecks },
  { id: 3, label: 'Optimizing Content', threshold: 55, icon: Sparkles },
  { id: 4, label: 'Finalizing Document', threshold: 85, icon: ShieldCheck },
];

const CorporateProgressLoader: React.FC<CorporateProgressLoaderProps> = ({
  isLoading,
  progress,
  currentStage,
  isDarkMode = false,
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth, steady progress interpolation (no easing gimmicks).
  useEffect(() => {
    let animationFrame: number;
    let current = displayProgress;
    const animate = () => {
      const diff = progress - current;
      if (Math.abs(diff) > 0.15) {
        current += diff * 0.12;
        setDisplayProgress(current);
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayProgress(progress);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  if (!isLoading) return null;

  const activeStepIndex = STEPS.reduce(
    (acc, step, idx) => (displayProgress >= step.threshold ? idx : acc),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`w-full h-full min-h-[500px] flex flex-col items-center justify-center py-12 px-6 md:px-10 rounded-2xl border ${
        isDarkMode ? 'bg-[#111214] border-white/10' : 'bg-white border-black/10'
      }`}
    >
      <div className="w-full max-w-xl flex flex-col items-center text-center">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 ${
            isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
          }`}
        >
          <Loader2 className={`w-7 h-7 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
        </div>

        <h2 className={`text-lg md:text-xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Optimizing Your Resume
        </h2>
        <p className={`text-sm mt-1.5 mb-8 ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>
          {currentStage || 'This usually takes less than a minute.'}
        </p>

        {/* Progress bar */}
        <div className="w-full">
          <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
            <motion.div
              className="h-full rounded-full bg-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
              transition={{ ease: 'linear', duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className={`text-xs font-medium ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
              Step {activeStepIndex + 1} of {STEPS.length}
            </span>
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>

        {/* Step list */}
        <div className="w-full mt-8 flex flex-col gap-2 text-left">
          {STEPS.map((step, idx) => {
            const isDone = idx < activeStepIndex || displayProgress >= 100;
            const isActive = idx === activeStepIndex && displayProgress < 100;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                  isActive
                    ? (isDarkMode ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-100')
                    : (isDarkMode ? 'border-transparent' : 'border-transparent')
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? (isDarkMode ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white')
                        : (isDarkMode ? 'bg-white/10 text-white/30' : 'bg-gray-100 text-gray-400')
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <step.icon className="w-3 h-3" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isDone || isActive
                      ? (isDarkMode ? 'text-white' : 'text-gray-900')
                      : (isDarkMode ? 'text-white/30' : 'text-gray-400')
                  }`}
                >
                  {step.label}
                </span>
                {isActive && (
                  <AnimatePresence>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`ml-auto text-[10px] font-semibold uppercase tracking-wider ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    >
                      In progress
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default CorporateProgressLoader;
