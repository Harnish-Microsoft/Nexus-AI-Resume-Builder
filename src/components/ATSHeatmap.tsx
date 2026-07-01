import React from 'react';
import { motion } from 'motion/react';
import { HeatmapItem } from '../types';
import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react';

interface ATSHeatmapProps {
  data: HeatmapItem[];
  isDarkMode: boolean;
}

const ATSHeatmap: React.FC<ATSHeatmapProps> = ({ data, isDarkMode }) => {
  if (!data || data.length === 0) return null;

  const getMatchColor = (match: string) => {
    switch (match) {
      case 'matched': return isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'partial': return isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'missing': return isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200';
      default: return isDarkMode ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getMatchIcon = (match: string) => {
    switch (match) {
      case 'matched': return <CheckCircle2 className="w-3 h-3" />;
      case 'partial': return <AlertCircle className="w-3 h-3" />;
      case 'missing': return <XCircle className="w-3 h-3" />;
      default: return <Info className="w-3 h-3" />;
    }
  };

  // Group by category
  const categories = Array.from(new Set(data.map(item => item.category)));

  return (
    <div className={`mt-8 p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/10'}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>ATS Keyword Heatmap</h3>
          <p className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Visualizing how your resume aligns with critical job requirements</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Matched
          </div>
          <div className="flex items-center gap-1.5 text-amber-500">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            Partial
          </div>
          <div className="flex items-center gap-1.5 text-rose-500">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            Missing
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map(category => (
          <div key={category} className="space-y-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              {category}s
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.filter(item => item.category === category).map((item, idx) => (
                <motion.div
                  key={`${category}-${idx}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`group relative px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 cursor-help transition-all hover:scale-105 ${getMatchColor(item.match)}`}
                >
                  {getMatchIcon(item.match)}
                  {item.skill}
                  
                  {/* Tooltip */}
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-[10px] leading-relaxed border ${
                    isDarkMode ? 'bg-slate-900 border-white/10 text-white/70' : 'bg-slate-800 border-black/10 text-white/90'
                  }`}>
                    <div className="font-bold mb-1 uppercase tracking-widest text-[8px] opacity-50">Importance: {item.importance}</div>
                    {item.match === 'matched' && "Found in your resume and aligns with JD."}
                    {item.match === 'partial' && "Similar skill found, but could be strengthened."}
                    {item.match === 'missing' && "Not found. Consider adding this to your resume."}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ATSHeatmap;
