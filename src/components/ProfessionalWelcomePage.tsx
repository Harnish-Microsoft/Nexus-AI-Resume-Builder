import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AINeuralNetworkBackground } from './AINeuralNetworkBackground';
import { 
  ArrowRight, 
  BarChart3, 
  CheckCircle2, 
  FileText, 
  Key, 
  Lock, 
  LogIn, 
  Mail, 
  Moon, 
  ShieldCheck, 
  Sparkles, 
  Sun, 
  Target, 
  UserPlus, 
  Cpu, 
  Zap, 
  Layers, 
  Activity, 
  Terminal, 
  TrendingUp, 
  Award, 
  ArrowUpRight, 
  Compass, 
  Play, 
  LayoutDashboard, 
  Workflow, 
  Binary, 
  Eye, 
  Briefcase,
  Layers2,
  CpuIcon,
  RefreshCw,
  Sparkle,
  X,
  LockKeyhole,
  Check,
  AlertTriangle
} from 'lucide-react';

interface ProfessionalWelcomePageProps {
  onLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  externalError?: string | null;
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

// NeuralNetworkBackground is now replaced with interactive AINeuralNetworkBackground

export function ProfessionalWelcomePage({
  onLogin,
  onEmailLogin,
  onEmailSignUp,
  onPasswordReset,
  externalError,
  isDarkMode,
  setIsDarkMode,
}: ProfessionalWelcomePageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for Cinematic Orchestration Loop
  const [activeCinematicStep, setActiveCinematicStep] = useState<number>(0);
  const [activeAgentIdx, setActiveAgentIdx] = useState<number>(0);
  const [masterResumesScores, setMasterResumesScores] = useState<number[]>([25, 41, 55, 33, 49]);
  const [selectedMasterIdx, setSelectedMasterIdx] = useState<number | null>(null);
  const [dnaActiveNode, setDnaActiveNode] = useState<number>(0);
  const [dashboardATSScore, setDashboardATSScore] = useState<number>(62);
  const [dashboardKeywordMatch, setDashboardKeywordMatch] = useState<number>(58);
  const [dashboardSkillsMatch, setDashboardSkillsMatch] = useState<number>(73);

  // Stats Counters
  const [resumesCount, setResumesCount] = useState(0);
  const [atsImprovement, setAtsImprovement] = useState(0);
  const [readinessScore, setReadinessScore] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(0);

  // Technical Log Monitor Ticker
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'SYSTEM: Initialize Career Intelligence Engine',
    'DAEMON: Awaiting master bind profiles...'
  ]);

  // List of Orbiting Agents
  const agents = [
    { name: 'ATS Agent', role: 'Syntax Parsing & Structuring' },
    { name: 'Keyword Agent', role: 'Semantics & Synonyms' },
    { name: 'Skills Agent', role: 'Syllabus Alignment' },
    { name: 'Experience Agent', role: 'Chronological Density' },
    { name: 'Leadership Agent', role: 'Impact Escalation' },
    { name: 'Career Intelligence Agent', role: 'Role Projections' },
    { name: 'Achievement Agent', role: 'Quantitative Enhancements' },
    { name: 'Formatting Agent', role: 'A4 Page Boundaries' }
  ];

  // Pipeline nodes
  const pipelineNodes = [
    { label: 'Job Description', id: 'jd' },
    { label: 'Resume Scanner', id: 'scan' },
    { label: 'Semantic Analysis Engine', id: 'semantic' },
    { label: 'Skills Intelligence Service', id: 'skills' },
    { label: 'Experience Mapping Engine', id: 'experience' },
    { label: 'ATS Optimization Engine', id: 'ats' },
    { label: 'Resume Selection Engine', id: 'selector' },
    { label: 'Resume DNA Reconstruction', id: 'dna' },
    { label: 'Final Resume Generator', id: 'final' }
  ];

  // DNA Transformation structures
  const dnaNodes = [
    { name: 'Skills', raw: '“Knows backend servers, Javascript, AWS”', upgraded: '“Architected high-throughput cloud stacks on AWS (99.99% availability)”' },
    { name: 'Experience', raw: '“Responsible for maintaining standard codebases”', upgraded: '“Spearheaded refactoring of core engine; minimized container CPU footprint by 38%”' },
    { name: 'Achievements', raw: '“Assisted the division with quarterly budgets”', upgraded: '“Governed a $1.2M infrastructural portfolio; realized 22% fiscal optimization”' },
    { name: 'Certifications', raw: '“Certified in standard Kubernetes formats”', upgraded: '“Certified Kubernetes Administrator (CKA #28471) | Active Core Agent”' },
    { name: 'Leadership', raw: '“Helped hire and train junior software developers”', upgraded: '“Mentored 6 engineering interns; accelerated operational onboarding timeline by 45%”' },
    { name: 'Business Impact', raw: '“Wrote features that helped increase total sales”', upgraded: '“Engineered retention system triggering $450K expansion ARR in Q3”' },
    { name: 'Technical Expertise', raw: '“Familiar with database queries and relational schemas”', upgraded: '“Engineered enterprise PostgreSQL shards boosting transaction speed by 3x”' },
  ];

  // Sync external error with state to display inside auth forms
  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  // Orbiting Agent active indicator loop
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgentIdx(prev => (prev + 1) % agents.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Cinematic Orchestration Loop
  // Stage 0: Scanning 5 Master Resumes
  // Stage 1: Resume #3 selected (goes green) & moves to optimization
  // Stage 2: DNS Reconstruction activates (helix rotators, step-by-step changes)
  // Stage 3: LIVE Dashboard powers up demonstrating upgraded stats
  // Stage 4: Loop restarts
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCinematicStep(prev => {
        const next = (prev + 1) % 4;
        
        // Reset scores and index when loop goes back to scanning
        if (next === 0) {
          setMasterResumesScores([25, 41, 55, 33, 49]);
          setSelectedMasterIdx(null);
          setDashboardATSScore(62);
          setDashboardKeywordMatch(58);
          setDashboardSkillsMatch(73);
          setDnaActiveNode(0);
        }

        return next;
      });
    }, 12000); // 12 seconds per major narrative visual sequence

    return () => clearInterval(timer);
  }, []);

  // Cinematic Sub-transitions inside stages
  useEffect(() => {
    if (activeCinematicStep === 0) {
      // Simulate real-time scanning counter increment
      const scanTimer = setInterval(() => {
        setMasterResumesScores(prev => {
          const updated = [...prev];
          if (updated[0] < 72) updated[0] += 5;
          if (updated[1] < 81) updated[1] += 4;
          if (updated[2] < 94) updated[2] += 6;
          if (updated[3] < 76) updated[3] += 5;
          if (updated[4] < 88) updated[4] += 5;
          return updated.map((val, idx) => {
            const max = [72, 81, 94, 76, 88][idx];
            return Math.min(max, val);
          });
        });
      }, 200);

      const triggerSelectTimer = setTimeout(() => {
        setSelectedMasterIdx(2); // Best candidate is Master Resume #3
      }, 3500);

      return () => {
        clearInterval(scanTimer);
        clearTimeout(triggerSelectTimer);
      };
    }

    if (activeCinematicStep === 2) {
      // Rotate active DNA ladder node and demonstrate upgraded code strings
      const dnaTimer = setInterval(() => {
        setDnaActiveNode(prev => (prev + 1) % dnaNodes.length);
      }, 1500);
      return () => clearInterval(dnaTimer);
    }

    if (activeCinematicStep === 3) {
      // Slowly rise dashboard scores to demonstration metrics
      const dashTimer = setInterval(() => {
        setDashboardATSScore(prev => Math.min(96, prev + 1));
        setDashboardKeywordMatch(prev => Math.min(92, prev + 1));
        setDashboardSkillsMatch(prev => Math.min(95, prev + 1));
      }, 50);
      return () => clearInterval(dashTimer);
    }
  }, [activeCinematicStep]);

  // Load animated counters for trust stats section
  useEffect(() => {
    const duration = 2000; // ms
    const frames = 60;
    const stepTime = duration / frames;
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      setResumesCount(Math.min(50000, Math.floor((50000 / frames) * frame)));
      setAtsImprovement(Math.min(95, Math.floor((95 / frames) * frame)));
      setReadinessScore(Math.min(90, Math.floor((90 / frames) * frame)));
      setSpeedMultiplier(Math.min(10, Math.floor((10 / frames) * frame)));

      if (frame === frames) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, []);

  // Live Console Log pipeline stream
  useEffect(() => {
    const systemEvents = [
      'Handshake: Mapping vector space representation from active JD',
      'Telemetry: Scanned Master Resume #1 index 72% success threshold',
      'Telemetry: Scanned Master Resume #2 index 81% success threshold',
      'Telemetry: Scanned Master Resume #3 index 94% SUCCESS TARGET BOUND',
      'Pipeline: Routing active node #3 into Chamber-01 DNA reconstructor',
      'Agent: ATS Compliance scanner parsed 18 header positioning nodes',
      'Agent: Keyword synonym system injecting [orchestration, cloud stack]',
      'Agent: Formatting boundaries optimized. Multi-page overflow truncated',
      'Core: Output generated. Compiling secure signed PDF format...',
      'System: Ready. Awaiting trigger signal.'
    ];

    let logCounter = 0;
    const logInterval = setInterval(() => {
      setConsoleLogs(prev => {
        const next = [...prev, `[${new Date().toLocaleTimeString()}] ${systemEvents[logCounter % systemEvents.length]}`];
        if (next.length > 5) next.shift();
        return next;
      });
      logCounter++;
    }, 3000);

    return () => clearInterval(logInterval);
  }, []);

  // Handle email authenticator submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (authView === 'login') {
        await onEmailLogin(email, password);
      } else if (authView === 'signup') {
        await onEmailSignUp(email, password);
      } else if (authView === 'forgot') {
        await onPasswordReset(email);
        setError('A secure restore code has been sent to your email.');
        setTimeout(() => setAuthView('login'), 3500);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#03060b] text-[#f1f5f9] font-sans overflow-x-hidden relative select-none">
      {/* Premium Visual Overlay effects */}
      <div className="absolute inset-x-0 top-0 h-[800px] bg-gradient-to-b from-blue-950/15 via-teal-950/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-bl from-teal-500/5 to-emerald-500/5 rounded-full filter blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/5 to-blue-500/5 rounded-full filter blur-[120px] pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:5rem_5rem] pointer-events-none -z-10" />

      {/* Dynamic Animated Node Network */}
      <AINeuralNetworkBackground isDarkMode={isDarkMode} opacity={0.3} />

      {/* SYSTEM HEADER BAR */}
      <header className="sticky top-0 w-full z-40 backdrop-blur-xl border-b border-white/5 bg-[#03060b]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-blue-500/30 border border-emerald-500/35 flex items-center justify-center relative overflow-hidden group">
              <Sparkles className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-wider uppercase text-white flex items-center gap-1.5">
                NEXUS AI <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold tracking-normal">OPERATING SYSTEM v4.3</span>
              </p>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">COGNITIVE CAREER INFRASTRUCTURE</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/40 border border-white/5 rounded-full text-[10px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>SECURED CLOUD DIRECTORY SYNC</span>
            </div>
            
            <button
              onClick={() => {
                setAuthView('login');
                setShowAuthModal(true);
              }}
              className="px-4 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthView('signup');
                setShowAuthModal(true);
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Access System
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 sm:pt-16 sm:pb-32 lg:pt-24 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Hero text */}
          <div className="space-y-6 text-left lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 text-[11px] font-bold tracking-wider uppercase font-mono shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              Enterprise-Grade Multi-Agent Alignment Scaffold
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Transform Any Resume Into An <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400">ATS-Optimized</span> Career Asset
            </h1>
            
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Upload a Job Description and let AI identify, analyze, optimize, and reconstruct the strongest version of your professional profile. Automated matching across multiple resumes in milliseconds.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => {
                  setAuthView('signup');
                  setShowAuthModal(true);
                }}
                className="group flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
              >
                <span>Start Optimization</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => {
                  const el = document.getElementById('command-center-console');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white text-white" />
                <span>See How It Works</span>
              </button>
            </div>

            <div className="pt-4 flex items-center gap-6 text-[11px] font-mono text-slate-400 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span>MULTIPLE ARCHITECTURE: PROD</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                <span>8 DEDICATED AGENTS ONLINE</span>
              </div>
            </div>
          </div>

          {/* Hero right: Dynamic Visualizer showcasing changing phases */}
          <div className="lg:col-span-6 relative w-full">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-3xl filter blur-2xl pointer-events-none -z-10 translate-x-4 translate-y-4" />
            
            <div className="bg-[#080d1a] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              {/* Window header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-[10px] text-slate-400 font-mono ml-2">cognitive_handshake_matrix.system</span>
                </div>
                <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono rounded select-none">
                  STAGE {activeCinematicStep + 1} / 4
                </div>
              </div>

              {/* Dynamic Slides based on Cinematic Step */}
              <div className="min-h-[300px] flex flex-col justify-between">
                <AnimatePresence mode="wait">
                  {/* STAGE 1: SCANNING ALL FIVE MASTER RESUMES */}
                  {activeCinematicStep === 0 && (
                    <motion.div
                      key="cinematic-scan"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 flex-grow flex flex-col justify-center"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] font-mono flex items-center gap-1.5 mb-2">
                        <Activity className="w-4 h-4 text-emerald-400" /> Phase 1: Scanning Master Resume Directory
                      </h4>

                      <div className="space-y-3">
                        {masterResumesScores.map((score, index) => {
                          const isSelected = selectedMasterIdx === index;
                          return (
                            <div 
                              key={index} 
                              className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                                isSelected 
                                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-md shadow-emerald-500/5' 
                                  : 'bg-black/20 border-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">Master Resume #{index + 1}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {index === 2 ? 'Cloud Architect Variant' : `Career Profile Format v${index}.2`}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] text-slate-500 font-mono uppercase">ATS Alignment</p>
                                  <p className={`text-sm font-extrabold font-mono ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                                    {score}%
                                  </p>
                                </div>
                                {isSelected && (
                                  <div className="h-5 px-1.5 bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 text-[8px] font-mono rounded flex items-center justify-center font-bold uppercase tracking-wider animate-pulse">
                                    SELECTED Candidate
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* STAGE 2: THE AI RESUME COMMAND CENTER (Orbiting Agents scan Selected Cand) */}
                  {activeCinematicStep === 1 && (
                    <motion.div
                      key="cinematic-agents"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 flex-grow flex flex-col justify-between"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] font-mono flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} /> Phase 2: AI Resume Command Center Active
                      </h4>

                      <div className="flex flex-col items-center justify-center py-6 relative">
                        {/* Central Resume Node */}
                        <div className="relative z-10 w-36 h-20 bg-gradient-to-br from-[#111e35] to-[#0d1627] border border-white/10 rounded-xl p-3 flex flex-col justify-between shadow-xl">
                          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                            <span className="text-[9px] font-mono text-emerald-400 font-bold">Selected Resume #3</span>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          </div>
                          <div className="space-y-1">
                            <div className="w-16 h-1 bg-white/20 rounded" />
                            <div className="w-20 h-1 bg-white/10 rounded" />
                            <div className="w-12 h-1 bg-white/10 rounded" />
                          </div>
                          <div className="text-[8px] font-mono text-slate-500 text-right">OPTIMIZATION READY</div>
                        </div>

                        {/* Orbiting Agent display card below */}
                        <div className="mt-8 w-full max-w-sm p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center animate-pulse">
                              <Sparkles className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{agents[activeAgentIdx].name}</p>
                              <p className="text-[10px] text-slate-400">{agents[activeAgentIdx].role}</p>
                            </div>
                          </div>
                          
                          <div className="h-5 px-2 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-[9px] font-mono rounded flex items-center font-bold">
                            ⬤ RUNNING
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STAGE 3: RESUME DNA RECONSTRUCTION */}
                  {activeCinematicStep === 2 && (
                    <motion.div
                      key="cinematic-dna"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 flex-grow flex flex-col justify-between"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] font-mono flex items-center gap-1.5">
                        <Binary className="w-4 h-4 text-purple-400" /> Phase 3: Resume DNA Reconstruction
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        {/* Upgrading String Panel */}
                        <div className="space-y-2">
                          <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg text-left">
                            <span className="text-[8px] font-mono text-red-400 block tracking-wider uppercase font-bold mb-1">RAW SUBMISSION</span>
                            <p className="text-[10px] text-slate-300 italic">
                              {dnaNodes[dnaActiveNode].raw}
                            </p>
                          </div>
                          
                          <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg text-left">
                            <span className="text-[8px] font-mono text-emerald-400 block tracking-wider uppercase font-bold mb-1">RECONSTRUCTED DNA METRIC</span>
                            <p className="text-[10px] text-emerald-300 font-bold leading-normal">
                              {dnaNodes[dnaActiveNode].upgraded}
                            </p>
                          </div>
                        </div>

                        {/* Visual Double Helix Side representation */}
                        <div className="h-40 relative flex flex-col justify-between p-3 border border-white/5 rounded-xl bg-black/20">
                          <span className="text-[8px] font-mono text-slate-500 tracking-widest uppercase block border-b border-white/5 pb-1">DNA Strand Status</span>
                          <div className="space-y-1.5 flex-grow flex flex-col justify-center">
                            {dnaNodes.map((node, nIdx) => {
                              const isActive = dnaActiveNode === nIdx;
                              return (
                                <div key={nIdx} className="flex items-center justify-between text-[9px] font-mono">
                                  <span className={isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                    {isActive ? '▶' : ' '}{node.name}
                                  </span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4].map(pt => (
                                      <span 
                                        key={pt} 
                                        className={`w-1 h-2 rounded-sm ${
                                          isActive 
                                            ? 'bg-emerald-400 animate-pulse' 
                                            : nIdx < dnaActiveNode 
                                              ? 'bg-cyan-500/60' 
                                              : 'bg-white/5'
                                        }`} 
                                        style={{ animationDelay: `${pt * 150}ms` }} 
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* STAGE 4: LIVE ATS DASHBOARD UPDATES */}
                  {activeCinematicStep === 3 && (
                    <motion.div
                      key="cinematic-dashboard"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 flex-grow flex flex-col justify-between"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] font-mono flex items-center gap-1.5 mb-2">
                        <LayoutDashboard className="w-4 h-4 text-blue-400" /> Phase 4: Dynamic ATS Scoring Complete
                      </h4>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'ATS score', value: `${dashboardATSScore}%`, color: 'text-emerald-400', pct: dashboardATSScore },
                          { label: 'Keyword match', value: `${dashboardKeywordMatch}%`, color: 'text-cyan-400', pct: dashboardKeywordMatch },
                          { label: 'Skills alignment', value: `${dashboardSkillsMatch}%`, color: 'text-blue-400', pct: dashboardSkillsMatch }
                        ].map((stat, index) => (
                          <div key={index} className="bg-black/30 border border-white/5 rounded-xl p-4 text-center space-y-2 flex flex-col justify-between">
                            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest leading-none">{stat.label}</span>
                            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                              {/* mini circular gauge */}
                              <svg className="w-full h-full transform -rotate-90">
                                <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.02)" strokeWidth="4" fill="transparent" />
                                <circle 
                                  cx="32" cy="32" r="26" 
                                  stroke={index === 0 ? '#10b981' : index === 1 ? '#06b6d4' : '#3b82f6'} 
                                  strokeWidth="4" fill="transparent" 
                                  strokeDasharray="163.3" 
                                  strokeDashoffset={163.3 - (163.3 * stat.pct) / 100}
                                  className="transition-all duration-300"
                                />
                              </svg>
                              <span className="absolute text-xs font-extrabold text-white font-mono">{stat.value}</span>
                            </div>
                            <span className="text-[8px] text-emerald-400 font-mono tracking-widest uppercase">Verified</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Console footer logs inside sandbox */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 font-mono text-[9px] text-slate-400 mt-4 text-left">
                  <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>STREAMS_DAEMON_LOGS_PROD</span>
                  </div>
                  <div className="space-y-1">
                    {consoleLogs.slice(-3).map((log, idx) => (
                      <div key={idx} className="truncate">
                        <span className="text-emerald-500 mr-1">&gt;</span>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* TRUST SECTION WITH METRICS ANIMATED */}
      <section className="border-y border-white/5 bg-[#050912] select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {[
              { 
                value: resumesCount === 50000 ? '50,000+' : resumesCount.toLocaleString() + '+', 
                label: 'Resumes Optimized', 
                subtitle: 'Automated match profiles built' 
              },
              { 
                value: atsImprovement === 95 ? '95%' : atsImprovement + '%', 
                label: 'Average ATS Improvement', 
                subtitle: 'Pass rate surge reported' 
              },
              { 
                value: readinessScore === 90 ? '90%' : readinessScore + '%', 
                label: 'Interview Readiness Score', 
                subtitle: 'Evaluated by recruiters' 
              },
              { 
                value: speedMultiplier === 10 ? '10x' : speedMultiplier + 'x', 
                label: 'Faster Customization', 
                subtitle: 'Reconstructed in milliseconds' 
              },
            ].map((stat, i) => (
              <div key={i} className="space-y-1 text-center md:text-left">
                <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight font-mono">
                  {stat.value}
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">{stat.label}</p>
                <p className="text-[10px] text-slate-400 leading-normal">{stat.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPACT DETAILED CENTERPIECE EXPLANATORY PANEL */}
      <section id="command-center-console" className="py-20 sm:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <span className="px-3 py-1 rounded-full border border-blue-500/20 bg-blue-950/20 text-blue-400 text-[10px] font-bold tracking-wider uppercase font-mono">
              AI Command Portal
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none">
              The AI Resume Command Center Experience
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
              Behind our optimization chamber lies a multi-cognitive network. Eight specialized algorithmic agents work in sync to construct elite-grade, recruiter-approved formats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              {
                title: 'Resume Intelligence Scan',
                desc: 'Analyzes all loaded master variants immediately, pinpointing target skills and experience segments.',
                icon: FileText,
                glow: 'hover:border-emerald-500/30 hover:shadow-emerald-500/5',
                color: 'bg-emerald-400'
              },
              {
                title: 'Keyword Intelligence',
                desc: 'Identifies core recruiters and ATS search term criteria within job descriptions and fits synonyms.',
                icon: Binary,
                glow: 'hover:border-cyan-500/30 hover:shadow-cyan-500/5',
                color: 'bg-cyan-400'
              },
              {
                title: 'Experience Alignment',
                desc: 'Aligns chronological history structures against exact requirements, deleting unneeded semantic noise.',
                icon: Target,
                glow: 'hover:border-blue-500/30 hover:shadow-blue-500/5',
                color: 'bg-blue-400'
              },
              {
                title: 'Achievement Enhancement',
                desc: 'Drives quantitative numbers and metrics out of passive statements to show robust business outcomes.',
                icon: TrendingUp,
                glow: 'hover:border-purple-500/30 hover:shadow-purple-500/5',
                color: 'bg-purple-400'
              },
              {
                title: 'ATS Optimization Core',
                desc: 'Configures styling boundaries, margins, margins, and standard parsed layout markings for clean imports.',
                icon: ShieldCheck,
                glow: 'hover:border-teal-500/30 hover:shadow-teal-500/5',
                color: 'bg-teal-400'
              },
              {
                title: 'Executive Branding',
                desc: 'Synthesizes summaries, active tags, and headlines to ensure authority right under the recruiter scan.',
                icon: Award,
                glow: 'hover:border-rose-500/30 hover:shadow-rose-500/5',
                color: 'bg-rose-400'
              },
              {
                title: 'Certification Extraction',
                desc: 'Parses credential codes, ensuring official license metrics are categorized properly inside templates.',
                icon: Sparkle,
                glow: 'hover:border-amber-500/30 hover:shadow-amber-500/5',
                color: 'bg-amber-400'
              },
              {
                title: 'Role Projection Alignment',
                desc: 'Scrapes structural target titles, adjusting tone parameters for automatic alignment to high-tier positions.',
                icon: Compass,
                glow: 'hover:border-red-500/30 hover:shadow-red-500/5',
                color: 'bg-red-400'
              }
            ].map((card, idx) => (
              <div 
                key={idx} 
                className={`bg-[#080d1a] border border-white/5 rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-1 select-none flex flex-col justify-between group ${card.glow}`}
              >
                <div className="space-y-4">
                  <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-colors">
                    <card.icon className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  </div>
                  
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">{card.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500 font-bold uppercase">
                  <span>DEPLOYED ON AGENT-NET</span>
                  <div className={`h-1.5 w-1.5 rounded-full ${card.color} animate-pulse`} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CLOUD ARCHITECTURE WORKFLOW PIPELINE */}
      <section className="py-20 sm:py-28 border-t border-white/5 bg-[#050912] select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <span className="px-3 py-1 rounded-full border border-teal-500/20 bg-teal-950/20 text-teal-400 text-[10px] font-bold tracking-wider uppercase font-mono">
              Workspace Flowchart
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none">
              Holographic Cloud Architecture Pipeline
            </h2>
            <p className="text-sm text-slate-400 leading-normal">
              Seamless pipeline journey that tracks data structures as they move from raw inputs to finalized career documents.
            </p>
          </div>

          <div className="bg-[#080d1a] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
            {/* Staggered flow layout with connections */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-4 text-center items-center relative z-10">
              {pipelineNodes.map((pNode, index) => {
                const isActive = index <= activeCinematicStep * 2;
                return (
                  <div key={pNode.id} className="flex flex-col items-center justify-center space-y-3 relative group">
                    {/* Node Core circle */}
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                      isActive 
                        ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-emerald-400 text-emerald-400 shadow-md shadow-emerald-500/10' 
                        : 'bg-white/5 border-white/5 text-slate-500'
                    }`}>
                      <span className="text-xs font-mono font-bold">{index + 1}</span>
                    </div>

                    <p className={`text-[10px] font-medium leading-tight max-w-[85px] transition-colors duration-500 ${
                      isActive ? 'text-white font-bold' : 'text-slate-500'
                    }`}>
                      {pNode.label}
                    </p>

                    {/* Connecting Chevron on right (for desktop) */}
                    {index < pipelineNodes.length - 1 && (
                      <div className="hidden lg:block absolute top-[14px] -right-[15%] text-slate-700 pointer-events-none text-xs">
                        {isActive ? (
                          <span className="text-emerald-400 animate-pulse">→</span>
                        ) : '→'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Simulated background energy waves */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.03),transparent_70%)] pointer-events-none" />
          </div>

        </div>
      </section>

      {/* FINAL INTERACTIVE TRANSFORMATION DNA CHAMBER */}
      <section className="py-20 sm:py-28 relative border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="px-3 py-1 rounded-full border border-purple-500/20 bg-purple-950/20 text-purple-400 text-[10.5px] font-bold tracking-wider uppercase font-mono">
            Core Transformation Sandbox
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-none">
            Interactive Resume DNA Reconstruction
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Witness our multi-layered transformation framework taking weak standard bullet points and instantly generating enterprise SaaS impact metrics.
          </p>

          <div className="bg-[#080d1a] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl max-w-3xl mx-auto text-left relative overflow-hidden mt-8">
            <div className="absolute top-2 right-2 flex gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-mono text-slate-500 uppercase">SYS_STABLE</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-6">
              {/* Step A: Raw Resume */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 text-red-400">
                  <X className="w-4 h-4" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#94a3b8]">Weak Bullet Point</span>
                </div>
                <p className="text-xs text-slate-300 italic p-3 bg-red-950/15 border border-red-500/10 rounded-lg min-h-[60px] flex items-center justify-start leading-relaxed">
                  {dnaNodes[dnaActiveNode].raw}
                </p>
              </div>

              {/* Step B: The AI Alignment Node */}
              <div className="flex flex-col items-center col-span-1 py-4 justify-center text-center">
                <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }}>
                  <Binary className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-mono text-[#10b981] font-bold tracking-widest mt-2 uppercase animate-pulse">UPGRADING</span>
              </div>

              {/* Step C: Optimized Resume */}
              <div className="bg-[#0b172a] border border-emerald-500/20 rounded-xl p-4 space-y-2 col-span-1 md:col-span-2 shadow-lg shadow-emerald-500/5">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Upgraded Career Segment</span>
                </div>
                <p className="text-xs text-emerald-300 font-bold p-3 bg-emerald-950/15 border border-emerald-500/20 rounded-lg min-h-[60px] flex items-center justify-start leading-relaxed">
                  {dnaNodes[dnaActiveNode].upgraded}
                </p>
              </div>
            </div>

            {/* Slider Dots */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {dnaNodes.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  onClick={() => setDnaActiveNode(dotIdx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${dnaActiveNode === dotIdx ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/10 hover:bg-white/20'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CALL-TO-ACTION EXECUTIVE PANEL */}
      <section className="py-20 sm:py-32 relative border-t border-white/5 overflow-hidden bg-[#03060b]">
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/10 to-transparent pointer-events-none -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-emerald-500/5 to-cyan-500/5 rounded-full filter blur-[150px] pointer-events-none -z-10 animate-pulse" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <span className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-950/30 text-emerald-400 text-[10.5px] font-bold tracking-wider uppercase font-mono">
            Secure Platform Gateway
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-none">
            Ready To Build Your Strongest Resume?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Unlock the premier cognitive optimization engine, align multiple master resumes in microseconds, and secure your tech-market authority now.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setAuthView('signup');
                setShowAuthModal(true);
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Launch AI Optimization
            </button>
            <button
              onClick={() => {
                setAuthView('login');
                setShowAuthModal(true);
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
            >
              Sign In To Account
            </button>
          </div>

          <p className="text-[11px] font-mono text-slate-500 pt-6">
            Compliant with Recruiter ATS machine regulations | SOC2 Security Standard Guaranteed
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#030509] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white leading-none">NEXUS AI SYSTEMS</p>
              <span className="text-[9px] text-[#475569] font-mono">WORKSPACE COGNITION SYSTEM LICENSE</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-[11px] font-mono text-slate-500">
            <span className="hover:text-white cursor-pointer transition-colors">Privacy policy</span>
            <span className="hover:text-white cursor-pointer transition-colors">SOC2 status</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terms of service</span>
            <span className="hover:text-white cursor-pointer transition-colors">License info</span>
          </div>

          <p className="text-[10px] font-mono text-slate-600">
            &copy; {new Date().getFullYear()} Nexus AI Core Technologies inc. All rights reserved.
          </p>
        </div>
      </footer>

      {/* STUNNING AUTHMODAL SYSTEM OVERLAY */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark glass backdrop layout */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Glowing auth container dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-[#080c16] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Radial gradient shine back boundary */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full filter blur-xl pointer-events-none" />

              {/* Close Button overlay */}
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-6">
                
                {/* Auth Logo visual */}
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center rounded-lg">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">SECURE PLATFORM BRIDGE</h3>
                    <p className="text-[9px] font-mono text-slate-400 leading-none">COGNITIVE VERIFICATION CONTROL</p>
                  </div>
                </div>

                <div className="border-b border-white/5 pb-1">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {authView === 'login' ? 'Welcome Back Officer' : authView === 'signup' ? 'Deploy New Core Seat' : 'Recover Access Sequence'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    {authView === 'login' 
                      ? 'Rebind authentication tokens to load secure cloud datasets.' 
                      : authView === 'signup' 
                        ? 'Boot up an encrypted candidate workspace seat instantly.' 
                        : 'Dispatch security bypass metrics directly to backup inbox.'
                    }
                  </p>
                </div>

                {/* Error Banner inside modal */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Auth Form submission */}
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Core Workspace Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. recruit_lead@company.com"
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {authView !== 'forgot' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <LockKeyhole className="w-3.5 h-3.5" /> Security Password Key
                        </label>
                        {authView === 'login' && (
                          <button
                            type="button"
                            onClick={() => setAuthView('forgot')}
                            className="text-[9px] font-mono text-slate-500 hover:text-white transition-colors cursor-pointer"
                          >
                            Bypass Password?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{authView === 'login' ? 'Verify Code Keys' : authView === 'signup' ? 'Initiate Seat Deployment' : 'Dispatch Recovery Bypass'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Third-party authenticators boundary */}
                <div className="text-center relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5" />
                  </div>
                  <span className="relative px-3 bg-[#080c16] text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                    OR DEPLOY PLATFORM BRIDGE
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onLogin();
                    setShowAuthModal(false);
                  }}
                  className="w-full py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/20 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 text-white"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Authenticate with Google Cloud Secure ID</span>
                </button>

                {/* Switch between modes link */}
                <div className="text-center pt-2">
                  {authView === 'login' ? (
                    <p className="text-[11px] text-slate-400">
                      Need a dedicated candidate profile seat?{' '}
                      <button
                        onClick={() => setAuthView('signup')}
                        className="text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Initiate Free Trial
                      </button>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Already have verified workspace tokens?{' '}
                      <button
                        onClick={() => setAuthView('login')}
                        className="text-emerald-400 hover:underline font-bold cursor-pointer"
                      >
                        Acquire Connection Portal
                      </button>
                    </p>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
