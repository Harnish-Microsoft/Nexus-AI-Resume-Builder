import React from 'react';
import { 
  Cpu, 
  Cloud, 
  CircleDot, 
  Database, 
  HardDrive, 
  Sparkles, 
  Settings, 
  FileDown, 
  RefreshCw 
} from 'lucide-react';

interface StatusFooterProps {
  isDarkMode: boolean;
  syncStatus?: 'syncing' | 'synced' | 'local' | string;
  currentEngine?: string;
  isDriveConnected?: boolean;
  isExporting?: boolean;
  exportType?: 'pdf' | 'docx' | 'json' | string | null;
  activeAudience?: string | null;
  optimizationProgress?: number;
}

export const StatusFooter: React.FC<StatusFooterProps> = ({
  isDarkMode,
  syncStatus = 'synced',
  currentEngine = 'balanced',
  isDriveConnected = false,
  isExporting = false,
  exportType = null,
  activeAudience = null,
  optimizationProgress = 100
}) => {
  return (
    <footer className={`h-11 shrink-0 w-full px-6 flex items-center justify-between border-t transition-all duration-300 font-mono text-[9px] uppercase tracking-wider select-none ${
      isDarkMode ? 'bg-[#060709] border-white/5 text-white/50' : 'bg-white border-neutral-200 text-neutral-500'
    }`}>
      {/* Platform engine indicators */}
      <div className="flex items-center gap-4.5">
        <div className="flex items-center gap-1.5 group">
          <Cpu className="w-3.5 h-3.5 opacity-60 text-emerald-400 group-hover:rotate-12 transition-transform" />
          <span className="font-extrabold text-[10px] tracking-widest text-emerald-400">NEXUS CORE ACTIVE</span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <span>Engine Model:</span>
          <span className={`font-black p-1 py-0.5 rounded ${
            isDarkMode ? 'bg-white/5 text-white' : 'bg-neutral-100 text-neutral-900'
          }`}>
            {currentEngine}
          </span>
        </div>

        {activeAudience && activeAudience !== 'none' && (
          <div className="hidden md:flex items-center gap-1">
            <span>Optimized Audience:</span>
            <span className="font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded capitalize">
              {activeAudience}
            </span>
          </div>
        )}
      </div>

      {/* Sync, Storage & Realtime Status */}
      <div className="flex items-center gap-5">
        {/* Real-time Optimizer status */}
        {optimizationProgress < 100 && (
          <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Processing Resume DNA: {optimizationProgress}%</span>
          </div>
        )}

        {/* Sync state with database */}
        <div className="flex items-center gap-1.5" title="Database connection status">
          <Database className="w-3.5 h-3.5 opacity-60 text-emerald-400" />
          <span>Sync:</span>
          <div className="flex items-center gap-1">
            <CircleDot className={`w-2 h-2 text-emerald-400 fill-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]`} />
            <span className="font-bold lowercase text-emerald-400">{syncStatus}</span>
          </div>
        </div>

        {/* Google Drive Status Indicators */}
        <div className="hidden sm:flex items-center gap-1.5" title="Google Drive integration state">
          <Cloud className={`w-3.5 h-3.5 opacity-60 ${isDriveConnected ? 'text-emerald-400' : 'text-neutral-500'}`} />
          <span>Drive:</span>
          <span className={`font-bold ${isDriveConnected ? 'text-emerald-400' : 'opacity-40'}`}>
            {isDriveConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Current exports indicators */}
        <div className="flex items-center gap-1.5" title="Active file actions">
          <FileDown className={`w-3.5 h-3.5 opacity-60 ${isExporting ? 'text-emerald-400 animate-bounce' : 'text-neutral-500'}`} />
          {isExporting ? (
            <span className="text-emerald-400 font-bold animate-pulse">EXPORTING {exportType?.toUpperCase() || 'FILE'}...</span>
          ) : (
            <span className="opacity-40">SYSTEM READY</span>
          )}
        </div>
      </div>
    </footer>
  );
};
