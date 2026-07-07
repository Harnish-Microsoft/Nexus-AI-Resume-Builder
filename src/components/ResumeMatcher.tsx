import React, { useState } from 'react';
import { Sparkles, FileText, CheckCircle, AlertTriangle, Briefcase } from 'lucide-react';
import { MasterResume } from '../types';

interface ResumeMatcherProps {
  resumes: MasterResume[];
  isDarkMode: boolean;
}

export const ResumeMatcher: React.FC<ResumeMatcherProps> = ({ resumes, isDarkMode }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [generateCoverLetter, setGenerateCoverLetter] = useState(false);

  const handleMatch = async () => {
    if (!jobDescription || resumes.length === 0) return;
    setIsAnalyzing(true);
    try {
        const response = await fetch('/api/match-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumes, jobDescription, generateCoverLetter })
        });
        const data = await response.json();
        setAnalysisResult(data);
    } catch (e) {
        console.error(e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'} space-y-4`}>
        <h3 className="text-lg font-bold">Automatic Resume Matcher</h3>
        <textarea 
            className={`w-full p-4 rounded-xl text-sm ${isDarkMode ? 'bg-white/10' : 'bg-black/5'}`}
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste Job Description here..."
            rows={6}
        />
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateCoverLetter} onChange={e => setGenerateCoverLetter(e.target.checked)} />
            Generate Tailored Cover Letter
        </label>
        <button 
            onClick={handleMatch}
            disabled={isAnalyzing || !jobDescription}
            className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
            <Sparkles className="w-4 h-4" /> {isAnalyzing ? 'Analyzing...' : 'Analyze & Rank Resumes'}
        </button>

        {analysisResult && (
            <div className="mt-6 space-y-4">
                {/* Display analysisResult here: best fit resume, ATS analysis, skill gap, etc. */}
                <h4 className="font-bold">Best Fit Resume: {analysisResult.bestResume.name}</h4>
                {/* ... display other results */}
            </div>
        )}
    </div>
  );
};
