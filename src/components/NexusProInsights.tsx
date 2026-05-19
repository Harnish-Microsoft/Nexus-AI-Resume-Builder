import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Target, 
  MapPin, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle, 
  TrendingUp, 
  Zap, 
  MessageSquare, 
  UserCheck, 
  ShieldAlert,
  ArrowUpRight,
  Lightbulb,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { StarStory, AuditReport, FAANGInsights } from '../types';

interface NexusProInsightsProps {
  isDarkMode: boolean;
  starStories?: StarStory[];
  auditReport?: AuditReport;
  faangInsights?: FAANGInsights;
}

export const NexusProInsights: React.FC<NexusProInsightsProps> = ({ isDarkMode, starStories, auditReport }) => {
  const [activeTab, setActiveTab] = useState<'interview' | 'audit' | 'faang'>('interview');
  const [expandedStar, setExpandedStar] = useState<number | null>(null);

  const faangInsights = auditReport?.faangInsights;

  if (!starStories && !auditReport) {
    return (
      <div className={`p-8 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center ${
        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/10'
      }`}>
        <Sparkles className="w-8 h-8 text-purple-500 mb-4 opacity-30" />
        <h4 className="text-sm font-bold uppercase tracking-widest opacity-40">Nexus Pro Intelligence</h4>
        <p className="text-xs opacity-30 mt-2 max-w-[200px]">Run optimization to unlock STAR stories and career audit insights.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border shadow-2xl overflow-hidden flex flex-col h-full ${
      isDarkMode ? 'bg-[#0F0F0F] border-white/10' : 'bg-white border-black/10'
    }`}>
      {/* Header */}
      <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Nexus Pro Insights</h3>
            <p className="text-[10px] opacity-40 font-medium">Post-Optimization Intelligence</p>
          </div>
        </div>

        <div className={`flex p-1 rounded-full border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-black/5 border-black/5'}`}>
          <button 
            onClick={() => setActiveTab('interview')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'interview' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Interview
          </button>
          <button 
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'audit' 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Audit
          </button>
          {faangInsights && (
            <button 
              onClick={() => setActiveTab('faang')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'faang' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Target
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'interview' && (
            <motion.div 
              key="interview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">STAR Method Companion</h4>
              </div>

              {!starStories?.length ? (
                <div className="p-12 text-center opacity-30 text-xs italic">No STAR stories generated for this audience.</div>
              ) : (
                starStories.map((star, idx) => (
                  <div 
                    key={idx}
                    className={`rounded-2xl border transition-all ${
                      expandedStar === idx 
                        ? (isDarkMode ? 'bg-white/5 border-purple-500/50' : 'bg-purple-50 border-purple-200')
                        : (isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-black/5')
                    }`}
                  >
                    <button 
                      onClick={() => setExpandedStar(expandedStar === idx ? null : idx)}
                      className="w-full p-4 flex items-start gap-4 text-left"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                        <Target className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-[11px] font-bold leading-relaxed">{star.bullet}</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${expandedStar === idx ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {expandedStar === idx && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={`px-4 pb-4 pt-0 space-y-4`}>
                            <div className="grid grid-cols-2 gap-3">
                              <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-black/40' : 'bg-white shadow-sm'}`}>
                                <div className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-1">Situation</div>
                                <p className="text-[10px] opacity-70 leading-relaxed">{star.situation}</p>
                              </div>
                              <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-black/40' : 'bg-white shadow-sm'}`}>
                                <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Task</div>
                                <p className="text-[10px] opacity-70 leading-relaxed">{star.task}</p>
                              </div>
                            </div>
                            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-black/40' : 'bg-white shadow-sm'}`}>
                              <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Action</div>
                              <p className="text-[10px] opacity-70 leading-relaxed">{star.action}</p>
                            </div>
                            <div className={`p-3 rounded-xl bg-gradient-to-r ${isDarkMode ? 'from-emerald-500/10 to-blue-500/10' : 'from-emerald-50 to-blue-50'}`}>
                              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Result</div>
                              <p className="text-[10px] font-medium leading-relaxed">{star.result}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Career Velocity Visualizer */}
              {auditReport?.trajectory && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-500">Career Velocity Analysis</h4>
                  </div>

                  <div className={`p-5 rounded-3xl border relative overflow-hidden ${
                    isDarkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50/50 border-blue-200'
                  }`}>
                    {/* Trajectory visualization */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                        auditReport.trajectory.stage === 'acceleration' ? 'border-emerald-500 bg-emerald-500/10' : 
                        auditReport.trajectory.stage === 'growth' ? 'border-blue-500 bg-blue-500/10' :
                        'border-amber-500 bg-amber-500/10'
                      }`}>
                        {auditReport.trajectory.stage === 'acceleration' ? <Zap className="w-6 h-6 text-emerald-500" /> :
                         auditReport.trajectory.stage === 'growth' ? <TrendingUp className="w-6 h-6 text-blue-500" /> :
                         <ShieldAlert className="w-6 h-6 text-amber-500" />}
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tighter">Status: {auditReport.trajectory.stage}</div>
                        <p className="text-[11px] font-medium opacity-60">Visualizing career progression & scope.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-[9px] font-bold uppercase opacity-50 mb-1">Trajectory Insight</div>
                        <p className="text-[11px] font-medium leading-relaxed">{auditReport.trajectory.description}</p>
                      </div>
                      <div className={`p-3 rounded-xl border border-dashed ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-black/10'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Pro Recommendation</span>
                        </div>
                        <p className="text-[10px] opacity-70 italic">{auditReport.trajectory.recommendation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Red Flag Auditor */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-500">Recruiter "Red Flag" Auditor</h4>
                </div>

                <div className="space-y-3">
                  {!auditReport?.flags?.length ? (
                    <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center ${
                      isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">0 Red Flags Detected</p>
                      <p className="text-[9px] opacity-50 mt-1">Your resume aligns with professional industry standards.</p>
                    </div>
                  ) : (
                    auditReport.flags.map((flag) => (
                      <div 
                        key={flag.id}
                        className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                          isDarkMode 
                            ? (flag.severity === 'high' ? 'bg-red-500/5 border-red-500/30' : 'bg-amber-500/5 border-amber-500/30') 
                            : (flag.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200')
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          flag.severity === 'high' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-tighter">{flag.type}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                              flag.severity === 'high' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                            }`}>
                              {flag.severity}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium leading-relaxed mb-2">{flag.message}</p>
                          <div className={`text-[10px] font-bold flex items-center gap-1.5 ${
                            isDarkMode ? 'text-white/60' : 'text-black/60'
                          }`}>
                            <ArrowUpRight className="w-3 h-3" />
                            Fix: {flag.fix}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'faang' && faangInsights && (
            <motion.div 
              key="faang"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-500">{faangInsights.company} - DNA Alignment</h4>
                  <p className="text-[10px] opacity-40 font-medium">Tailored for corporate culture & requirements.</p>
                </div>
              </div>

              <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/10'}`}>
                <p className="text-[11px] font-medium leading-relaxed italic opacity-70 mb-4">"{faangInsights.summary}"</p>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-2">Priority Keywords</div>
                    <div className="flex flex-wrap gap-1.5">
                      {faangInsights.keywords.map((kw, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-bold ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Required Skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {faangInsights.skills.map((s, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-bold ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {faangInsights.leadership_principles && (
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-purple-500 mb-2">Leadership Principles</div>
                      <div className="flex flex-wrap gap-1.5">
                        {faangInsights.leadership_principles.map((lp, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded text-[9px] font-bold ${isDarkMode ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                            {lp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl border border-dashed ${isDarkMode ? 'bg-black/20 border-white/10' : 'bg-white border-black/10'}`}>
                    <div className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-2">Culture Alignment Tips</div>
                    <ul className="space-y-1.5">
                      {faangInsights.culture_alignment_tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-[10px] opacity-70">
                          <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Readiness Score (Always visible if not in faang tab) */}
      {activeTab !== 'faang' && (
        <div className={`p-6 border-t bg-gradient-to-br ${
          isDarkMode ? 'from-purple-900/40 to-blue-900/40 border-white/5' : 'from-purple-50 to-blue-50 border-black/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Executive Readiness Score</h4>
              <p className="text-[9px] opacity-40 font-medium">Weighted assessment of impact & trajectory.</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black">{auditReport?.score || 0}</span>
              <span className="text-xs font-bold opacity-30">/ 100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
