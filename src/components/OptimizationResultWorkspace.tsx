import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowLeft, 
  FileDown, 
  HardDrive,
  Cpu, 
  Wrench, 
  Award, 
  Check, 
  Bookmark, 
  FileText, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Target
} from 'lucide-react';
import { motion } from 'motion/react';

interface OptimizationResultWorkspaceProps {
  isDarkMode: boolean;
  artifact?: {
    id: string;
    resumeName: string;
    targetRole: string;
    targetCompany: string;
    timestamp: number;
    results: Record<string, any>;
    activeAudience: string | null;
    mode: string;
    jobDescription: string;
  } | null;
  activeAudience: string | null;
  results: Record<string, any>;
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadDOCX: () => void;
  onDownloadJSON: () => void;
  onSaveToDrive: () => void;
  onOpenResumeBuilder: () => void;
  children?: React.ReactNode; // Section 4 (Embedded PDF Preview from App.tsx)
  previewMode?: 'standard' | 'simplified';
  setPreviewMode?: (mode: 'standard' | 'simplified') => void;
}

export const OptimizationResultWorkspace: React.FC<OptimizationResultWorkspaceProps> = ({
  isDarkMode,
  artifact,
  activeAudience,
  results,
  onClose,
  onDownloadPDF,
  onDownloadDOCX,
  onDownloadJSON,
  onSaveToDrive,
  onOpenResumeBuilder,
  children,
  previewMode,
  setPreviewMode
}) => {
  const [viewMode, setViewMode] = useState<'resume' | 'json'>('resume');
  const [copied, setCopied] = useState(false);

  // Dynamic horizontal panel drag resize
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('resultWorkspaceLeftWidth');
    return saved ? parseInt(saved, 10) : 420;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const workspaceContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  React.useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !workspaceContainerRef.current) return;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        if (isResizing) {
          const rect = workspaceContainerRef.current!.getBoundingClientRect();
          const newWidthPx = e.clientX - rect.left;
          // Constraints: min 280px, max 60% of container width
          const allowedWidth = Math.max(280, Math.min(rect.width * 0.6, newWidthPx));
          setLeftWidth(allowedWidth);
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('resultWorkspaceLeftWidth', leftWidth.toString());
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true });
      if (!isResizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [isResizing, leftWidth]);

  // Resolve active result data
  const currentAudience = artifact ? artifact.activeAudience : activeAudience;
  const activeResult = artifact 
    ? (currentAudience ? artifact.results[currentAudience] : null)
    : (currentAudience ? results[currentAudience] : null);

  const targetRole = artifact ? artifact.targetRole : (activeResult?.personal_info?.name ? activeResult?.personal_info?.name : 'Target Role');
  const targetCompany = artifact ? artifact.targetCompany : 'Target Company';
  const timestamp = artifact ? artifact.timestamp : Date.now();
  const formattedTime = new Date(timestamp).toLocaleString();

  if (!activeResult) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#090b0e] text-white">
        <Cpu className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <h3 className="text-lg font-bold">Mounting Studio Pipeline...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Compiling data structures, resolving audience vectors, and preparing the visual preview canvas.
        </p>
      </div>
    );
  }

  const baselineScore = activeResult.baseline_score || 60;
  const matchScore = activeResult.match_score || 85;
  const scoreDiff = matchScore - baselineScore;
  
  const keywordsAdded = activeResult.ats_keywords_added_to_resume || [];
  const keywordGap = activeResult.keyword_gap || [];
  const improvementNotes = activeResult.improvement_notes || [];
  const audienceNotes = activeResult.audience_alignment_notes || "";
  const skillsConfig = activeResult.skills || {};

  // Total unique skills
  const totalSkillsCount = Object.values(skillsConfig).flat().length;

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden text-left ${isDarkMode ? 'bg-[#090b0e] text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* SECTION 1: TOP GLOWING HEADER BAR */}
      <header className="shrink-0 p-4 border-b border-white/5 bg-[#0b0e14]/90 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 z-40 relative">
        <div className="flex items-center gap-3">
          <button 
            id="close-workspace-back-btn"
            onClick={onClose}
            className="p-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Return to Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 roundedbg-emerald-500/10 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pipeline Complete
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {formattedTime}
              </span>
            </div>
            
            <h1 className="text-base font-black tracking-tight mt-1 truncate max-w-md uppercase">
              {targetRole} <span className="text-slate-500 text-xs font-medium">@</span> {targetCompany}
            </h1>
          </div>
        </div>

        {/* Action Header quick exits */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenResumeBuilder}
            className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            Resume Builder
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 active:scale-95 transition-all"
          >
            Back To Studio
          </button>
        </div>
      </header>

      {/* THREE-COLUMN WORKSPACE CANVAS FLOOR */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative" ref={workspaceContainerRef}>
        
        {/* LEFT COLUMN: CRITICAL METRIC SCORECARDS (resizable) */}
        <div 
          className="w-full lg:shrink-0 border-r border-white/5 flex flex-col overflow-y-auto custom-scrollbar bg-[#0b0e14]/50"
          style={{
            width: isMobile ? '100%' : `${leftWidth}px`
          }}
        >
          
          {/* SECTION 2 & 3 CONTAINER */}
          <div className="p-6 space-y-6">
            
            {/* VERCEL/LINEAR RADIAL SCORE COMPARISON */}
            <div className="p-5.5 rounded-2xl border border-white/5 bg-[#0f131a] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none" />
              
              <h3 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Score Differential
              </h3>

              <div className="flex items-center justify-around gap-4">
                {/* Baseline Gauge */}
                <div className="text-center">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" className="stroke-white/5 fill-none" strokeWidth="4" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="32" 
                        className="stroke-slate-500/30 fill-none" 
                        strokeWidth="5" 
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - baselineScore / 100)}`}
                      />
                    </svg>
                    <span className="absolute font-mono text-xs text-slate-400 font-bold">{baselineScore}%</span>
                  </div>
                  <span className="text-[8px] font-mono font-black uppercase tracking-wider text-slate-500 mt-2 block">Baseline</span>
                </div>

                {/* Score Delta Indicator */}
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400 font-mono font-semibold">
                    +{scoreDiff}
                  </div>
                  <span className="text-[8px] uppercase tracking-wider font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-black">
                    Lift
                  </span>
                </div>

                {/* Optimized Target Score Gauge */}
                <div className="text-center">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="32" className="stroke-white/5 fill-none" strokeWidth="4" />
                      <circle 
                        cx="40" 
                        cy="40" 
                        r="32" 
                        className="stroke-emerald-400 fill-none transition-all duration-1000" 
                        strokeWidth="6" 
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - matchScore / 100)}`}
                      />
                    </svg>
                    <span className="absolute font-mono text-sm text-white font-black">{matchScore}%</span>
                  </div>
                  <span className="text-[8px] font-mono font-black uppercase tracking-wider text-emerald-400 mt-2 block">Target Score</span>
                </div>
              </div>
            </div>

            {/* PIPELINE NUMERIC ARTIFACT COUNTS */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#0f131a] border border-white/5 rounded-xl text-center">
                <span className="text-[8px] font-mono text-slate-400 block uppercase font-bold">Keywords</span>
                <span className="text-lg font-black font-mono text-emerald-400 animate-pulse">+{keywordsAdded.length}</span>
                <span className="text-[7px] text-slate-500 block uppercase font-bold mt-0.5">Injected</span>
              </div>
              <div className="p-3 bg-[#0f131a] border border-white/5 rounded-xl text-center">
                <span className="text-[8px] font-mono text-slate-400 block uppercase font-bold">Skills Map</span>
                <span className="text-lg font-black font-mono text-cyan-400">{totalSkillsCount}</span>
                <span className="text-[7px] text-slate-500 block uppercase font-bold mt-0.5">Anchored</span>
              </div>
              <div className="p-3 bg-[#0f131a] border border-white/5 rounded-xl text-center">
                <span className="text-[8px] font-mono text-slate-400 block uppercase font-bold">Audience</span>
                <span className="text-[10px] font-black font-mono text-purple-400 truncate block mt-2.5 max-w-full uppercase">
                  {currentAudience || 'Default'}
                </span>
                <span className="text-[7px] text-slate-500 block uppercase font-bold mt-0.5">Target</span>
              </div>
            </div>

            {/* SECTION 3: RECENT HIGHLIGHTS & IMPROVEMENT COMPILATION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-[#00E5FF]">
                  Optimizations Highlights
                </h4>
                <Award className="w-3.5 h-3.5 text-[#00E5FF]" />
              </div>

              {improvementNotes.length > 0 ? (
                <div className="space-y-2">
                  {improvementNotes.slice(0, 10).map((note, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.02] flex items-start gap-2.5 transition-colors text-left"
                    >
                      <div className="p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                        {note}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center bg-white/[0.01] rounded-xl border border-white/5">
                  <p className="text-[10px] text-slate-500 font-mono italic">No custom notes generated by agent pipeline.</p>
                </div>
              )}
            </div>

            {/* RECRUITER AUDIENCE ALIGNMENT NOTES */}
            {audienceNotes && (
              <div className="p-4.5 rounded-2xl border border-purple-500/15 bg-purple-500/5 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                <h4 className="text-[9px] font-mono font-black uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Target Audience Translation
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed italic">
                  "{audienceNotes}"
                </p>
              </div>
            )}

            {/* INJECTED KEYWORD CLOUD BADGES */}
            {keywordsAdded.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-slate-400 text-left">
                  ATS Keywords Grafted (+{keywordsAdded.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                  {keywordsAdded.map((kw, idx) => (
                    <span 
                      key={idx} 
                      className="text-[9px] font-mono py-0.5 px-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 transition-all hover:bg-emerald-500/15 font-bold"
                    >
                      +{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* KEYWORD GAPS FOR EXECUTIVES */}
            {keywordGap.length > 0 && (
              <div className="space-y-3 pt-1">
                <h4 className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-amber-500/80 text-left">
                  Semantic Gap Detected ({keywordGap.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {keywordGap.map((kw, idx) => (
                    <span 
                      key={idx} 
                      className="text-[9px] font-mono py-0.5 px-2 rounded-full border border-amber-500/10 bg-amber-500/5 text-amber-500/75 font-semibold"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Vertical Resize Handle Divider */}
        {!isMobile && (
          <div
            onMouseDown={(e) => {
              setIsResizing(true);
              e.preventDefault();
            }}
            onDoubleClick={() => {
              setLeftWidth(420);
              localStorage.setItem('resultWorkspaceLeftWidth', '420');
            }}
            className={`hidden lg:flex w-[4px] cursor-col-resize justify-center items-center group z-30 transition-all ${
              isResizing ? 'bg-[#00E5FF] w-[6px]' : 'bg-transparent border-r border-white/5 hover:bg-white/10 hover:w-[6px]'
            }`}
            title="Drag to resize panel (Double-click to reset)"
          >
            <div className={`w-[2px] h-16 rounded-full transition-colors ${isResizing ? 'bg-white' : 'bg-[#ffffff30] group-hover:bg-[#00E5FF]'}`} />
          </div>
        )}

        {/* RIGHT COLUMN: REUSED LIVE PREVIEW WINDOW (SECTION 4) */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#090b0e]">
          
          <div className="shrink-0 py-2 px-6 border-b border-white/5 bg-[#0b0e14]/40 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono font-semibold tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Dynamic Live Preview (A4 Model)
              </span>
              <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewMode('resume')}
                  className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.15em] font-black rounded transition-all cursor-pointer ${
                    viewMode === 'resume'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Formatted Resume
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('json')}
                  className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.15em] font-black rounded transition-all cursor-pointer ${
                    viewMode === 'json'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw JSON View
                </button>
              </div>

              {viewMode === 'resume' && previewMode && setPreviewMode && (
                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('standard')}
                    className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.15em] font-black rounded transition-all cursor-pointer ${
                      previewMode === 'standard'
                        ? 'bg-[#8B5CF6] text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Standard Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('simplified')}
                    className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.15em] font-black rounded transition-all cursor-pointer ${
                      previewMode === 'simplified'
                        ? 'bg-[#8B5CF6] text-white shadow-lg'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Workday Form
                  </button>
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-slate-500 italic">
              Puppeteer print scaling active
            </span>
          </div>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar flex items-start justify-center">
            {viewMode === 'resume' ? (
              /* INJECTED RESUME PREVIEW CONTAINER FROM APP.tsx */
              <div className="relative shadow-2xl rounded-xl overflow-hidden glass-panel border border-white/5 p-4 bg-[#111] max-w-full">
                {children}
              </div>
            ) : (
              /* Raw JSON View */
              <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-neutral-900 shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0 bg-neutral-950">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                      <span className="text-emerald-400 font-mono text-[10px] font-bold">JSON</span>
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-slate-300 font-bold uppercase">Optimized Resume Schema</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(activeResult, null, 2));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1 px-2.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                  >
                    {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <div className="p-5 font-mono text-[10.5px] leading-relaxed text-emerald-400/80 bg-black/30 overflow-auto max-h-[500px] text-left custom-scrollbar select-text selection:bg-emerald-500 selection:text-black">
                  <pre>{JSON.stringify(activeResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: FLOATING EXPORT & ROUTE CONTROLS PANEL */}
          <footer className="shrink-0 p-5 bg-[#0b0e14]/90 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 z-40 relative backdrop-blur-md">
            
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
              <div className="text-left">
                <p className="text-[9px] font-mono font-bold text-slate-400 uppercase leading-none">
                  Nexus Export Hub
                </p>
                <p className="text-[11px] text-slate-300 font-semibold mt-1">
                  Ready to compile portfolio files onto selected destinations
                </p>
              </div>
            </div>

            {/* EXPORT ACTION MATRIX */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* PDF compiler trigger */}
              <button
                id="export-pdf-comp-btn"
                onClick={onDownloadPDF}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-lg hover:shadow-emerald-500/20"
              >
                <FileText className="w-3.5 h-3.5" />
                Download PDF
              </button>

              {/* DOCX output format */}
              <button
                id="export-docx-comp-btn"
                onClick={onDownloadDOCX}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-slate-100 border border-white/15 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                DOCX Document
              </button>

              {/* JSON export structure */}
              <button
                onClick={onDownloadJSON}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Save structure sandbox JSON"
              >
                <FileText className="w-3.5 h-3.5 opacity-75" />
                Export JSON
              </button>

              {/* Cloud Drive sync */}
              <button
                id="export-drive-comp-btn"
                onClick={onSaveToDrive}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
                Save To Drive
              </button>

              {/* Close workspace */}
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Close Studio
              </button>

            </div>

          </footer>

        </div>

      </div>

    </div>
  );
};
export default OptimizationResultWorkspace;
