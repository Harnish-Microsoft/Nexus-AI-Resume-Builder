import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Briefcase, Building, IndianRupee, Calendar, Trash2, Loader2, ChevronRight, Search, Star, RefreshCw, Pause, Play, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { getDecryptedKey } from '../services/geminiService';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../lib/firebaseUtils';
import { OperationType } from '../types';

interface JobTrackerProps {
  isDarkMode: boolean;
  engineConfig: Record<string, any>;
  selectedEngine: 'gemini' | 'openai' | 'hybrid';
  onBack: () => void;
  user: User | null;
}

interface JobEntry {
  id: string;
  company: string;
  role: string;
  salary: string;
  skills: string[];
  status: 'Saved' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';
  dateAdded: number;
  jd: string;
  score?: number;
  appliedDate?: number;
}

export const JobTracker: React.FC<JobTrackerProps> = ({ isDarkMode, engineConfig, onBack, user }) => {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newJd, setNewJd] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'active' | 'paused' | 'completed' | 'idle'>('idle');

  const handleReset = () => {
    setNewJd('');
    setSearchQuery('');
    setIsAdding(false);
    setStatus('idle');
  };

  const handlePause = () => {
    setStatus(prev => prev === 'active' ? 'paused' : 'active');
  };

  const handleComplete = () => {
    setStatus('completed');
  };

  useEffect(() => {
    if (!user) {
      setJobs([]);
      setIsLoading(false);
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
      })) as JobEntry[];
      setJobs(jobsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/jobs`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddJob = async () => {
    if (!newJd.trim() || !user) return;
    setIsExtracting(true);

    try {
      const apiKey = await getDecryptedKey(engineConfig.gemini.apiKey);
      if (!apiKey) {
        throw new Error("API key is missing. Please check your settings.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract the following information from this job description. If not found, use "Not specified".\n\nJD:\n${newJd}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING, description: "Company name" },
              role: { type: Type.STRING, description: "Job title" },
              salary: { type: Type.STRING, description: "Salary range or compensation details" },
              skills: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Top 5 must-have skills"
              }
            },
            required: ["company", "role", "salary", "skills"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      
      const newJobData = {
        company: data.company || 'Unknown Company',
        role: data.role || 'Unknown Role',
        salary: data.salary || 'Not specified',
        skills: data.skills || [],
        status: 'Saved',
        dateAdded: Date.now(),
        jd: newJd,
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users', user.uid, 'jobs'), newJobData)
        .catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/jobs`));

      setIsAdding(false);
      setNewJd('');
    } catch (error) {
      console.error("Error extracting job details:", error);
      alert("Failed to extract job details. Please check your API key.");
    }
    setIsExtracting(false);
  };

  const updateStatus = async (id: string, newStatus: JobEntry['status']) => {
    if (!user) return;
    
    const jobRef = doc(db, 'users', user.uid, 'jobs', id);
    const updates: any = { 
      status: newStatus,
      updatedAt: serverTimestamp()
    };
    
    if (newStatus === 'Applied') {
      const currentJob = jobs.find(j => j.id === id);
      if (currentJob && currentJob.status !== 'Applied') {
        updates.appliedDate = Date.now();
      }
    }

    await updateDoc(jobRef, updates)
      .catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/jobs/${id}`));
  };

  const deleteJob = async (id: string) => {
    if (!user) return;
    const jobRef = doc(db, 'users', user.uid, 'jobs', id);
    await deleteDoc(jobRef)
      .catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/jobs/${id}`));
  };

  const stages: JobEntry['status'][] = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected'];

  const filteredJobs = jobs.filter(job => 
    job.role.toLowerCase().includes(searchQuery.toLowerCase()) || 
    job.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[800px] relative">
      <div className={`sticky top-0 z-10 flex items-start sm:items-center justify-between -mx-4 p-4 border-b ${isDarkMode ? 'bg-[#141414] border-white/5' : 'bg-white border-black/5'} mb-6 flex-col sm:flex-row gap-4 pt-16`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold">AI Job Tracker</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs opacity-70">Intelligent pipeline management</p>
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
              disabled={isExtracting}
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
              disabled={status === 'idle' && !newJd}
              className={`p-2 rounded-lg transition-all text-emerald-500 hover:bg-emerald-500/10`}
              title="Complete Session"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input 
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                isDarkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-white border-black/10 text-black'
              }`}
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            disabled={status === 'paused' || status === 'completed'}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        </div>
      </div>

      {isAdding && (
        <div className={`p-4 rounded-xl border mb-6 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/10'}`}>
          <h3 className="font-bold mb-2">Paste Job Description</h3>
          <textarea
            value={newJd}
            onChange={(e) => setNewJd(e.target.value)}
            placeholder="Paste the full job description here. AI will extract the details..."
            className={`w-full h-32 p-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3 ${
              isDarkMode ? 'bg-black/50 border-white/10 text-white' : 'bg-white border-black/10 text-black'
            }`}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleAddJob}
              disabled={isExtracting || !newJd.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
              {isExtracting ? 'Extracting...' : 'Analyze & Add'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {stages.map(stage => (
            <div key={stage} className={`w-80 flex flex-col rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-black/5'}`}>
              <div className="p-3 border-b font-bold flex items-center justify-between opacity-80">
                <span>{stage}</span>
                <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                  {filteredJobs.filter(j => j.status === stage).length}
                </span>
              </div>
              <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                {filteredJobs.filter(j => j.status === stage).map(job => (
                  <div key={job.id} className={`p-3 rounded-lg border shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm leading-tight">{job.role} - {job.company}</h4>
                      <button onClick={() => deleteJob(job.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded opacity-50 hover:opacity-100 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-xs opacity-70 mb-3">
                      <IndianRupee className="w-3 h-3" />
                      <span>{job.salary}</span>
                    </div>
                    
                    {job.score !== undefined && (
                      <div className="flex items-center gap-1 text-xs text-emerald-500 font-bold mb-3">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Match Score: {job.score}%</span>
                      </div>
                    )}

                    {job.appliedDate && job.status !== 'Saved' && (
                      <div className="flex items-center gap-1 text-[10px] opacity-60 mb-3">
                        <Calendar className="w-3 h-3" />
                        <span>Applied: {new Date(job.appliedDate).toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {job.skills.slice(0, 3).map((skill, i) => (
                        <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}>
                          +{job.skills.length - 3}
                        </span>
                      )}
                    </div>

                    <select
                      value={job.status}
                      onChange={(e) => updateStatus(job.id, e.target.value as any)}
                      className={`w-full text-xs p-1.5 rounded border focus:outline-none ${
                        isDarkMode ? 'bg-black text-white border-white/10' : 'bg-white text-black border-black/10'
                      }`}
                    >
                      {stages.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
