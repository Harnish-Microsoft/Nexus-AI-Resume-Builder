import React, { useState, useEffect } from 'react';
import { ChevronLeft, Key, Sparkles, Copy, Check, Info, FileText, BrainCircuit, Target, ListChecks, ArrowRight, RefreshCw, Pause, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractSkillsFromJD } from '../services/geminiService';
import { RouterConfig } from '../services/aiRouter';
import masterResume from '../services/master_resume.json';

interface SkillExtractorProps {
  isDarkMode: boolean;
  resumeData: any;
  onBack: () => void;
  engineConfig: any;
  initialJd?: string;
}

export const SkillExtractor: React.FC<SkillExtractorProps> = ({ isDarkMode, resumeData, onBack, engineConfig, initialJd }) => {
  const [jdText, setJdText] = useState(initialJd || '');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    missing: string[];
    matching: string[];
    priority: string[];
  } | null>(null);
  const [skillAssessment, setSkillAssessment] = useState<{
    extractedSkills: string[];
    faangSuggestions: string[];
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<{ type: string; index: number } | null>(null);
  const [status, setStatus] = useState<'active' | 'paused' | 'completed' | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleAssessSkills = async () => {
    setIsAssessing(true);
    setError(null);
    try {
      const resumeText = typeof resumeData === 'string' ? resumeData : JSON.stringify(resumeData);
      const routerConfig: RouterConfig = {
        mode: 'production',
        geminiConfig: engineConfig.gemini,
        openaiConfig: engineConfig.openai
      };
      const result = await import('../services/geminiService').then(s => s.performSkillAssessment(resumeText, routerConfig));
      setSkillAssessment(result);
    } catch (error: any) {
      console.error('Assessment failed:', error);
      setError("Failed to perform skill assessment.");
    } finally {
      setIsAssessing(false);
    }
  };

  const masterSkills = Array.isArray((masterResume as any).core_competencies) 
    ? (masterResume as any).core_competencies.map((c: any) => c.skill)
    : typeof masterResume.skills === 'object' && !Array.isArray(masterResume.skills)
      ? Object.values(masterResume.skills).flat() as string[]
      : Array.isArray(masterResume.skills)
        ? masterResume.skills
        : [];

  const handleExtract = async (forcedJd?: string) => {
    const textToExtract = forcedJd || jdText;
    if (!textToExtract.trim() || status === 'paused' || status === 'completed') return;
    setIsExtracting(true);
    setStatus('active');
    setError(null);
    try {
      const resumeText = typeof resumeData === 'string' ? resumeData : JSON.stringify(resumeData);
      const routerConfig: RouterConfig = {
        mode: 'production',
        geminiConfig: engineConfig.gemini,
        openaiConfig: engineConfig.openai
      };
      const result = await extractSkillsFromJD(textToExtract, resumeText, routerConfig);
      if (!result.priority.length && !result.matching.length && !result.missing.length) {
        throw new Error("AI could not extract any meaningful skills. Please try with more descriptive Job Description.");
      }
      setExtractedData(result);
    } catch (error: any) {
      console.error('Extraction failed:', error);
      setError(error.message || "Failed to extract skills. Please check your connection or JD content.");
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    if (initialJd && initialJd.trim() && !extractedData && !isExtracting) {
      handleExtract(initialJd);
    }
  }, [initialJd]);

  const handleReset = () => {
    setJdText('');
    setExtractedData(null);
    setStatus('idle');
  };

  const handlePause = () => {
    setStatus(prev => prev === 'active' ? 'paused' : 'active');
  };

  const handleComplete = () => {
    setStatus('completed');
  };

  const copyToClipboard = (text: string, type: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex({ type, index });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-inherit overflow-hidden">
      <div className={`sticky top-0 z-10 flex items-center justify-between p-6 border-b ${isDarkMode ? 'glass-thin border-white/5' : 'bg-white border-black/5'} pt-16`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`p-3 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6 text-emerald-500" />
              Skill Portal Optimizer
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-sm opacity-70">Compare JD against Master Resume to find keywords.</p>
              <div className={`w-1.5 h-1.5 rounded-full ${
                status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                status === 'paused' ? 'bg-amber-500' : 
                status === 'completed' ? 'bg-blue-500' : 'bg-gray-500'
              }`} />
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">{status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status !== 'completed' && (
            <button
              onClick={handlePause}
              disabled={isExtracting || status === 'idle' && !jdText}
              className={`p-2 rounded-lg transition-all ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
              } ${status === 'paused' ? 'text-amber-500 bg-amber-500/10' : ''}`}
              title={status === 'paused' ? "Resume" : "Pause"}
            >
              {status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}
          
          <button
            onClick={handleReset}
            className={`p-2 rounded-lg transition-all ${
              isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
            }`}
            title="Start New Session"
          >
            <RefreshCw className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} />
          </button>

          {status !== 'completed' && (
            <button
              onClick={handleComplete}
              disabled={status === 'idle'}
              className={`p-2 rounded-lg transition-all text-emerald-500 hover:bg-emerald-500/10`}
              title="Complete Session"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative">
        <AnimatePresence>
          {status === 'paused' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-[2px] flex items-center justify-center"
            >
              <div className={`px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-2xl border ${
                isDarkMode ? 'bg-neutral-900 border-white/10 text-amber-500' : 'bg-white border-black/10 text-amber-600'
              }`}>
                Session Paused
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto space-y-8 pb-12">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Input or Priority */}
            <div className="lg:col-span-2 space-y-6">
              {!extractedData ? (
                <div className={`p-8 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-panel border-white/10' : 'bg-white border-black/10'}`}>
                  <label className="block text-sm font-bold uppercase tracking-widest opacity-40 mb-4">Paste Job Description</label>
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    disabled={status === 'paused' || status === 'completed'}
                    className={`w-full h-80 p-6 rounded-2xl border focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all font-mono text-sm leading-relaxed ${
                      isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-black/10 text-black'
                    } ${status === 'completed' ? 'opacity-50' : ''}`}
                    placeholder={status === 'completed' ? "Session completed. Start a new one to continue." : "Enter the full job posting details here to extract target keywords..."}
                  />
                  <button
                    onClick={() => handleExtract()}
                    disabled={isExtracting || !jdText.trim() || status === 'paused' || status === 'completed'}
                    className="w-full mt-8 py-5 rounded-2xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20 text-lg"
                  >
                    {isExtracting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          <Sparkles className="w-6 h-6" />
                        </motion.div>
                        Extracting AI Keywords...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="w-6 h-6" />
                        Generate Optimized Keywords
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleAssessSkills()}
                    disabled={isAssessing}
                    className={`w-full mt-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                      isDarkMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {isAssessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                    {isAssessing ? 'Analyzing...' : 'Run FAANG Skills Assessment'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Priority / High-Impact Skills */}
                  <div className={`p-8 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-panel border-white/10' : 'bg-white border-black/10'}`}>
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-3">
                          <Target className="w-6 h-6 text-amber-500" />
                          High-Yield Keywords (Add to Portal)
                        </h3>
                        <button 
                          onClick={() => setExtractedData(null)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                        >
                          NEW ANALYSIS
                        </button>
                     </div>
                     <div className="flex flex-wrap gap-3">
                        {extractedData.priority.map((skill, idx) => (
                          <button
                            key={idx}
                            onClick={() => copyToClipboard(skill, 'priority', idx)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                              isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 border-amber-500/20 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            {skill}
                            {copiedIndex?.type === 'priority' && copiedIndex.index === idx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 opacity-30" />}
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Missing Skills */}
                    <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                      <h3 className="font-bold text-red-500 mb-4 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Gaps to Bridge
                      </h3>
                      <div className="space-y-3">
                        {extractedData.missing.map((skill, idx) => (
                          <div key={idx} className="flex items-center justify-between group p-2 rounded-xl hover:bg-red-500/5">
                            <span className="text-sm font-medium opacity-80">{skill}</span>
                            <button onClick={() => copyToClipboard(skill, 'missing', idx)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/10 rounded-lg">
                              {copiedIndex?.type === 'missing' && copiedIndex.index === idx ? <Check className="w-3.5 h-3.5 text-red-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Matching Skills */}
                    <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                      <h3 className="font-bold text-emerald-500 mb-4 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        JD Matches
                      </h3>
                      <div className="space-y-3">
                        {extractedData.matching.map((skill, idx) => (
                          <div key={idx} className="flex items-center justify-between group p-2 rounded-xl hover:bg-emerald-500/5">
                            <span className="text-sm font-medium opacity-80">{skill}</span>
                            <button onClick={() => copyToClipboard(skill, 'matching', idx)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-emerald-500/10 rounded-lg">
                              {copiedIndex?.type === 'matching' && copiedIndex.index === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Master Resume Skills */}
            <div className="space-y-6">
              <div className={`p-6 rounded-3xl border flex flex-col h-full ${isDarkMode ? 'glass-thick border-white/10' : 'bg-white border-black/10'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
                    <ListChecks className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-bold text-lg">Master Skills Bank</h3>
                </div>
                
                <p className="text-xs opacity-50 mb-6 leading-relaxed">
                  These are all skills from your Master Resume. Use this list to quickly find and copy keywords for Workday/Portal "Skills" sections.
                </p>

                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                  {masterSkills.map((skill, idx) => {
                    const isMatching = extractedData?.matching.includes(skill);
                    return (
                      <div key={idx} className="flex items-center justify-between group p-3 rounded-2xl transition-all hover:bg-white/5 border border-transparent hover:border-white/10">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-sm font-bold ${isMatching ? 'text-emerald-500' : ''}`}>{skill}</span>
                          {isMatching && <span className="text-[10px] text-emerald-500/50 font-bold uppercase tracking-widest flex items-center gap-1">Matches Job <ArrowRight className="w-2 h-2" /></span>}
                        </div>
                        <button 
                          onClick={() => copyToClipboard(skill, 'master', idx)} 
                          className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          {copiedIndex?.type === 'master' && copiedIndex.index === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {skillAssessment && (
            <div className={`p-8 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-panel border-white/10' : 'bg-white border-black/10'}`}>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <BrainCircuit className="w-6 h-6 text-blue-500" />
                FAANG Skills Assessment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-bold mb-4 opacity-70">Skills Detected</h4>
                  <div className="flex flex-wrap gap-2">
                    {skillAssessment.extractedSkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-bold bg-gray-500/10">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold mb-4 text-blue-500">FAANG Suggestions</h4>
                  <div className="flex flex-wrap gap-2">
                    {skillAssessment.faangSuggestions.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};