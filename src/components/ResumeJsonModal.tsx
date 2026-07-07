import React from 'react';
import { useResumeStore } from '../store';
import { ResumeJsonViewer } from './ResumeJsonViewer';

interface ResumeJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResumeJsonModal: React.FC<ResumeJsonModalProps> = ({ isOpen, onClose }) => {
  const { results, activeAudience, data } = useResumeStore();

  if (!isOpen) return null;

  const currentResumeData = activeAudience && results[activeAudience] 
    ? results[activeAudience] 
    : data;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(currentResumeData, null, 2));
    alert('JSON copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(currentResumeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resume-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <span className="text-emerald-400 font-mono text-xs font-bold">JSON</span>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Resume Data Structure</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-auto bg-black/40">
          <ResumeJsonViewer data={currentResumeData} isDarkMode={true} />
        </div>

        <div className="p-4 border-t border-white/10 flex items-center justify-end gap-3 bg-neutral-900 flex-shrink-0">
          <button 
             onClick={handleCopy} 
             className="px-4 py-2 hover:bg-white/5 text-white/60 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
          >
            Copy to Clipboard
          </button>
          <button 
             onClick={handleDownload} 
             className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
          >
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
};
