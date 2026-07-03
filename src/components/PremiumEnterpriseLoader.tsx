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
  Terminal,
  Activity,
  Layers,
  Fingerprint,
  CheckCircle2,
  Workflow,
  Sparkles
} from 'lucide-react';

interface PremiumEnterpriseLoaderProps {
  isLoading: boolean;
  progress: number;
  currentStage?: string;
}

const STAGE_1_MESSAGES = [
  "Scanning Resume Assets...",
  "Analyzing Career History...",
  "Matching Technical Skills...",
  "Comparing Experience...",
  "Evaluating ATS Readiness...",
  "Calculating Resume Strength..."
];

const STAGE_2_MESSAGES = [
  "Selecting Best Candidate Profile...",
  "Comparing Resume Intelligence Scores...",
  "Building Optimization Blueprint...",
  "Preparing Enhancement Pipeline..."
];

const PremiumEnterpriseLoader: React.FC<PremiumEnterpriseLoaderProps> = ({ 
  isLoading, 
  progress, 
  currentStage 
}) => {
  const MathRound = Math.round;
  const [displayProgress, setDisplayProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Smooth progress interpolation
  useEffect(() => {
    let animationFrame: number;
    let current = displayProgress;
    const animate = () => {
      const diff = progress - current;
      if (diff > 0.1) {
        current += diff * 0.02;
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

  // Determine current phase based on progress
  const phase = displayProgress < 40 ? 1 : displayProgress < 75 ? 2 : 3;

  // Status message rotation
  const [statusMessage, setStatusMessage] = useState(STAGE_1_MESSAGES[0]);
  useEffect(() => {
    const messages = phase === 1 ? STAGE_1_MESSAGES : STAGE_2_MESSAGES;
    const interval = setInterval(() => {
      setStatusMessage(prev => {
        const currentIndex = messages.indexOf(prev);
        return messages[(currentIndex + 1) % messages.length];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [phase]);

  // Use external logs if provided
  useEffect(() => {
    if (currentStage) {
      setLogs(prev => {
        if (prev[prev.length - 1] === currentStage) return prev;
        return [...prev.slice(-5), currentStage];
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
      className="w-full h-full min-h-[650px] flex flex-col items-center py-8 px-4 md:p-10 rounded-2xl overflow-hidden font-sans relative border border-slate-800 bg-[#0f172a] shadow-2xl"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`,
          backgroundSize: '30px 30px'
        }} 
      />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <div className="z-10 w-full max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-white flex items-center gap-3 tracking-tight">
            <Activity className="text-blue-500 animate-pulse" size={28} />
            Nexus AI Resume Optimizer
          </h1>
          <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mt-2 ml-10">Building the strongest version of your professional profile</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex gap-6 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Overall Progress</span>
            <span className="text-2xl font-bold text-white font-mono">{MathRound(displayProgress)}%</span>
          </div>
          <div className="flex flex-col border-l border-white/10 pl-6">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Current Stage</span>
            <span className="text-sm font-semibold text-blue-400 tracking-wider">
              {phase === 1 ? 'Phase 1: Scanning' : phase === 2 ? 'Phase 2: AI Selection' : 'Phase 3: DNA Recon'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="z-10 w-full max-w-5xl flex-1 flex flex-col relative">
        <AnimatePresence mode="wait">
          
          {/* PHASE 1: Scanning Master Resumes */}
          {phase === 1 && (
            <motion.div 
              key="phase1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="w-full flex-1 flex flex-col items-center justify-center pt-8"
            >
              <div className="flex w-full justify-between items-center relative">
                
                {/* Left: Job Description */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-32 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl relative overflow-hidden flex flex-col p-2">
                    <div className="w-full h-2 bg-blue-500/50 rounded mb-2" />
                    <div className="w-2/3 h-1 bg-slate-500 rounded mb-1" />
                    <div className="w-3/4 h-1 bg-slate-500 rounded mb-1" />
                    <div className="w-full h-1 bg-slate-500 rounded mb-1" />
                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none" />
                  </div>
                  <span className="text-xs text-slate-400 font-mono tracking-widest uppercase font-bold">Target JD</span>
                </div>

                {/* Center: Cloud Architecture */}
                <div className="flex-1 px-8 relative h-[200px] flex items-center justify-center hidden md:flex">
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-700 -translate-y-1/2" />
                  {/* Data Packets */}
                  <motion.div 
                    className="absolute top-1/2 w-4 h-1 bg-blue-400 shadow-[0_0_10px_#60a5fa] rounded-full z-20"
                    animate={{ left: ['0%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{ y: '-50%' }}
                  />
                  <div className="flex justify-between w-full relative z-10 px-8">
                    {[Network, Brain, Database, Zap].map((Icon, i) => (
                      <div key={i} className="w-12 h-12 bg-slate-900 border border-slate-600 rounded-lg flex items-center justify-center shadow-lg relative group">
                        <Icon size={20} className="text-blue-400" />
                        <div className="absolute -inset-2 bg-blue-500/20 blur-md rounded-lg pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: 5 Master Resumes */}
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const isBest = i === 3;
                    const score = isBest ? MathRound(65 + displayProgress * 0.7) : MathRound(40 + Math.random() * 40);
                    return (
                      <div key={i} className={`flex items-center gap-4 bg-slate-800/50 border pr-4 p-2 rounded-lg transition-all ${isBest ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-slate-700 opacity-60'}`}>
                        <div className="w-6 h-8 bg-slate-700 rounded border border-slate-600" />
                        <div className="flex flex-col w-24">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Master {i}</span>
                          <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <motion.div 
                              className={`h-full ${isBest ? 'bg-blue-500' : 'bg-slate-500'}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-xs font-mono font-bold ${isBest ? 'text-blue-400' : 'text-slate-500'}`}>{score}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: Selection & AI Prep */}
          {phase === 2 && (
            <motion.div 
              key="phase2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="w-full flex-1 flex flex-col items-center justify-center pt-4"
            >
              <div className="w-full max-w-2xl bg-black/40 border border-white/10 rounded-xl p-8 backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                
                <div className="flex flex-col md:flex-row items-center gap-10">
                  {/* Selected Resume Focus */}
                  <motion.div 
                    initial={{ y: 20 }}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className="relative"
                  >
                    <div className="w-32 h-44 bg-slate-800 border border-blue-500 rounded-lg shadow-[0_0_30px_rgba(59,130,246,0.2)] flex flex-col p-3">
                      <div className="w-full h-2 bg-blue-400/50 rounded mb-3" />
                      <div className="space-y-1.5 mb-4">
                        <div className="w-full h-1 bg-slate-600 rounded" />
                        <div className="w-5/6 h-1 bg-slate-600 rounded" />
                        <div className="w-4/6 h-1 bg-slate-600 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="w-full h-1 bg-slate-600 rounded" />
                        <div className="w-full h-1 bg-slate-600 rounded" />
                      </div>
                    </div>
                    {/* Glowing Selection Ring */}
                    <div className="absolute -inset-6 border border-blue-500/30 rounded-xl animate-spin-slow pointer-events-none" style={{ animationDuration: '10s' }} />
                  </motion.div>

                  {/* AI Agents Dashboard */}
                  <div className="flex-1 w-full space-y-4">
                    <h3 className="text-lg font-light text-white border-b border-white/10 pb-2">Master #3 Selected</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Content Agent', icon: FileText, active: true },
                        { label: 'ATS Agent', icon: Zap, active: true },
                        { label: 'Keyword Agent', icon: Database, active: true },
                        { label: 'Impact Agent', icon: BarChart3, active: displayProgress > 55 }
                      ].map((agent, i) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${agent.active ? 'bg-blue-900/20 border-blue-500/30 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                          <agent.icon size={14} className={agent.active ? 'animate-pulse' : ''} />
                          <span className="text-[10px] uppercase tracking-widest font-bold">{agent.label}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                       <span className="text-xs text-slate-400 uppercase tracking-widest font-black inline-block mb-2">Confidence Score</span>
                       <div className="flex items-end gap-2">
                         <span className="text-3xl font-mono text-emerald-400 leading-none">94%</span>
                         <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Optimal Match Found</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PHASE 3: Final Optimization & DNA */}
          {phase === 3 && (
            <motion.div 
              key="phase3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="w-full flex-1 flex flex-col items-center justify-center pt-4"
            >
              <div className="flex flex-col md:flex-row items-center justify-center gap-12 w-full">
                
                {/* DNA Visualization */}
                <div className="relative w-40 h-64 flex justify-center items-center">
                  <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                  <motion.div
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="relative w-16 h-full flex flex-col justify-between py-2 perspective-1000"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Simulated DNA Rungs */}
                    {[1,2,3,4,5,6,7].map(i => (
                      <div key={i} className="w-full h-[2px] bg-gradient-to-r from-blue-400 to-indigo-500 relative shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-300" />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-300" />
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Transformation Stats */}
                <div className="w-full max-w-sm flex flex-col gap-4">
                  <h3 className="text-white text-xl font-light mb-2 flex items-center gap-2">
                    <Sparkles className="text-indigo-400" size={20} />
                    DNA Reconstruction
                  </h3>
                  
                  {[
                    { label: 'Keyword Density', improvement: '+42%' },
                    { label: 'ATS Score', improvement: '96%', isScore: true },
                    { label: 'Impact Metrics', improvement: 'Optimized' }
                  ].map((stat, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                      <span className="text-[11px] uppercase tracking-widest text-slate-300 font-bold flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        {stat.label}
                      </span>
                      <span className={`font-mono font-bold ${stat.isScore ? 'text-2xl text-emerald-400' : 'text-sm text-blue-400'}`}>
                        {stat.isScore ? MathRound(displayProgress) + '%' : stat.improvement}
                      </span>
                    </div>
                  ))}
                  
                  {displayProgress > 95 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-center p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs font-bold uppercase tracking-widest"
                    >
                      ✓ Recruiter Friendly & Interview Ready
                    </motion.div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Console Panel */}
      <div className="z-10 w-full max-w-5xl mt-8">
        <div className="flex flex-col md:flex-row gap-4">
          
          {/* Status Message */}
          <div className="flex-1 bg-black/40 border border-slate-800 rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center animate-pulse shrink-0">
              <Workflow size={16} className="text-blue-400" />
            </div>
            <div flex-col>
              <span className="text-[9px] uppercase tracking-widest font-black text-slate-500 block mb-1">System Action</span>
              <AnimatePresence mode="wait">
                <motion.span 
                  key={statusMessage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-sm font-mono text-white tracking-wide block"
                >
                  {statusMessage}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* Terminal Logs */}
          <div className="w-full md:w-80 bg-[#0a0f1c] border border-slate-800 rounded-lg p-3 flex flex-col h-[74px]">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1 mb-1 shrink-0">
              <Terminal size={10} className="text-slate-500" />
              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest font-bold">Live Stream logs</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col justify-end">
              {logs.map((log, i) => (
                <div key={log + i} className={`text-[10px] font-mono whitespace-nowrap truncate ${i === logs.length - 1 ? 'text-blue-400 font-bold' : 'text-slate-600'}`}>
                  <span className="mr-1">&gt;</span>{log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>
      </div>

    </motion.div>
  );
};

export default PremiumEnterpriseLoader;
