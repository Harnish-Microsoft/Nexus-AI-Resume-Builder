import React, { useState, useEffect } from 'react';
import { Zap, Brain, History, Trash2, ChevronRight, ChevronDown, CheckCircle2, AlertCircle, FileText, Copy, Download, ShieldAlert, Linkedin, Sparkles } from 'lucide-react';
import { EngineConfig, EngineType, analyzeSkillGap, generateInterviewQuestions, generateCoverLetter, generateRecruiterMessage, optimizeHeadline, generateWhyThisJob, analyzeResumeCritique, selectBestMasterResume, rankMasterResumes } from '../services/geminiService';
import { LinkedInImporter } from './LinkedInImporter';
import { MasterResumeGenerator } from './MasterResumeGenerator';
import { MasterResumeManager } from './MasterResumeManager';
import { ResumeJsonViewer } from './ResumeJsonViewer';
import { NexusProInsights } from './NexusProInsights';
import { ApiDiagnostics } from './ApiDiagnostics';
import { MasterResume } from '../types';

interface AdditionalToolsProps {
  masterResumes: MasterResume[];
  setMasterResumes: React.Dispatch<React.SetStateAction<MasterResume[]>>;
  selectedResumeId: string;
  setSelectedResumeId: React.Dispatch<React.SetStateAction<string>>;
  onSetActive: (id: string) => void;
  onDuplicate: (id: string) => void;
  resumeText: string;
  jobDescription: string;
  targetRole: string;
  companyName?: string;
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: EngineType;
  onRestore?: (version: any) => void;
  currentResults?: any;
  activeAudience?: string | null;
  selectedAudiences?: string[];
  setResumeText: (text: string) => void;
  runOptimization: (overrideResumeText?: string) => Promise<void>;
  currentHeadline?: string;
  resumeSummary?: string;
  keySkills?: string[];
  onToolActive?: (isActive: boolean) => void;
  onSyncMasterResumes?: () => void;
  linkedinProps?: any;
}

export const AdditionalTools: React.FC<AdditionalToolsProps> = ({ 
  masterResumes,
  setMasterResumes,
  selectedResumeId,
  setSelectedResumeId,
  onSetActive,
  onDuplicate,
  resumeText, 
  jobDescription, 
  targetRole,
  companyName,
  isDarkMode, 
  engineConfig, 
  selectedEngine,
  onRestore,
  currentResults,
  activeAudience,
  selectedAudiences,
  setResumeText,
  runOptimization,
  currentHeadline = "",
  resumeSummary = "",
  keySkills = [],
  onToolActive,
  linkedinProps,
  onSyncMasterResumes
}) => {
  const [activeTab, setActiveTab] = useState<'skillGap' | 'interview' | 'history' | 'coverLetter' | 'recruiterMessage' | 'headline' | 'whyThisJob' | 'linkedin' | 'masterResumeGenerator' | 'masterResumeManager' | 'resumeMatcher' | 'audioFeedback' | 'diagnostics' | null>(null);
  const [previewResume, setPreviewResume] = useState<MasterResume | null>(null);
  const [rankedResumes, setRankedResumes] = useState<any[]>([]);
  const [matcherOptions, setMatcherOptions] = useState({ generateCoverLetter: false });

  useEffect(() => {
    if (onToolActive) {
      onToolActive(activeTab !== null);
    }
  }, [activeTab, onToolActive]);
  const [headlineResult, setHeadlineResult] = useState<{headline: string, keywords_used: string[]} | null>(null);
  const [skillGap, setSkillGap] = useState<{missing: string[], present: string[]} | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [recruiterMessage, setRecruiterMessage] = useState<string>('');
  const [whyThisJob, setWhyThisJob] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saveName, setSaveName] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (type === 'error') setError(message);
  };

  const handleDownload = (id: string) => {
    const resume = masterResumes.find(r => r.id === id);
    if (!resume) return;
    const blob = new Blob([JSON.stringify(resume.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resume.name.replace(/\s+/g, '_')}_master.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreview = (id: string) => {
    const resume = masterResumes.find(r => r.id === id);
    if (resume) setPreviewResume(resume);
  };

  const runRanking = async () => {
    if (!jobDescription || masterResumes.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await rankMasterResumes(jobDescription, masterResumes, {
        mode: 'gemini',
        geminiConfig: { engine: 'gemini', model: engineConfig.gemini.model, apiKey: engineConfig.gemini.apiKey },
        openaiConfig: { engine: 'openai', model: engineConfig.openai.model, apiKey: engineConfig.openai.apiKey }
      });
      setRankedResumes(results);
      
      if (matcherOptions.generateCoverLetter && results.length > 0) {
        const best = masterResumes.find(r => r.id === results[0].id);
        if (best) {
          const letter = await generateCoverLetter(jobDescription, JSON.stringify(best.data), targetRole, {
            mode: 'gemini',
            geminiConfig: { engine: 'gemini', model: engineConfig.gemini.model, apiKey: engineConfig.gemini.apiKey },
            openaiConfig: { engine: 'openai', model: engineConfig.openai.model, apiKey: engineConfig.openai.apiKey }
          });
          setCoverLetter(letter);
        }
      }
    } catch (e: any) {
      setError("Ranking failed: " + e.message);
    }
    setIsLoading(false);
  };

  const runOptimizationForJD = async () => {
    if (!jobDescription) return;
    setIsLoading(true);
    try {
      const bestId = await selectBestMasterResume(jobDescription, masterResumes, {
          mode: 'gemini', geminiConfig: { engine: 'gemini', model: engineConfig.gemini.model, apiKey: engineConfig.gemini.apiKey },
          openaiConfig: { engine: 'openai', model: engineConfig.openai.model, apiKey: engineConfig.openai.apiKey }
      });
      if (bestId) {
        setSelectedResumeId(bestId);
        onSetActive(bestId);
        showToast(`AI recommended resume: ${masterResumes.find(r => r.id === bestId)?.name}`, 'success');
        await runOptimization();
      }
    } catch (e) {
      console.error(e);
      setError("AI optimization failed.");
    }
    setIsLoading(false);
  };

  const runSkillGap = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await analyzeSkillGap(resumeText, jobDescription, {
        mode: 'gemini',
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setSkillGap(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to analyze skill gap.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (activeAudience && currentResults && currentResults[activeAudience]) {
      const res = currentResults[activeAudience];
      // If we have keyword gap from the main optimization, use it
      if (res.keyword_gap && res.keyword_gap.length > 0) {
        const newSkillGap = {
          missing: res.keyword_gap,
          present: res.ats_keywords_added_to_resume || []
        };
        
        // Deep compare to prevent infinite loop
        if (JSON.stringify(skillGap) !== JSON.stringify(newSkillGap)) {
          setSkillGap(newSkillGap);
        }
      } else if (activeTab === 'skillGap' && !isLoading && !skillGap) {
        // If missing from results but we are on the tab, try to run it automatically
        runSkillGap();
      }

      // If we have why_this_job from results, use it
      if (res.why_this_job && !whyThisJob) {
        setWhyThisJob(res.why_this_job);
      }
    }
  }, [activeAudience, currentResults, activeTab, isLoading, skillGap, whyThisJob]);

  useEffect(() => {
    const loadHistory = () => {
      const savedHistory = JSON.parse(localStorage.getItem('resumeHistory') || '[]');
      setHistory(savedHistory);
    };
    loadHistory();
    
    window.addEventListener('resumeHistoryUpdated', loadHistory);
    return () => window.removeEventListener('resumeHistoryUpdated', loadHistory);
  }, []);

  const [selectedMissingSkills, setSelectedMissingSkills] = useState<string[]>([]);

  const toggleSkill = (skill: string) => {
    setSelectedMissingSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const addMissingSkills = async () => {
    if (!skillGap || selectedMissingSkills.length === 0) return;
    const newResumeText = `${resumeText}\n\nSkills: ${selectedMissingSkills.join(', ')}`;
    setResumeText(newResumeText);
    await runOptimization(newResumeText);
  };

  const runInterviewQuestions = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateInterviewQuestions(jobDescription, resumeText, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setInterviewQuestions(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate interview questions.");
    }
    setIsLoading(false);
  };

  const runWhyThisJob = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateWhyThisJob(jobDescription, resumeText, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setWhyThisJob(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate Why This Job response.");
    }
    setIsLoading(false);
  };

  const runRecruiterMessage = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateRecruiterMessage(jobDescription, resumeText, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setRecruiterMessage(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate recruiter message.");
    }
    setIsLoading(false);
  };

  const runHeadlineOptimization = async () => {
    if (!targetRole) {
      setError("Please provide a Target Role.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await optimizeHeadline(currentHeadline, resumeSummary, keySkills, targetRole, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setHeadlineResult(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to optimize headline.");
    }
    setIsLoading(false);
  };

  const runCoverLetter = async () => {
    if (!resumeText || !jobDescription) {
      setError("Please ensure both resume and job description are provided.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await generateCoverLetter(jobDescription, resumeText, targetRole, {
        mode: selectedEngine,
        geminiConfig: {
          engine: 'gemini',
          model: engineConfig.gemini.model,
          apiKey: engineConfig.gemini.apiKey
        },
        openaiConfig: {
          engine: 'openai',
          model: engineConfig.openai.model,
          apiKey: engineConfig.openai.apiKey
        }
      });
      setCoverLetter(result);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to generate cover letter.");
    }
    setIsLoading(false);
  };

  const saveVersion = (customName?: string) => {
    const timestamp = new Date().toISOString();
    const newVersion = { 
      id: Date.now(), 
      timestamp,
      name: typeof customName === 'string' ? customName : (saveName || `Version ${new Date(timestamp).toLocaleString()}`),
      data: { 
        resumeText, 
        jobDescription,
        targetRole,
        companyName,
        results: currentResults,
        activeAudience,
        selectedAudiences,
      } 
    };
    const newHistory = [newVersion, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
    window.dispatchEvent(new CustomEvent('resumeHistoryUpdated'));
    if (typeof customName !== 'string') {
      setSaveName('');
    }
  };

  const downloadCoverLetterPDF = async () => {
    if (!coverLetter) return;
    setIsLoading(true);
    try {
      // Save version automatically
      const timestamp = new Date().toISOString();
      let generatedName = '';
      if (companyName && targetRole) {
        generatedName = `${companyName} - ${targetRole} - Cover Letter - ${new Date(timestamp).toLocaleString()}`;
      } else if (companyName) {
        generatedName = `${companyName} - Cover Letter - ${new Date(timestamp).toLocaleString()}`;
      } else if (targetRole) {
        generatedName = `${targetRole} - Cover Letter - ${new Date(timestamp).toLocaleString()}`;
      } else {
        generatedName = `Cover Letter - ${new Date(timestamp).toLocaleString()}`;
      }
      saveVersion(generatedName);

      // Generate PDF
      const html = `
        <div style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; white-space: pre-wrap;">
          ${coverLetter}
        </div>
      `;

      const sessionResponse = await fetch('/api/pdf-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, css: '', fonts: [], title: generatedName.replace(/[^a-zA-Z0-9_-]/g, '_') })
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create PDF session');
      }

      const { sessionId } = await sessionResponse.json();
      
      // Trigger download using fetch/blob for safety
      const pdfResponse = await fetch(`/api/download-pdf/${sessionId}`);
      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`PDF generation failed: ${errorText}`);
      }

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to download PDF.");
    }
    setIsLoading(false);
  };

  const renameVersion = (id: number) => {
    const newHistory = history.map(v => v.id === id ? { ...v, name: newName } : v);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
    setRenamingId(null);
    setNewName('');
  };

  const deleteVersion = (id: number) => {
    const newHistory = history.filter(v => v.id !== id);
    setHistory(newHistory);
    localStorage.setItem('resumeHistory', JSON.stringify(newHistory));
  };

  return (
    <div className={`rounded-xl border p-4 ${isDarkMode ? 'glass-panel border-white/5' : 'glass-panel-light border-black/5'} min-h-[400px]`}>
      
      {!activeTab ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
          <button 
            onClick={() => setActiveTab('resumeMatcher')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'resumeMatcher' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4"/>
              <span className="text-[11px] font-bold">JD-Resume Matcher</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Rank 8 resumes against JD</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('skillGap')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'skillGap' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Gap Analysis</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Find missing keywords</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('linkedin')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'linkedin' 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-blue-500"/>
              <span className="text-[11px] font-bold">LinkedIn Importer</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Import master profile data</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('interview')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'interview' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Interview Prep</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Generate tailored questions</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('coverLetter')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'coverLetter' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Cover Letter</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Draft a matching letter</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('recruiterMessage')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'recruiterMessage' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Recruiter Msg</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Short LinkedIn outreach</span>
          </button>

          <button 
            onClick={() => setActiveTab('headline')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'headline' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Headline Gen</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Optimize profile headline</span>
          </button>

          <button 
            onClick={() => setActiveTab('masterResumeManager')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'masterResumeManager' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Master Manager</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Manage your resumes</span>
          </button>

          <button 
            onClick={() => setActiveTab('masterResumeGenerator')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'masterResumeGenerator' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Resume Gen</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Generate role bullets</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'history' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Version History</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Restore previous versions</span>
          </button>

          <button 
            onClick={() => setActiveTab('audioFeedback')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'audioFeedback' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4"/>
              <span className="text-[11px] font-bold">Audio Feedback</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Listen to career audit</span>
          </button>

          <button 
            onClick={() => setActiveTab('diagnostics')} 
            className={`flex flex-col items-start gap-2 p-3 rounded-xl transition-all border ${
              activeTab === 'diagnostics' 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                : (isDarkMode ? 'glass-card border-white/5 text-white/60 hover:text-white' : 'bg-black/5 border-black/5 text-black/60 hover:bg-black/10 hover:text-black')
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4"/>
              <span className="text-[11px] font-bold">System & Keys</span>
            </div>
            <span className="text-[9px] opacity-70 text-left leading-tight">Diagnostic tools & API keys</span>
          </button>
        </div>
      ) : (
        <div className={`sticky top-0 z-10 flex items-center justify-between -mx-4 p-4 border-b ${isDarkMode ? 'bg-[#141414] border-white/5' : 'bg-white border-black/5'} mb-6`}>
          <button 
            onClick={() => setActiveTab(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-black/70 hover:text-black'
            }`}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Tools
          </button>
          <div className="text-sm font-bold opacity-50 capitalize">
            {activeTab.replace(/([A-Z])/g, ' $1').trim()}
          </div>
        </div>
      )}

      {activeTab === 'linkedin' && linkedinProps && (
        <div className="max-w-3xl mx-auto w-full">
          <LinkedInImporter {...linkedinProps} />
        </div>
      )}
      {activeTab === 'masterResumeManager' && (
        <div className="max-w-3xl mx-auto w-full">
          <MasterResumeManager 
            resumes={masterResumes}
            onAdd={(r) => setMasterResumes([...masterResumes, r])}
            onUpdate={(r) => setMasterResumes(masterResumes.map(m => m.id === r.id ? r : m))}
            onDelete={(id) => setMasterResumes(masterResumes.filter(m => m.id !== id))}
            onSetActive={onSetActive}
            onDuplicate={onDuplicate}
            onDownload={handleDownload}
            onPreview={handlePreview}
            onSync={onSyncMasterResumes}
            selectedId={selectedResumeId}
            onSelect={setSelectedResumeId}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {activeTab === 'resumeMatcher' && (
        <div className="space-y-6">
           <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
              <h4 className="text-sm font-bold mb-3">AI Ranking Engine</h4>
              <div className="space-y-4">
                 <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-emerald-500/30 accent-emerald-500" 
                      checked={matcherOptions.generateCoverLetter}
                      onChange={e => setMatcherOptions({ ...matcherOptions, generateCoverLetter: e.target.checked })}
                    />
                    <span className="text-xs font-bold opacity-70">Auto-generate Cover Letter for top match</span>
                 </label>
                 
                 <button 
                  onClick={runRanking}
                  disabled={isLoading || !jobDescription}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2"
                 >
                   <Sparkles className="w-4 h-4" />
                   {isLoading ? 'Ranking Resumes...' : 'Rank Master Resumes against JD'}
                 </button>
              </div>
           </div>

           {rankedResumes.length > 0 && (
             <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest opacity-50">Ranking Results</h4>
                {rankedResumes.map((res, i) => (
                  <div key={res.id} className={`p-4 rounded-xl border ${i === 0 ? 'bg-emerald-500/10 border-emerald-500/40' : (isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5')}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{res.name}</span>
                          {i === 0 && <span className="text-[9px] px-2 py-0.5 bg-emerald-500 text-black font-bold rounded-full uppercase">Best Fit</span>}
                        </div>
                        <div className="text-[10px] opacity-60 mt-1">{res.reason}</div>
                      </div>
                      <div className="text-xl font-black text-emerald-500">{res.score}%</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                      <div>
                        <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">ATS Analysis</span>
                        <p className="text-[10px] leading-relaxed opacity-80">{res.ats_analysis}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">Skill Gap</span>
                        <div className="flex flex-wrap gap-1">
                          {res.skill_gap.map((s: string, j: number) => (
                            <span key={j} className="text-[9px] px-2 py-0.5 bg-red-500/10 text-red-500 rounded border border-red-500/20">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {i === 0 && (
                      <div className="mt-4 flex gap-2">
                         <button 
                          onClick={() => {
                            setSelectedResumeId(res.id);
                            onSetActive(res.id);
                            setActiveTab(null);
                          }}
                          className="flex-1 bg-emerald-500 text-black font-bold py-2 rounded-lg text-[10px]"
                         >
                           Select & Start Optimization
                         </button>
                      </div>
                    )}
                  </div>
                ))}
             </div>
           )}
        </div>
      )}

      {/* Preview Modal */}
      {previewResume && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border flex flex-col ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{previewResume.name}</h3>
                    <p className="text-xs opacity-50">Master Resume Preview</p>
                  </div>
                </div>
                <button onClick={() => setPreviewResume(null)} className="p-2 hover:bg-white/10 rounded-full">
                  <ChevronRight className="w-6 h-6 rotate-90" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <ResumeJsonViewer data={previewResume.data} isDarkMode={isDarkMode} />
              </div>
              <div className="p-6 border-t border-white/5 flex justify-end gap-3">
                 <button onClick={() => setPreviewResume(null)} className="px-6 py-2 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10">Close</button>
                 <button 
                  onClick={() => {
                    handleDownload(previewResume.id);
                  }}
                  className="px-6 py-2 rounded-xl font-bold text-sm bg-emerald-500 text-black hover:bg-emerald-400"
                 >
                   Download JSON
                 </button>
              </div>
           </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
      
      {activeTab === 'skillGap' && (
        <div className="space-y-4">
          {activeAudience && currentResults && currentResults[activeAudience] && (
            <div className="flex gap-4 mb-4">
              <div className="flex-1 p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-center">
                <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Old Score</div>
                <div className="text-2xl font-black text-gray-400">{currentResults[activeAudience].baseline_score || 0}%</div>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">New Score</div>
                <div className="text-2xl font-black text-emerald-500">{currentResults[activeAudience].match_score || 0}%</div>
              </div>
            </div>
          )}
          <button 
            onClick={runSkillGap} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Skill Gap'}
          </button>
          {skillGap && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] mb-2 uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  Present Skills
                </div>
                <div className="flex flex-wrap gap-1">
                  {skillGap.present.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px]">{s}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] mb-2 uppercase tracking-wider">
                  <AlertCircle className="w-3 h-3" />
                  Missing Skills
                </div>
                <div className="flex flex-wrap gap-2">
                  {skillGap.missing.map((s, i) => (
                    <label key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[9px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedMissingSkills.includes(s)}
                        onChange={() => toggleSkill(s)}
                        className="accent-red-500"
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <button 
                  onClick={addMissingSkills}
                  className="mt-2 w-full bg-red-500 hover:bg-red-400 text-black font-bold py-1 rounded text-[10px] transition-colors"
                >
                  Add Missing Skills
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'interview' && (
        <div className="space-y-4">
          <button 
            onClick={runInterviewQuestions} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Questions'}
          </button>
          {interviewQuestions.length > 0 && (
            <div className="space-y-2">
              {interviewQuestions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 text-[10px] leading-relaxed">
                  <span className="text-emerald-500 font-bold mr-2">Q{i+1}:</span>
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'coverLetter' && (
        <div className="space-y-4">
          <button 
            onClick={runCoverLetter} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Cover Letter'}
          </button>
          {coverLetter && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                {coverLetter}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(coverLetter);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </button>
                <button 
                  onClick={downloadCoverLetterPDF}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Download className="w-3 h-3" />
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'recruiterMessage' && (
        <div className="space-y-4">
          <button 
            onClick={runRecruiterMessage} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Message'}
          </button>
          {recruiterMessage && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                {recruiterMessage}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(recruiterMessage);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'whyThisJob' && (
        <div className="space-y-4">
          <button 
            onClick={runWhyThisJob} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Generating...' : 'Generate Response'}
          </button>
          {whyThisJob && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                {whyThisJob}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(whyThisJob);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'headline' && (
        <div className="space-y-4">
          <button 
            onClick={runHeadlineOptimization} 
            disabled={isLoading} 
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl text-xs transition-colors"
          >
            {isLoading ? 'Optimizing...' : 'Optimize Headline'}
          </button>
          {headlineResult && (
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border text-[10px] leading-relaxed ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
                <div className="font-bold mb-1">Optimized Headline:</div>
                <div className="text-emerald-500">{headlineResult.headline}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {headlineResult.keywords_used.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                    {kw}
                  </span>
                ))}
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(headlineResult.headline);
                }}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-[10px] font-bold transition-all"
              >
                <Copy className="w-3 h-3" />
                Copy Headline
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'audioFeedback' && (
        <div className="max-w-3xl mx-auto w-full">
          <NexusProInsights 
            isDarkMode={isDarkMode}
            starStories={activeAudience && currentResults ? currentResults[activeAudience]?.star_stories : undefined}
            auditReport={activeAudience && currentResults ? currentResults[activeAudience]?.audit_report : undefined}
          />
        </div>
      )}
      {activeTab === 'diagnostics' && (
        <div className="max-w-2xl mx-auto w-full">
          <ApiDiagnostics />
        </div>
      )}
      {activeTab === 'masterResumeGenerator' && (
        <MasterResumeGenerator 
            isDarkMode={isDarkMode} 
            engineConfig={engineConfig} 
            selectedEngine={selectedEngine}
            setResumeText={(text) => {
                const existing = JSON.parse(resumeText || '{}');
                const newResume = { ...existing, experience: [...(existing.experience || []), JSON.parse(text)] };
                setResumeText(JSON.stringify(newResume, null, 2));
            }}
        />
      )}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Version name (e.g. Perfect Version)"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className={`flex-1 px-3 py-2 text-[10px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-black/5 text-black'
              }`}
            />
            <button 
              onClick={() => saveVersion()} 
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-3 rounded-xl text-[10px] transition-colors whitespace-nowrap"
            >
              Save Version
            </button>
          </div>
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className={`text-center text-[10px] py-8 ${isDarkMode ? 'opacity-40' : 'opacity-60'}`}>No saved versions yet.</p>
            ) : (
              history.map((v) => (
                  <div key={v.id} className="group flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all">
                    <div className="flex flex-col flex-1 min-w-0">
                      {renamingId === v.id ? (
                        <div className="flex gap-1">
                          <input 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)}
                            className="bg-black/20 text-[10px] p-1 rounded w-full"
                          />
                          <button onClick={() => renameVersion(v.id)} className="text-emerald-500 text-[10px]">Save</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold truncate">{v.name || `Version ${new Date(v.timestamp).toLocaleString()}`}</span>
                          <span className={`text-[9px] ${isDarkMode ? 'opacity-50' : 'opacity-70'}`}>{new Date(v.timestamp).toLocaleTimeString()}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {renamingId !== v.id && (
                        <button 
                          onClick={() => { setRenamingId(v.id); setNewName(v.name || ''); }}
                          className="p-1.5 rounded hover:bg-white/10 text-emerald-500"
                          title="Rename version"
                        >
                          <span className="text-[10px]">Edit</span>
                        </button>
                      )}
                      <button 
                        onClick={() => onRestore?.(v)}
                        className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                        title="Restore this version"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => deleteVersion(v.id)}
                        className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                        title="Delete version"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};