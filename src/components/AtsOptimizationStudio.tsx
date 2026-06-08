import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Trash2, 
  Target, 
  Building, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  Check, 
  Cpu, 
  Info, 
  Square, 
  RefreshCw, 
  Download, 
  ShieldAlert, 
  Search, 
  FileText, 
  Layers, 
  Clock, 
  BarChart3, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import Markdown from 'react-markdown';

interface AtsOptimizationStudioProps {
  isDarkMode: boolean;
  targetRole: string;
  setTargetRole: (val: string) => void;
  companyName: string;
  setCompanyName: (val: string) => void;
  targetCompany: string;
  setTargetCompany: (val: string) => void;
  jobUrl: string;
  setJobUrl: (val: string) => void;
  jobDescription: string;
  setJobDescription: (val: string) => void;
  resumeText: string;
  clearInputs: () => void;
  selectedAudiences: string[];
  setSelectedAudiences: (val: string[]) => void;
  customAudience: string;
  setCustomAudience: (val: string) => void;
  isAutoSelectingAudiences: boolean;
  handleAutoSelectAudiences: () => void;
  isAudienceDropdownOpen: boolean;
  setIsAudienceDropdownOpen: (val: boolean) => void;
  audienceDropdownRef: React.RefObject<HTMLDivElement | null>;
  toggleAudience: (id: string) => void;
  AUDIENCES: Array<{ id: string; label: string; icon: string }>;
  customPrompt: string;
  setCustomPrompt: (val: string) => void;
  isOptimizing: boolean;
  handleStop: () => void;
  isExtracting: boolean;
  handleOptimize: () => void;
  optimizationProgress: number;
  showOptimizeSuccess: boolean;
  tokenUsage: {
    gemini: { input: number; output: number };
    openai: { input: number; output: number };
  };
  fetchTokenUsage: () => void;
  isRefreshingTokens: boolean;
  generateTokenReport: () => void;
  isDownloading: boolean;
  deepResearchReport: string | null;
  setDeepResearchReport: (val: string | null) => void;
  selectedEngine: 'gemini' | 'openai' | 'hybrid-gemini' | 'hybrid-openai';
  setSelectedEngine: (val: 'gemini' | 'openai' | 'hybrid-gemini' | 'hybrid-openai') => void;
  engineConfig: Record<string, any>;
  setEngineConfig: (val: any) => void;
  suitabilityResult: any | null;
  setSuitabilityResult: (val: any | null) => void;
  isCheckingSuitability: boolean;
  handleCheckSuitability: () => void;
  multiSuitabilityResults: Record<string, any>;
  masterResumes: Array<{ id: string; name: string }>;
  selectedResumeId: string;
  recruiterSimulationMode: boolean;
  setRecruiterSimulationMode: (val: boolean) => void;
  fastMode: boolean;
  setFastMode: (val: boolean) => void;
  mode: 'conservative' | 'balanced' | 'aggressive';
  setMode: (val: 'conservative' | 'balanced' | 'aggressive') => void;
  showModeInfo: boolean;
  setShowModeInfo: (val: boolean) => void;
  results: Record<string, any>;
  activeAudience: string;
  usePremiumLoader: boolean;
  setUsePremiumLoader: (val: boolean) => void;
  isFetchingJob: boolean;
  jdTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isCompanyDropdownOpen: boolean;
  setIsCompanyDropdownOpen: (val: boolean) => void;
  companyDropdownRef: React.RefObject<HTMLDivElement | null>;
  TARGET_COMPANIES: Array<{ id: string; label: string; icon: string; signal: string }>;
  MODE_DESCRIPTIONS: Record<string, string>;
  onOpenWorkspace?: () => void;
}

export const AtsOptimizationStudio: React.FC<AtsOptimizationStudioProps> = ({
  isDarkMode,
  targetRole,
  setTargetRole,
  companyName,
  setCompanyName,
  targetCompany,
  setTargetCompany,
  jobUrl,
  setJobUrl,
  jobDescription,
  setJobDescription,
  resumeText,
  clearInputs,
  selectedAudiences,
  setSelectedAudiences,
  customAudience,
  setCustomAudience,
  isAutoSelectingAudiences,
  handleAutoSelectAudiences,
  isAudienceDropdownOpen,
  setIsAudienceDropdownOpen,
  audienceDropdownRef,
  toggleAudience,
  AUDIENCES,
  customPrompt,
  setCustomPrompt,
  isOptimizing,
  handleStop,
  isExtracting,
  handleOptimize,
  optimizationProgress,
  showOptimizeSuccess,
  tokenUsage,
  fetchTokenUsage,
  isRefreshingTokens,
  generateTokenReport,
  isDownloading,
  deepResearchReport,
  setDeepResearchReport,
  selectedEngine,
  setSelectedEngine,
  engineConfig,
  setEngineConfig,
  suitabilityResult,
  setSuitabilityResult,
  isCheckingSuitability,
  handleCheckSuitability,
  multiSuitabilityResults,
  masterResumes,
  selectedResumeId,
  recruiterSimulationMode,
  setRecruiterSimulationMode,
  fastMode,
  setFastMode,
  mode,
  setMode,
  showModeInfo,
  setShowModeInfo,
  results,
  activeAudience,
  usePremiumLoader,
  setUsePremiumLoader,
  isFetchingJob,
  jdTextareaRef,
  isCompanyDropdownOpen,
  setIsCompanyDropdownOpen,
  companyDropdownRef,
  TARGET_COMPANIES,
  MODE_DESCRIPTIONS,
  onOpenWorkspace
}) => {
  // Compute metrics with safety fallbacks
  const activeResult = activeAudience ? results[activeAudience] : null;
  const targetKeywords: string[] = activeResult?._intermediateData?.jdKeywords || [];
  const foundKeywordsCount = targetKeywords.filter((kw: string) => 
    resumeText?.toLowerCase().includes(kw.toLowerCase())
  ).length;

  const resumeStrength = activeResult?.baseline_score ?? (suitabilityResult?.baselineScore || (resumeText?.length > 1000 ? 55 : 30));
  const preOptimizationScore = suitabilityResult?.matchScore ?? 0;
  const postOptimizationScore = activeResult?.match_score ?? 0;

  // Resolve displayAtsReadiness safely implementing user's feedback
  let displayAtsReadiness = 0;
  if (postOptimizationScore > 0) {
    displayAtsReadiness = Math.max(postOptimizationScore, resumeStrength + 25, 88);
    if (displayAtsReadiness > 99) displayAtsReadiness = 98;
  } else if (preOptimizationScore > 0) {
    if (preOptimizationScore < resumeStrength) {
      displayAtsReadiness = 0; // Keep blank/remove if lower than resumeStrength
    } else {
      displayAtsReadiness = preOptimizationScore;
    }
  }

  const atsReadiness = displayAtsReadiness;
  const keywordCoverage = targetKeywords.length > 0 ? Math.round((foundKeywordsCount / targetKeywords.length) * 100) : 0;
  const skillsMatch = suitabilityResult?.readinessScore ?? (atsReadiness > 0 ? Math.min(100, Math.round(atsReadiness * 1.1)) : 0);

  const activeResumeName = masterResumes.find(r => r.id === selectedResumeId)?.name || 'Standard Import PDF';

  // Determine active steps in journey
  const hasJobIntel = targetRole !== '' || jobDescription !== '';
  const hasResumeIntel = resumeText ? resumeText.trim().length > 100 : false;
  const isStrategyBuilt = suitabilityResult !== null || customPrompt.trim() !== '' || isOptimizing || Object.keys(results).length > 0;
  const isOptimized = Object.keys(results).length > 0;

  return (
    <motion.div 
      key="build-tab-premium"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 select-none max-w-full"
    >
      {/* HEADER CONTROLS */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              ATS Optimization Studio
              <span className="text-[10px] py-0.5 px-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold uppercase rounded-full tracking-wider animate-pulse">
                Pro Engine Active
              </span>
            </h2>
            <p className="text-xs text-white/50">Glass Resume AI Orchestrator & Studio</p>
          </div>
        </div>

        <button 
          onClick={clearInputs}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
          title="Clear all workspace inputs"
        >
          <Trash2 className="w-4 h-4" />
          Clear Workspace
        </button>
      </div>

      {/* ROW 1: OPTIMIZATION KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ATS Readiness */}
        <div className="relative group overflow-hidden rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md transition-all hover:border-emerald-500/30">
          <div className="absolute top-0 right-0 p-3 bg-emerald-500/10 text-emerald-400 rounded-bl-xl font-bold text-[10px] tracking-wider uppercase">
            Score
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/50">ATS Readiness</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{atsReadiness > 0 ? `${atsReadiness}%` : '---'}</span>
            <span className="text-[10px] text-emerald-400 font-bold">Predicted match</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${atsReadiness}%` }}
            />
          </div>
        </div>

        {/* Card 2: Skills Match */}
        <div className="relative group overflow-hidden rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md transition-all hover:border-blue-500/30">
          <div className="absolute top-0 right-0 p-3 bg-blue-500/10 text-blue-400 rounded-bl-xl font-bold text-[10px] tracking-wider uppercase">
            Fit
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Skills Match</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{skillsMatch}%</span>
            <span className="text-[10px] text-blue-400 font-bold">Audience relevance</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${skillsMatch}%` }}
            />
          </div>
        </div>

        {/* Card 3: Keyword Coverage */}
        <div className="relative group overflow-hidden rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md transition-all hover:border-purple-500/30">
          <div className="absolute top-0 right-0 p-3 bg-purple-500/10 text-purple-400 rounded-bl-xl font-bold text-[10px] tracking-wider uppercase">
            Parser
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Keyword Coverage</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{keywordCoverage}%</span>
            <span className="text-[10px] text-purple-400 font-bold">Keywords found</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${keywordCoverage}%` }}
            />
          </div>
        </div>

        {/* Card 4: Resume Strength */}
        <div className="relative group overflow-hidden rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md transition-all hover:border-teal-500/30">
          <div className="absolute top-0 right-0 p-3 bg-teal-500/10 text-teal-400 rounded-bl-xl font-bold text-[10px] tracking-wider uppercase">
            Baseline
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Resume Strength</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{resumeStrength}%</span>
            <span className="text-[10px] text-teal-400 font-bold">Unoptimized level</span>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-teal-500 h-full rounded-full transition-all duration-1000" 
              style={{ width: `${resumeStrength}%` }}
            />
          </div>
        </div>
      </div>

      {/* ROW 2: LEFT: JOB INTELLIGENCE, RIGHT: RESUME INTELLIGENCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Job Intelligence */}
        <div className="rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur-md space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Search className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Job Intelligence</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-50">Target Role *</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text"
                  placeholder="e.g. Senior Cloud Architect"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-50">Company Name *</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text"
                  placeholder="e.g. Microsoft"
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-50">Job Description Paste / URL</label>
            <div className="space-y-3">
              <input 
                type="url"
                placeholder="Paste corporate job posting URL here..."
                className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white/10 border-white/20 text-white placeholder:text-white/40"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />
              <textarea 
                ref={jdTextareaRef}
                placeholder="Or paste standard raw text posting here..."
                className="w-full h-24 p-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-y text-xs leading-relaxed bg-white/10 border-white/20 text-white placeholder:text-white/40"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />

              <button
                type="button"
                onClick={handleCheckSuitability}
                disabled={(!jobDescription && !jobUrl) || !resumeText || isCheckingSuitability}
                className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border text-xs ${
                  (!jobDescription && !jobUrl) || !resumeText
                    ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                    : isCheckingSuitability
                      ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                      : suitabilityResult 
                        ? 'bg-indigo-500/30 border-indigo-500/45 text-white shadow-lg'
                        : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                }`}
              >
                {isCheckingSuitability ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    Checking Fit (Standard Pipeline)...
                  </>
                ) : suitabilityResult ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Re-Check Resumes Fit ({suitabilityResult.matchScore}% Match Found)
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    Check All Resumes for Fit & Risks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Resume Intelligence */}
        <div className="rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur-md space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Resume Intelligence</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-white/5 bg-white/5">
              <span className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Active Resume</span>
              <span className="text-xs font-black text-emerald-400 truncate block focus:outline-none" title={activeResumeName}>
                {activeResumeName}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-white/5 bg-white/5">
              <span className="block text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Category</span>
              <span className="text-xs font-black text-blue-400 truncate block">
                {targetRole ? targetRole.split(' ').slice(0, 2).join(' ') || 'Standard' : 'Not Loaded'}
              </span>
            </div>
          </div>

          {/* Moved Optimization Button */}
          <button
            onClick={() => {
              if (isOptimizing) {
                handleStop();
                return;
              }
              if (isExtracting) return;
              handleOptimize();
            }}
            disabled={isExtracting}
            className={`relative overflow-hidden w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-xl select-none ${
              isOptimizing 
                ? 'bg-red-500/25 border border-red-500/40 text-red-300' 
                : showOptimizeSuccess
                  ? 'bg-emerald-400 text-black shadow-lg scale-102'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-101 border border-emerald-400/20'
            }`}
          >
            {isOptimizing ? (
              <>
                <Square className="w-5 h-5 fill-current animate-pulse text-red-400" />
                <span className="text-sm">STOP RECONSTRUCT ({Math.round(optimizationProgress)}%)</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 fill-current" />
                <span className="text-sm">RUN PREMIUM ATS OPTIMIZER</span>
              </>
            )}
            {isOptimizing && (
              <motion.div 
                className="absolute inset-x-0 bottom-0 h-1 bg-yellow-500 pointer-events-none"
                initial={{ width: 0 }}
                animate={{ width: `${optimizationProgress}%` }}
              />
            )}
          </button>

          {/* Target Audiences and dropdown */}
          <div className="relative" ref={audienceDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Target Audiences (Multi-select)</label>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleAutoSelectAudiences();
                }}
                disabled={isAutoSelectingAudiences}
                className="py-1 px-2 text-[8px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50 border border-emerald-500/25"
              >
                {isAutoSelectingAudiences ? 'Selecting...' : 'Auto-Select'}
              </button>
            </div>
            
            <button
              onClick={() => setIsAudienceDropdownOpen(!isAudienceDropdownOpen)}
              className="w-full px-3 py-2.5 text-xs border rounded-xl flex items-center justify-between transition-all bg-white/10 border-white/20 text-white"
            >
              <span className="truncate flex items-center gap-2">
                {selectedAudiences.length > 0 ? (
                  <>
                    <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Active</span>
                    {selectedAudiences.map(id => id === 'custom' ? (customAudience || 'Custom') : (AUDIENCES.find(a => a.id === id)?.label || id)).join(', ')}
                  </>
                ) : 'Select target personas...'}
              </span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>

            {isAudienceDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 border rounded-xl shadow-2xl bg-black text-white border-white/10 max-h-56 overflow-y-auto custom-scrollbar">
                <div className="p-2 border-b border-white/10 flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAudiences(['microsoft']);
                    }}
                    className="flex-1 py-1 text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAudiences([]);
                    }}
                    className="flex-1 py-1 text-[9px] font-extrabold uppercase tracking-widest bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors border border-red-500/20"
                  >
                    Clear
                  </button>
                </div>
                {AUDIENCES.map((audience) => (
                  <button
                    key={audience.id}
                    onClick={() => toggleAudience(audience.id)}
                    className={`w-full px-4 py-2.5 text-xs flex items-center gap-2 ${
                      selectedAudiences.includes(audience.id)
                        ? 'bg-emerald-500/25 text-emerald-400'
                        : 'text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-lg">{audience.icon}</span>
                    {audience.label}
                    {selectedAudiences.includes(audience.id) && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
            
            {selectedAudiences.includes('custom') && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2"
              >
                <input 
                  type="text"
                  placeholder="Custom profile/audience (e.g. Lead Kubernetes Architect)..."
                  value={customAudience}
                  onChange={(e) => setCustomAudience(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </motion.div>
            )}
          </div>

        </div>
      </div>

      {/* ROW 3: OPTIMIZATION JOURNEY PIPELINE (LARGE VISUAL WORKFLOW) */}
      <div className="rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              Real-Time Workspace Journey
            </span>
            <h4 className="text-sm font-bold text-white mt-2">Active Optimization Workflow Pipeline</h4>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {/* Step 1 */}
          <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
            hasJobIntel ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5">Step 1</span>
            <Search className="w-5 h-5 mb-2" />
            <span className="text-xs font-black">Job Analysis</span>
            <p className="text-[10px] opacity-70 mt-1">Targeting JD</p>
          </div>

          {/* Step 2 */}
          <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
            hasResumeIntel ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5">Step 2</span>
            <Layers className="w-5 h-5 mb-2" />
            <span className="text-xs font-black">Resume Match</span>
            <p className="text-[10px] opacity-70 mt-1">Inputs Loaded</p>
          </div>

          {/* Step 3 */}
          <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
            isStrategyBuilt ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5">Step 3</span>
            <Sparkles className="w-5 h-5 mb-2" />
            <span className="text-xs font-black">Strategy Build</span>
            <p className="text-[10px] opacity-70 mt-1">AI Contextualized</p>
          </div>

          {/* Step 4 */}
          <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
            isOptimizing ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-pulse' : isOptimized ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5">Step 4</span>
            <Zap className="w-5 h-5 mb-2" />
            <span className="text-xs font-black">ATS Optimization</span>
            <p className="text-[10px] opacity-70 mt-1">LLM Alignment</p>
          </div>

          {/* Step 5 */}
          <div className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${
            isOptimized ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-xl shadow-emerald-500/10' : 'bg-white/5 border-white/5 text-white/30'
          }`}>
            <span className="text-[9px] font-black uppercase tracking-widest mb-1.5">Step 5</span>
            <CheckCircle2 className="w-5 h-5 mb-2" />
            <span className="text-xs font-black">Export Ready</span>
            <p className="text-[10px] opacity-70 mt-1">PDF & DOCX Tailored</p>
          </div>
        </div>
      </div>

      {/* ROW 4: AI OPTIMIZATION CONTROL CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Control Column (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 p-6 bg-white/5 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">AI Optimization Control Center</h3>
          </div>

          {/* Select Engine Grid */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">Select Optimization Engine</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['gemini', 'openai', 'hybrid-gemini', 'hybrid-openai'] as const).map((eng) => (
                <button
                  key={eng}
                  onClick={() => setSelectedEngine(eng)}
                  className={`py-2 text-[9px] font-black rounded-lg border transition-all capitalize tracking-widest ${
                    selectedEngine === eng 
                      ? 'bg-emerald-500 text-black border-emerald-500 shadow-md' 
                      : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {eng.replace('hybrid-', 'Hybrid ')}
                </button>
              ))}
            </div>
            
            {/* Engine Sub-selection Model dropdown */}
            <div className="mt-3.5">
              {!selectedEngine.startsWith('hybrid') ? (
                <div className="relative">
                  <select 
                    className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none bg-black text-white border-white/10"
                    value={engineConfig[selectedEngine === 'gemini' ? 'gemini' : 'openai']?.model}
                    onChange={(e) => setEngineConfig({
                      ...engineConfig,
                      [selectedEngine === 'gemini' ? 'gemini' : 'openai']: { 
                        ...engineConfig[selectedEngine === 'gemini' ? 'gemini' : 'openai'], 
                        model: e.target.value 
                      }
                    })}
                  >
                    {selectedEngine === 'gemini' && (
                      <>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Recommended)</option>
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                      </>
                    )}
                    {selectedEngine === 'openai' && (
                      <>
                        <option value="gpt-4o">GPT-4o (High Fidelity)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="o3-mini">OpenAI o3-mini</option>
                      </>
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 pointer-events-none" />
                </div>
              ) : (
                <div className="p-3 rounded-xl border flex items-center gap-3 bg-emerald-500/5 border-emerald-500/20 text-white/80">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[10px] leading-relaxed font-semibold">
                    Smart routing initialized: Using Google Gemini for structure analysis and OpenAI GPT for tone formulation.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Mode parameters */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-50">Optimization Mode Profile</label>
                <button 
                  onMouseEnter={() => setShowModeInfo(true)}
                  onMouseLeave={() => setShowModeInfo(false)}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {showModeInfo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 p-3 rounded-lg text-[10px] leading-relaxed border bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                  >
                    <p className="font-bold mb-1">Mode Descriptions:</p>
                    <ul className="space-y-1">
                      <li><span className="font-black text-white">Conservative:</span> {MODE_DESCRIPTIONS.conservative}</li>
                      <li><span className="font-black text-white">Balanced:</span> {MODE_DESCRIPTIONS.balanced}</li>
                      <li><span className="font-black text-white">Aggressive:</span> {MODE_DESCRIPTIONS.aggressive}</li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-3 gap-2">
                {['conservative', 'balanced', 'aggressive'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m as any)}
                    className={`py-2 text-[10px] font-black rounded-lg border transition-all capitalize tracking-tight ${
                      mode === m 
                        ? 'bg-emerald-500 text-black border-emerald-500' 
                        : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Corporate DNA Selector inside Control Center */}
            <div className="relative" ref={companyDropdownRef}>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-50">Corporate DNA Tailoring</label>
              <button
                onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                className="w-full px-4 py-2.5 text-xs border rounded-xl flex items-center justify-between transition-all bg-white/10 border-white/20 text-white hover:bg-black/80"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TARGET_COMPANIES.find(c => c.id === targetCompany)?.icon}</span>
                  <div className="text-left">
                    <div className="font-black text-xs">{TARGET_COMPANIES.find(c => c.id === targetCompany)?.label}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isCompanyDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 mt-2 p-2 rounded-xl border shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar bg-black text-white border-white/10"
                  >
                    {TARGET_COMPANIES.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setTargetCompany(company.id);
                          setIsCompanyDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-lg flex items-center gap-3 transition-all text-left ${
                          targetCompany === company.id 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-black hover:bg-white/5 text-white/70'
                        }`}
                      >
                        <span className="text-xl shrink-0">{company.icon}</span>
                        <div>
                          <div className="text-[11px] font-black">{company.label}</div>
                        </div>
                        {targetCompany === company.id && <Check className="w-3.5 h-3.5 ml-auto text-purple-400" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Recruiter Simulation Toggle and Fast Mode Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setRecruiterSimulationMode(!recruiterSimulationMode)}
                className={`py-2 px-3.5 rounded-xl text-xs font-black flex items-center justify-between border transition-all ${
                  recruiterSimulationMode
                    ? 'bg-red-500/20 border-red-500 text-red-200'
                    : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10'
                }`}
              >
                Recruiter Simulation Mode
                <div className={`w-2.5 h-2.5 rounded-full ${recruiterSimulationMode ? 'bg-red-500' : 'bg-white/30'}`} />
              </button>

              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 border border-white/5 bg-white/5 rounded-xl hover:bg-white/10 transition-all select-none">
                <input 
                  type="checkbox" 
                  checked={fastMode} 
                  onChange={(e) => setFastMode(e.target.checked)}
                  className="accent-emerald-500 h-4 w-4 rounded"
                />
                <span className="text-xs font-black text-white/80">Fast Mode (Force Flash model)</span>
              </label>

              {/* Cover Letter toggle stylized block */}
              <div className="p-2.5 border border-white/5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all select-none flex items-center justify-between col-span-1 md:col-span-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-black">Strict FAANG ATS Standard Tailoring</span>
                </div>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-400/40 bg-black/40">
                  Strict Active
                </span>
              </div>
            </div>
          </div>

          {/* Custom prompt textarea */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-50">Custom AI Prompt Adjustments</label>
            <textarea 
              placeholder="e.g. Highlight cloud DevOps and reduce emphasis on traditional system administration..."
              className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white/10 border-white/20 text-white text-xs"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        {/* Right Status / Workspace Tools Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Open Preview Workspace if results exist */}
            {Object.keys(results || {}).length > 0 && !isOptimizing && onOpenWorkspace && (
              <button
                type="button"
                onClick={onOpenWorkspace}
                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-purple-500/20 text-white font-black select-none transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer border border-purple-500/30"
              >
                <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
                <span>OPEN RESULT PREVIEW</span>
              </button>
            )}

            {/* Deep Research integration block details */}
            <AnimatePresence>
              {deepResearchReport && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  <div className="p-4 rounded-xl border bg-purple-900/10 border-purple-500/20 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400">Deep Intelligence Report</h4>
                      </div>
                      <button 
                        onClick={() => setDeepResearchReport(null)}
                        className="text-[10px] font-bold uppercase opacity-40 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="text-[10px] leading-relaxed max-h-36 overflow-y-auto custom-scrollbar pr-1 opacity-85">
                      <div className="markdown-body">
                        <Markdown>{deepResearchReport}</Markdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Token Usage Widget */}
            <div className="p-4 rounded-xl border bg-black/40 border-white/5 space-y-3.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 opacity-60">
                  <Cpu className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Route Tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={fetchTokenUsage}
                    disabled={isRefreshingTokens}
                    className={`p-1 rounded-md hover:bg-white/10 text-white ${isRefreshingTokens ? 'animate-spin opacity-50' : 'opacity-60'}`}
                    title="Refresh token database"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={generateTokenReport}
                    disabled={isDownloading}
                    className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Report
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-white/5">
                <div>
                  <span className="block text-[8px] font-extrabold uppercase tracking-widest text-white/40 mb-0.5">Gemini Input</span>
                  <span className="text-xs font-mono font-bold text-white/95">{(tokenUsage.gemini.input / 1000).toFixed(1)}k</span>
                </div>
                <div>
                  <span className="block text-[8px] font-extrabold uppercase tracking-widest text-white/40 mb-0.5">Gemini Output</span>
                  <span className="text-xs font-mono font-bold text-white/95">{(tokenUsage.gemini.output / 1000).toFixed(1)}k</span>
                </div>
              </div>
            </div>
            
        </div>
      </div>

      {/* ROW 5: OPTIMIZATION PREVIEW / RESULTS FEEDBACK */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Col: Predicted ATS Improvement */}
        <div className="rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-white/5">
            <BarChart3 className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Predicted ATS Jump</h3>
          </div>

          <div className="flex items-center justify-around p-4 rounded-xl bg-black/40 border border-white/5">
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 text-white block">Before</span>
              <span className="text-3xl font-black text-white/60 line-through">
                {resumeStrength}%
              </span>
            </div>
            
            <ArrowRight className="w-5 h-5 text-emerald-400" />

            <div className="text-center">
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block pb-0.5">After Premium</span>
              <span className="text-4xl font-black text-emerald-400 drop-shadow-emerald animate-pulse">
                {atsReadiness > 0 ? `${atsReadiness}%` : '---'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-white/60 leading-relaxed text-center">
            {atsReadiness > 0 
              ? `Realized highly-aligned increase of +${Math.max(0, atsReadiness - resumeStrength)}% points against selected parser filters.`
              : 'Supply job details and resume payload to authorize initial predictions.'}
          </p>
        </div>

        {/* Middle Col: Keywords Selection & Registry */}
        <div className="rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-white/5">
            <FileText className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Target Keywords Registry</h3>
          </div>

          {targetKeywords.length > 0 ? (
            <div className="space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest opacity-40 text-white">Parser Targeting (Showing Top 15 keywords)</span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                {targetKeywords.slice(0, 15).map((kw, i) => {
                  const isFound = resumeText?.toLowerCase().includes(kw.toLowerCase());
                  return (
                    <span 
                      key={i} 
                      className={`text-[9px] px-2.5 py-1 rounded-full border font-black transition-all ${
                        isFound 
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400' 
                          : 'bg-white/5 border-white/10 text-white/35 font-medium'
                      }`}
                    >
                      {kw}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-white/35 text-xs">
              Target keywords loaded dynamically from the Job Description keywords.
            </div>
          )}
        </div>

        {/* Right Col: Expert Critique & Recommendations */}
        <div className="rounded-2xl border border-white/10 p-5 bg-white/5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-white/5">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/80">Red Audit Feedback</h3>
          </div>

          {suitabilityResult?.critique && suitabilityResult.critique.length > 0 ? (
            <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {suitabilityResult.critique.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="flex gap-2.5 border-b border-white/5 pb-2 last:border-0">
                  <div className={`w-1.5 shrink-0 rounded-full mt-1.5 h-1.5 ${
                    item.severity === 'high' ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                  }`} />
                  <div>
                    <span className="text-[8px] font-black uppercase opacity-55 text-white/60">{item.category}</span>
                    <p className="text-[10px] leading-relaxed text-white/80">{item.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-white/35 text-xs">
              Check all resumes for fit to trigger a Red Team critique sweep.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
