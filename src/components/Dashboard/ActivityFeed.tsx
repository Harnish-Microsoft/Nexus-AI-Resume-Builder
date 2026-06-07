import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Database, 
  Cpu, 
  Layers, 
  FileCheck2, 
  FileDown, 
  CheckCircle2, 
  Clock, 
  Share2 
} from 'lucide-react';
import { MasterResume } from '../../types';

interface ActivityLog {
  id: string;
  time: string;
  message: string;
  icon: any;
  type: 'info' | 'success' | 'warning' | 'action';
}

interface ActivityFeedProps {
  isDarkMode: boolean;
  selectedResumeId: string;
  masterResumes: MasterResume[];
  isOptimizing: boolean;
  isSyncing: boolean;
  isDownloading: boolean;
  results: Record<string, any>;
  activeAudience: string | null;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  isDarkMode,
  selectedResumeId,
  masterResumes,
  isOptimizing,
  isSyncing,
  isDownloading,
  results,
  activeAudience
}) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const defaultResumeName = masterResumes.find(r => r.id === selectedResumeId)?.name || 'Default Resume';
    return [
      {
        id: '1',
        time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message: 'Nexus AI platform shell booted in workspace.',
        icon: Cpu,
        type: 'success'
      },
      {
        id: '2',
        time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        message: `Indexed master profile: ${defaultResumeName}`,
        icon: Layers,
        type: 'info'
      }
    ];
  });

  // Track previous states to trigger logs on state transition
  const prevResumeId = useRef(selectedResumeId);
  const prevIsOptimizing = useRef(isOptimizing);
  const prevIsSyncing = useRef(isSyncing);
  const prevIsDownloading = useRef(isDownloading);

  const addLog = (message: string, icon: any, type: 'info' | 'success' | 'warning' | 'action') => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      icon,
      type
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // limit visible list to last 50
  };

  useEffect(() => {
    // 1. Resume Selected
    if (selectedResumeId !== prevResumeId.current) {
      const activeName = masterResumes.find(r => r.id === selectedResumeId)?.name || 'Specified Master Resume';
      addLog(`Switched active resume profile matrix: ${activeName}`, Layers, 'info');
      prevResumeId.current = selectedResumeId;
    }

    // 2. Optimization Started / Complete
    if (isOptimizing !== prevIsOptimizing.current) {
      if (isOptimizing) {
        addLog('Initiating ATS Core targeting alignment optimizer...', Cpu, 'action');
      } else {
        const scoreVal = activeAudience && results[activeAudience]?.match_score;
        if (scoreVal) {
          addLog(`ATS Optimization complete! Generated ${scoreVal}% score alignment matrix.`, FileCheck2, 'success');
        } else {
          addLog('ATS Optimization completed successfully.', FileCheck2, 'success');
        }
      }
      prevIsOptimizing.current = isOptimizing;
    }

    // 3. Sync State Updated
    if (isSyncing !== prevIsSyncing.current) {
      if (isSyncing) {
        addLog('Syncing profile indexes to cloud index...', Database, 'action');
      } else {
        addLog('Cloud database indexes synced.', Database, 'success');
      }
      prevIsSyncing.current = isSyncing;
    }

    // 4. Export Generated
    if (isDownloading !== prevIsDownloading.current) {
      if (isDownloading) {
        addLog('Generating paginated high-fidelity download artifact...', FileDown, 'action');
      } else {
        addLog('High-fidelity download artifact exported.', FileDown, 'success');
      }
      prevIsDownloading.current = isDownloading;
    }

  }, [selectedResumeId, isOptimizing, isSyncing, isDownloading, masterResumes, results, activeAudience]);

  return (
    <div className={`p-6 rounded-3xl border select-none transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
      isDarkMode 
        ? 'glass-card-dark border-white/10 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
        : 'glass-card border-black/10 text-slate-800 shadow-[0_12px_30px_rgba(0,0,0,0.05)]'
    }`} id="activity-feed">
      
      <div className="flex items-center justify-between mb-4.5 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4.5 h-4.5 text-emerald-400" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
            Activity Workspace Tracker
          </h3>
        </div>
        <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest font-black">Live Streams</span>
      </div>

      <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
        {logs.map((log) => {
          const LogIcon = log.icon;

          return (
            <div 
              key={log.id} 
              className="flex items-start gap-3 p-2.5 rounded-xl transition-all hover:bg-white/[0.02]"
            >
              {/* Type colored icon container */}
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 border ${
                log.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                  : log.type === 'action'
                    ? 'bg-purple-500/10 border-purple-500/15 text-purple-400'
                    : log.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/15 text-amber-500'
                      : 'bg-white/5 border-white/10 text-slate-400'
              }`}>
                <LogIcon className="w-3.5 h-3.5" />
              </div>

              {/* Text detail */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10.5px] leading-relaxed text-slate-200">
                  {log.message}
                </p>
                <span className="text-[8px] font-mono opacity-40 mt-1 block">
                  {log.time} • Workspace Local
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ActivityFeed;
