import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Network, 
  Cpu, 
  Brain, 
  Database, 
  Zap, 
  BarChart3, 
  ShieldCheck,
  Terminal
} from 'lucide-react';

interface CloudArchitectureLoaderProps {
  isLoading: boolean;
  progress: number;
  currentStage?: string;
}

const STAGES = [
  { id: 1, name: 'Parser', status: 'Parsing Resume...', icon: FileText },
  { id: 2, name: 'Network', status: 'Analyzing Experience...', icon: Network },
  { id: 3, name: 'AI Engine', status: 'Extracting Skills...', icon: Cpu },
  { id: 4, name: 'Intelligence', status: 'Matching Keywords...', icon: Brain },
  { id: 5, name: 'Keyword DB', status: 'Enhancing ATS Score...', icon: Database },
  { id: 6, name: 'ATS Engine', status: 'Optimizing Achievements...', icon: Zap },
  { id: 7, name: 'Scoring', status: 'Calculating Resume Strength...', icon: BarChart3 },
  { id: 8, name: 'Gateway', status: 'Generating Final Resume...', icon: ShieldCheck },
];

const CloudArchitectureLoader: React.FC<CloudArchitectureLoaderProps> = ({ 
  isLoading, 
  progress, 
  currentStage 
}) => {
  const MathRound = Math.round;
  const [activeStage, setActiveStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Smooth out progress updates so it doesn't jump abruptly
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let animationFrame: number;
    let current = displayProgress;
    const animate = () => {
      // Smooth interpolation towards target progress
      const diff = progress - current;
      if (diff > 0.1) {
        current += diff * 0.02; // Slow down the approach
        setDisplayProgress(current);
        animationFrame = requestAnimationFrame(animate);
      } else if (diff < -0.1) {
        current += diff * 0.1;
        setDisplayProgress(current);
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayProgress(progress);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [progress]);

  useEffect(() => {
    const stageIndex = Math.min(Math.floor((displayProgress / 100) * STAGES.length), STAGES.length - 1);
    setActiveStage(stageIndex);
  }, [displayProgress]);

  useEffect(() => {
    if (currentStage) {
      setLogs(prev => {
        if (prev[prev.length - 1] === currentStage) return prev;
        return [...prev.slice(-4), currentStage];
      });
    }
  }, [currentStage]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isLoading) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full min-h-[500px] flex flex-col items-center justify-center py-10 px-4 md:p-12 rounded-2xl overflow-hidden font-sans relative border border-black/10 dark:border-white/10 dark:bg-slate-950 bg-slate-900"
    >
      {/* Background Grid Accent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} 
      />
      
      {/* Animated Atmosphere */}
      <div className="absolute top-1/4 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-blue-600/20 rounded-full blur-[100px] md:blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-indigo-600/20 rounded-full blur-[100px] md:blur-[120px] animate-pulse delay-1000 pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        
        {/* Top Section: ATS Score & Status */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-8 md:mb-12 w-full">
          {/* ATS Score Display */}
          <div className="relative shrink-0 flex flex-col items-center">
            <svg className="w-32 h-32 md:w-40 md:h-40 -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="6"
              />
              <motion.circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="transparent"
                stroke="url(#atsGradient)"
                strokeWidth="6"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100}
                animate={{ strokeDashoffset: 100 - displayProgress }}
                transition={{ duration: 0.1, ease: "linear" }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="atsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl md:text-5xl font-bold text-white tracking-tighter">
                {MathRound(displayProgress)}%
              </span>
              <span className="text-slate-400 text-[10px] md:text-xs uppercase font-bold tracking-widest mt-1 text-center leading-tight">ATS Score<br/>Generating...</span>
            </div>
          </div>

          {/* Terminal / Status Logs */}
          <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col shadow-2xl backdrop-blur-md shrink-0 h-[140px] md:h-[160px]">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
              <Terminal size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400 font-mono uppercase tracking-wider font-bold">Optimization Pipeline</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col justify-end font-mono text-[10px] md:text-xs">
              <AnimatePresence initial={false}>
                {logs.map((log, i) => (
                  <motion.div
                    key={log + i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: i === logs.length - 1 ? 1 : 0.5, x: 0 }}
                    className={`py-1 ${i === logs.length - 1 ? 'text-blue-400 font-medium' : 'text-slate-400'}`}
                  >
                    <span className="text-slate-600 mr-2">&gt;</span>
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Architecture Visualization - Desktop/Tablet */}
        <div className="w-full relative py-8 px-2 md:px-10 mt-4 md:mt-8 hidden md:block">
           {/* Connection Lines (Background) */}
           <div className="absolute top-1/2 left-8 right-8 h-[1px] bg-slate-800 -translate-y-[20px] overflow-hidden">
            <motion.div 
               className="h-full w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
               animate={{ x: ['-100%', '100%'] }}
               transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          <div className="flex justify-between items-center relative z-10 w-full">
            {STAGES.map((stage, idx) => {
              const isPast = idx < activeStage;
              const isActive = idx === activeStage;
              
              return (
                <div key={stage.id} className="flex flex-col items-center relative group w-full">
                  {/* Node */}
                  <motion.div 
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-xl border relative z-10 flex items-center justify-center transition-all duration-500 shadow-lg shrink-0 ${
                      isPast ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 
                      isActive ? 'bg-white border-white text-blue-600' : 
                      'bg-slate-900 border-slate-700/50 text-slate-600'
                    }`}
                    animate={isActive ? { 
                      scale: [1, 1.1, 1], 
                      boxShadow: ['0 0 0px rgba(59,130,246,0)', '0 0 30px rgba(59,130,246,0.5)', '0 0 0px rgba(59,130,246,0)'] 
                    } : { scale: 1 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <stage.icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                    {isActive && (
                      <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
                    )}
                  </motion.div>

                  {/* Label */}
                  <div 
                    className={`absolute -bottom-10 text-[8px] md:text-[9px] uppercase font-bold tracking-[0.1em] md:tracking-[0.2em] whitespace-nowrap transition-all duration-300 ${
                      isActive || isPast ? 'text-blue-400 opacity-100' : 'text-slate-600 opacity-0 group-hover:opacity-100 mt-2'
                    }`}
                  >
                    {stage.name}
                  </div>

                  {/* Packet Animation from current to next */}
                  {isActive && idx < STAGES.length - 1 && (
                    <motion.div 
                      className="absolute top-[20px] left-1/2 w-full h-[1px] -translate-y-1/2 z-20 pointer-events-none"
                    >
                      <motion.div 
                        className="w-10 h-full bg-gradient-to-r from-transparent via-white to-transparent"
                        initial={{ left: '0%' }}
                        animate={{ left: '100%' }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'easeIn' }}
                        style={{ position: 'absolute' }}
                      />
                    </motion.div>
                  )}
                </div>
              );
            })}

            {/* Floating Resume Card */}
            <motion.div 
              className="absolute top-1/2 -translate-y-[90px] z-30"
              animate={{ 
                left: `calc(${(activeStage / Math.max(1, STAGES.length - 1)) * 100}% - 12px)`,
                y: [0, -10, 0]
              }}
              transition={{ 
                left: { duration: 1.5, ease: "easeInOut" },
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <div className="w-10 h-14 md:w-12 md:h-16 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl flex flex-col p-1.5 gap-1.5 overflow-hidden">
                <div className="w-2/3 h-1 md:h-1.5 bg-white/20 rounded-full" />
                <div className="space-y-1">
                  <div className="w-full h-[1px] bg-white/10" />
                  <div className="w-full h-[1px] bg-white/10" />
                  <div className="w-4/5 h-[1px] bg-white/10" />
                </div>
                <div className="space-y-1">
                  <div className="w-full h-[1px] bg-white/10" />
                  <div className="w-3/4 h-[1px] bg-white/10" />
                </div>
                <div className="mt-auto w-full flex justify-between">
                  <div className="w-1.5 h-1.5 bg-blue-400/50 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-indigo-400/50 rounded-full" />
                </div>
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12"
                  animate={{ left: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <div className="absolute -inset-4 bg-blue-500/10 blur-2xl rounded-full" />
            </motion.div>
          </div>
        </div>

        {/* Mobile Vertical View */}
        <div className="w-full mt-4 flex flex-col md:hidden relative px-4 pb-8 max-w-[300px] mx-auto">
          <div className="absolute left-[30px] top-4 bottom-4 w-[1px] bg-slate-800">
             <motion.div 
               className="w-full h-1/4 bg-gradient-to-b from-transparent via-blue-500/50 to-transparent absolute top-0 left-0"
               animate={{ top: ['-25%', '100%'] }}
               transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          
          <div className="flex flex-col gap-6 relative z-10 w-full pl-3">
             {STAGES.map((stage, idx) => {
               const isPast = idx < activeStage;
               const isActive = idx === activeStage;
               return (
                 <div key={stage.id} className="flex items-center gap-6 relative">
                   <motion.div 
                    className={`w-9 h-9 rounded-lg border relative z-10 flex items-center justify-center transition-all duration-500 shrink-0 ${
                      isPast ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 
                      isActive ? 'bg-white border-white text-blue-600' : 
                      'bg-slate-900 border-slate-700/50 text-slate-600'
                    }`}
                    animate={isActive ? { 
                      scale: [1, 1.1, 1], 
                      boxShadow: ['0 0 0px rgba(59,130,246,0)', '0 0 20px rgba(59,130,246,0.5)', '0 0 0px rgba(59,130,246,0)'] 
                    } : { scale: 1 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <stage.icon className="w-4 h-4" />
                    {isActive && (
                      <div className="absolute -inset-3 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />
                    )}
                  </motion.div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive || isPast ? 'text-blue-400' : 'text-slate-600'}`}>
                    {stage.name}
                  </div>
                 </div>
               )
             })}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default CloudArchitectureLoader;

