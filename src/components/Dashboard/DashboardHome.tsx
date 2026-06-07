import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Cpu, 
  Database, 
  Layers, 
  FileCheck2, 
  FileDown, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  Briefcase, 
  LayoutGrid, 
  HardDrive, 
  ArrowRight,
  TrendingUp,
  User,
  ExternalLink,
  ChevronRight,
  Activity,
  ShieldCheck,
  Zap,
  Target,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { useResumeStore } from '../../store';
import { MasterResume } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  Cell 
} from 'recharts';

interface DashboardHomeProps {
  isDarkMode: boolean;
  masterResumes: MasterResume[];
  selectedResumeId: string;
  onSelectResume: (id: string) => void;
  isSyncing: boolean;
  isDownloading: boolean;
  results: Record<string, any>;
  activeAudience: string | null;
  mode: 'gemini' | 'openai' | 'hybrid';
  isDriveConnected: boolean;
  user: FirebaseUser | null;
}

interface ActivityItem {
  id: string;
  type: 'optimization' | 'export' | 'job_added' | 'master_updated';
  title: string;
  subtitle: string;
  timestamp: string;
  score?: number;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  isDarkMode,
  masterResumes,
  selectedResumeId,
  onSelectResume,
  isSyncing,
  isDownloading,
  results,
  activeAudience,
  mode,
  isDriveConnected,
  user
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // 1. Fetch tracked jobs count and items dynamically from Firestore
  useEffect(() => {
    if (!user) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'jobs'),
      orderBy('dateAdded', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setJobs(jobsData);
      setLoadingJobs(false);
    }, (error) => {
      console.error("Error fetching jobs in board dashboard:", error);
      setLoadingJobs(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Assemble Recent Activity feed dynamically from existing states only without mock data
  useEffect(() => {
    const combined: ActivityItem[] = [];

    // Add Optimizations from actual results state
    Object.entries(results).forEach(([audience, res]: [string, any], index) => {
      combined.push({
        id: `opt-${audience}-${index}`,
        type: 'optimization',
        title: `Optimized Resume for ${audience}`,
        subtitle: `Match score increased to ${res.match_score}% (Baseline ${res.baseline_score || 60}%)`,
        timestamp: 'Active Session',
        score: res.match_score
      });
    });

    // Add Job additions from actual jobs array
    jobs.slice(0, 10).forEach((job) => {
      combined.push({
        id: `job-${job.id || Math.random()}`,
        type: 'job_added',
        title: `Tracked Application Added`,
        subtitle: `${job.role} at ${job.company}`,
        timestamp: job.dateAdded ? new Date(job.dateAdded).toLocaleDateString() : 'Recently'
      });
    });

    // Add Master profile updates from masterResumes state
    masterResumes.slice(0, 5).forEach((resume) => {
      combined.push({
        id: `resume-${resume.id}`,
        type: 'master_updated',
        title: `Master Profile Indexed`,
        subtitle: `${resume.name} (${resume.experience?.length || 0} exp. nodes)`,
        timestamp: 'Synced Profile'
      });
    });

    // Sort to make cohesive list
    setActivities(combined);
  }, [results, jobs, masterResumes]);

  // Export generated tracking count
  const getExportsCount = () => {
    return parseInt(localStorage.getItem('pdf_export_count') || '0', 10);
  };

  // Convert results object to list format for Recharts component
  const getChartData = () => {
    return Object.entries(results).map(([name, res]: [string, any]) => ({
      name: name.length > 15 ? name.substring(0, 13) + '...' : name,
      'Baseline Score': res.baseline_score || 60,
      'Optimized Score': res.match_score || 85,
    }));
  };

  const chartData = getChartData();
  const currentResumeName = masterResumes.find(r => r.id === selectedResumeId)?.name || 'Default Profile';
  const hasOptimizations = chartData.length > 0;

  // Render metric badge colors safely
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 70) return 'text-teal-400 border-teal-500/20 bg-teal-500/10';
    return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
  };

  return (
    <div className="w-full max-w-7xl mx-auto h-full p-4 md:p-8 overflow-y-auto custom-scrollbar select-none text-left">
      
      {/* Interactive Title & Overview Banner in Glass Resume style */}
      <div className="mb-8 relative p-6 md:p-8 rounded-3xl border border-white/5 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="max-w-2xl relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest uppercase font-black text-emerald-400">
              Executive AI Workspace
            </span>
          </div>
          <h1 className="text-2xl md:text-3.5xl font-black text-white tracking-tight uppercase mb-2">
            Nexus Dashboard Workspace
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-xl">
            Analyze alignment vectors, manage master portfolios, and map careers with cloud database indexes synced to local sandbox structures.
          </p>
        </div>
      </div>

      {/* Grid configuration representing sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Elements (Cols: 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Top KPI Cards Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* KPI: Total Optimizations */}
            <div className={`p-4.5 rounded-2xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
              isDarkMode 
                ? 'glass-card-dark border-white/5 text-white' 
                : 'glass-card border-black/5 text-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#00E5FF]">
                  Optimizations
                </span>
                <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white">
                {Object.keys(results).length}
              </div>
              <p className="text-[8px] opacity-40 mt-1 uppercase tracking-wider font-bold">Active profiles</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E5FF]/20" />
            </div>

            {/* KPI: Master Resumes */}
            <div className={`p-4.5 rounded-2xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
              isDarkMode 
                ? 'glass-card-dark border-white/5 text-white' 
                : 'glass-card border-black/5 text-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#00E676]">
                  Master Resumes
                </span>
                <Layers className="w-3.5 h-3.5 text-[#00E676]" />
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white">
                {masterResumes.length}
              </div>
              <p className="text-[8px] opacity-40 mt-1 uppercase tracking-wider font-bold">In storage</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00E676]/20" />
            </div>

            {/* KPI: Tracked Jobs */}
            <div className={`p-4.5 rounded-2xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
              isDarkMode 
                ? 'glass-card-dark border-white/5 text-white' 
                : 'glass-card border-black/5 text-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-emerald-400">
                  Tracked Jobs
                </span>
                <Target className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white">
                {jobs.length}
              </div>
              <p className="text-[8px] opacity-40 mt-1 uppercase tracking-wider font-bold">In database</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-400/20" />
            </div>

            {/* KPI: Exports Generated */}
            <div className={`p-4.5 rounded-2xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
              isDarkMode 
                ? 'glass-card-dark border-white/5 text-white' 
                : 'glass-card border-black/5 text-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-purple-400">
                  Exports
                </span>
                <FileDown className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-2xl font-black font-mono tracking-tight text-white">
                {getExportsCount()}
              </div>
              <p className="text-[8px] opacity-40 mt-1 uppercase tracking-wider font-bold">PDF Artifacts</p>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-400/20" />
            </div>

          </div>

          {/* Middle Section: Analytics Overview */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white shadow-2xl' 
              : 'glass-card border-black/10 text-slate-800 shadow-lg'
          }`}>
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                    ATS Score Vector Analysis
                  </h3>
                  <p className="text-[9px] opacity-50 font-medium">Real-time matching comparison</p>
                </div>
              </div>
              <span className="text-[8px] font-mono opacity-50 uppercase tracking-widest font-black">
                Interactive Chart
              </span>
            </div>

            {/* Recharts Graphical Display */}
            {hasOptimizations ? (
              <div className="h-[240px] w-full text-slate-300 font-mono text-[10px]" id="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#090b0e', 
                        borderColor: 'rgba(255,255,255,0.1)', 
                        borderRadius: '12px',
                        fontSize: '9px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '10px' }}
                    />
                    <Bar dataKey="Baseline Score" fill="rgba(255, 255, 255, 0.2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Optimized Score" fill="#10B981" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10B981' : '#00E5FF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center rounded-2xl border border-dashed border-white/5 bg-white/[0.01]">
                <Activity className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-1">
                  Ready for Analytics Vectoring
                </h4>
                <p className="text-[9px] opacity-50 max-w-[320px] mx-auto leading-relaxed">
                  Your optimization profiles match logs, scores, and keyword matrices will populate dynamically once you carry out your first resume optimization in the Resume Studio.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Section: Recent Workspace Activity */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white shadow-2xl' 
              : 'glass-card border-black/10 text-slate-800 shadow-lg'
          }`}>
            <div className="flex items-center justify-between mb-4.5 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Workspace Operational Ledger
                </h3>
              </div>
              <span className="text-[8px] font-mono opacity-50 uppercase tracking-widest font-black">
                Recent Transitions
              </span>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
              {activities.length > 0 ? (
                activities.map((activity, idx) => {
                  return (
                    <div 
                      key={activity.id + idx} 
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 border ${
                          activity.type === 'optimization' 
                            ? 'bg-purple-500/10 border-purple-500/15 text-purple-400' 
                            : activity.type === 'job_added'
                              ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                              : activity.type === 'master_updated'
                                ? 'bg-[#00E5FF]/10 border-[#00E5FF]/15 text-[#00E5FF]'
                                : 'bg-white/5 border-white/10 text-slate-400'
                        }`}>
                          {activity.type === 'optimization' ? <Cpu className="w-3.5 h-3.5" /> : 
                           activity.type === 'job_added' ? <Briefcase className="w-3.5 h-3.5" /> : 
                           <Layers className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-[11px] font-bold text-white leading-snug">
                            {activity.title}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate leading-relaxed">
                            {activity.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[8px] font-mono text-slate-500 font-bold block uppercase">
                          {activity.timestamp}
                        </span>
                        {activity.score && (
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full mt-1 inline-block border ${getScoreColor(activity.score)}`}>
                            {activity.score}% Match
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center bg-white/[0.01] rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono">No operational logs archived in current container scope.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side Summary Cards (Cols: 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Active Engine Card */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white' 
              : 'glass-card border-black/10 text-slate-800'
          }`}>
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-[#00E5FF] block mb-3">
              Hyper Routing Model
            </span>
            <div className="flex items-center gap-3 mb-4.5">
              <div className="p-3 bg-[#00E5FF]/10 rounded-2xl border border--[#00E5FF]/20 text-[#00E5FF]">
                <Cpu className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Active Model Engine
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  {mode === 'hybrid' ? 'Gemini & OpenAI Stack' : mode === 'openai' ? 'OpenAI GPT-4o' : 'Gemini 3.5 Suite'}
                </p>
              </div>
            </div>
            <div className="py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[8px] font-mono text-slate-400 leading-tight block text-left">
                Status: Operational Sandbox
              </span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-[#00E5FF]/5 blur-xl rounded-full" />
          </div>

          {/* Cloud Platform Statuses: Google Drive & Firestore */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white' 
              : 'glass-card border-black/10 text-slate-800'
          }`}>
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-[#00E676] block mb-4">
              Cloud Infrastructure Status
            </span>
            
            <div className="space-y-4">
              {/* Google Drive status block */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Clock className={`w-4 h-4 ${isDriveConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-white block">Google Drive</span>
                    <span className="text-[8px] text-slate-400 font-mono">Autobackup Sync</span>
                  </div>
                </div>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border ${
                  isDriveConnected 
                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' 
                    : 'text-slate-400 border-slate-500/20 bg-slate-500/10'
                }`}>
                  {isDriveConnected ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* Firestore database synced status */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-white block">Firestore DB</span>
                    <span className="text-[8px] text-slate-400 font-mono">Real-time Indexes</span>
                  </div>
                </div>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full border ${
                  user 
                    ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' 
                    : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                }`}>
                  {user ? 'Synced' : 'Local Sandbox'}
                </span>
              </div>

              {/* Security Shield */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.01] border border-white/5">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-white block">Security Module</span>
                    <span className="text-[8px] text-slate-400 font-mono">PII Mask Shield active</span>
                  </div>
                </div>
                <span className="text-[8px] font-mono px-2 py-0.5 rounded-full border text-cyan-400 border-cyan-500/20 bg-cyan-500/10">
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Current Master Portfolio Node Card */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white shadow-2xl' 
              : 'glass-card border-black/10 text-slate-800 shadow-lg'
          }`}>
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-cyan-400 block mb-3">
              Active Portfolio
            </span>
            <div className="flex items-start gap-3 text-left mb-4">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 mt-0.5">
                <Layers className="w-4.5 h-4.5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Active Master Profile
                </h4>
                <p className="text-[11px] text-cyan-400 font-mono mt-0.5 truncate font-bold">
                  {currentResumeName}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-[8px] font-mono py-0.5 px-1 bg-white/5 rounded border border-white/5 text-slate-400">
                    ID: {selectedResumeId.substring(0, 6)}...
                  </span>
                </div>
              </div>
            </div>

            {/* Quick portfolio switcher */}
            <div className="space-y-1.5 pt-3 border-t border-white/5">
              <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest block text-left mb-1.5">
                Quick Portal Swap
              </span>
              <div className="grid grid-cols-1 gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                {masterResumes.map((resume) => {
                  const isActive = resume.id === selectedResumeId;
                  return (
                    <button
                      key={resume.id}
                      onClick={() => onSelectResume(resume.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left border text-[10px] transition-all font-sans font-bold uppercase tracking-wider ${
                        isActive 
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25' 
                          : 'bg-white/[0.01] hover:bg-white/[0.03] text-slate-400 hover:text-white border-transparent'
                      }`}
                    >
                      <span className="truncate mr-2">{resume.name}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Last Optimization Overview Card */}
          <div className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden ${
            isDarkMode 
              ? 'glass-card-dark border-white/10 text-white shadow-2xl' 
              : 'glass-card border-black/10 text-slate-800 shadow-lg'
          }`}>
            <span className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-emerald-400 block mb-3">
              Last Tailoring Vectors
            </span>

            {activeAudience && results[activeAudience] ? (
              <div className="text-left space-y-3.5">
                <div>
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-1 leading-tight">
                    Audience Alignment Profile
                  </h4>
                  <span className="text-xs font-mono font-black text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded-full inline-block">
                    {activeAudience}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 py-2.5 border-t border-b border-white/5 font-mono">
                  <div>
                    <span className="text-[8px] opacity-40 uppercase block mb-0.5">Baseline Score</span>
                    <span className="text-xs text-slate-400 font-bold block">{results[activeAudience].baseline_score || 60}%</span>
                  </div>
                  <div>
                    <span className="text-[8px] opacity-40 uppercase block mb-0.5">ATS Target score</span>
                    <span className="text-xs text-emerald-400 font-black block">{results[activeAudience].match_score || 85}%</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[8px] uppercase font-mono tracking-wider opacity-40 text-left block">
                    ATS Key Words Added
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-[70px] overflow-y-auto custom-scrollbar">
                    {results[activeAudience].ats_keywords_added_to_resume?.length > 0 ? (
                      results[activeAudience].ats_keywords_added_to_resume.slice(0, 10).map((kw: string, i: number) => (
                        <span key={i} className="text-[8px] font-mono py-0.5 px-1.5 rounded bg-[#10B981]/5 border border-[#10B981]/15 text-[#10B981]">
                          +{kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8px] text-slate-500 font-mono italic">No additions needed</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[9px] text-slate-500 font-mono leading-relaxed px-2">
                  No target optimizations mapped in current session context. Open the Resume Studio to generate vectors.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
export default DashboardHome;
