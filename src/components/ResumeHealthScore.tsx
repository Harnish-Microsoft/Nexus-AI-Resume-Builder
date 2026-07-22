import React, { useMemo } from 'react';
import { Activity, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const ACTION_VERBS = [
  'achieved', 'improved', 'trained', 'managed', 'created', 'resolved', 'launched',
  'developed', 'increased', 'decreased', 'reduced', 'led', 'designed', 'delivered',
  'implemented', 'optimized', 'spearheaded', 'orchestrated', 'negotiated', 'maximized',
  'streamlined', 'pioneered', 'transformed', 'executed', 'facilitated', 'guided'
];

const CLICHES = [
  'hardworking', 'team player', 'synergy', 'go-getter', 'thought leadership', 
  'detail-oriented', 'results-driven', 'dynamic', 'think outside the box', 'self-starter',
  'motivated'
];

interface ResumeHealthScoreProps {
  resumeText: string;
  isDarkMode: boolean;
}

export const ResumeHealthScore: React.FC<ResumeHealthScoreProps> = ({ resumeText, isDarkMode }) => {
  const healthData = useMemo(() => {
    if (!resumeText || resumeText.trim().length < 50) {
      return null;
    }

    const text = resumeText.toLowerCase();
    
    // 1. Word Count
    const words = resumeText.trim().split(/\s+/);
    const wordCount = words.length;
    let wordCountScore = 100;
    if (wordCount < 200) wordCountScore = 50;
    else if (wordCount > 1000) wordCountScore = 70;
    
    // 2. Bullet Points
    const bulletLines = resumeText.split('\n').filter(line => /^\s*[-•*]\s/.test(line));
    const bulletCount = bulletLines.length;
    let bulletScore = Math.min((bulletCount / 10) * 100, 100);
    
    // 3. Action Verbs
    const foundVerbs = ACTION_VERBS.filter(verb => text.includes(verb));
    let actionVerbScore = Math.min((foundVerbs.length / 5) * 100, 100);
    
    // 4. Measurable Metrics (numbers/percentages)
    const metricsCount = (resumeText.match(/\d+%?|\$\d+/g) || []).length;
    let metricsScore = Math.min((metricsCount / 5) * 100, 100);
    
    // 5. Cliches
    const foundCliches = CLICHES.filter(cliche => text.includes(cliche));
    let clicheScore = 100 - Math.min(foundCliches.length * 20, 100);

    const overallScore = Math.round(
      (wordCountScore + bulletScore + actionVerbScore + metricsScore + clicheScore) / 5
    );

    return {
      overallScore,
      metrics: [
        { label: 'Word Count', value: wordCount, score: wordCountScore, ideal: '400-800' },
        { label: 'Bullet Points', value: bulletCount, score: bulletScore, ideal: '10+' },
        { label: 'Action Verbs', value: foundVerbs.length, score: actionVerbScore, ideal: '5+' },
        { label: 'Measurables', value: metricsCount, score: metricsScore, ideal: '5+' },
        { label: 'Cliches Used', value: foundCliches.length, score: clicheScore, ideal: '0' }
      ]
    };
  }, [resumeText]);

  if (!healthData) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (score >= 60) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h3 className={`font-bold text-sm tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Resume Health Score</h3>
        </div>
        <div className={`text-xl font-black ${getScoreColor(healthData.overallScore)}`}>
          {healthData.overallScore}/100
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {healthData.metrics.map((metric, i) => (
          <div key={i} className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${getBgColor(metric.score)}`}>
            <div className="mb-1">{getIcon(metric.score)}</div>
            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-white/70' : 'text-slate-500'}`}>{metric.label}</div>
            <div className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{metric.value}</div>
            <div className={`text-[9px] ${isDarkMode ? 'text-white/50' : 'text-slate-400'}`}>Target: {metric.ideal}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
