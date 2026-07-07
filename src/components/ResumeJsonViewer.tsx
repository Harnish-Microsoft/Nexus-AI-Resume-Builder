import React from 'react';

interface ResumeJsonViewerProps {
  data: any;
  isDarkMode: boolean;
}

export const ResumeJsonViewer: React.FC<ResumeJsonViewerProps> = ({ data, isDarkMode }) => {
  return (
    <div className={`p-4 font-mono text-[11px] leading-relaxed rounded-xl border ${isDarkMode ? 'bg-black/40 text-emerald-400/80 border-white/10' : 'bg-gray-50 text-emerald-700 border-black/10'} overflow-auto max-h-[60vh] custom-scrollbar`}>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};
