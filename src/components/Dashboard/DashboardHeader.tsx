import React from 'react';
import { Cpu, Search, Sun, Moon, LogIn, LogOut, RefreshCw, Key } from 'lucide-react';
import { User } from 'firebase/auth';

interface DashboardHeaderProps {
  user: User | null;
  onAuthTrigger: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  onCommandPaletteOpen: () => void;
  geminiApiKey: string;
  openaiApiKey: string;
  encryptedApiKey: string;
  isFetchingKeys: boolean;
  onSyncKeys: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  onAuthTrigger,
  onLogout,
  isDarkMode,
  setIsDarkMode,
  onCommandPaletteOpen,
  geminiApiKey,
  openaiApiKey,
  encryptedApiKey,
  isFetchingKeys,
  onSyncKeys,
}) => {
  return (
    <header className={`h-16 flex items-center justify-between px-6 transition-all duration-300 relative ${isDarkMode ? 'bg-[#0b0c10]/80 text-white' : 'bg-white text-neutral-900'}`}>
      {/* Brand Logo & Title with subtle particle highlight */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 relative group overflow-hidden ${
          isDarkMode 
            ? 'bg-gradient-to-tr from-emerald-500/20 to-emerald-400/10 border border-emerald-500/30 hover:border-emerald-500/60 shadow-lg shadow-emerald-500/10' 
            : 'bg-neutral-950 border border-neutral-800'
        }`}>
          <Cpu className={`w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform duration-300`} />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </div>
        <div>
          <span className="font-extrabold text-[14px] uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-100 to-neutral-400 dark:from-white dark:to-neutral-400">
            NEXUS AI
          </span>
          <span className="block text-[8px] font-mono uppercase tracking-[0.15em] text-emerald-400 font-semibold -mt-0.5">
            AI SaaS platform
          </span>
        </div>
      </div>

      {/* Styled Command Center Search Bar like Cursor/Linear */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <button
          onClick={onCommandPaletteOpen}
          className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border text-left transition-all group ${
            isDarkMode 
              ? 'bg-white/5 border-white/5 hover:border-white/15 text-white/40 hover:text-white/65' 
              : 'bg-neutral-100 border-neutral-200 hover:border-neutral-300 text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-emerald-400/70" />
            <span className="text-xs font-medium font-sans">Search or type a command...</span>
          </div>
          <kbd className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold tracking-widest border ${
            isDarkMode 
              ? 'bg-[#18191e] border-white/10 text-white/60' 
              : 'bg-white border-neutral-200 text-neutral-500'
          }`}>
            ⌘K
          </kbd>
        </button>
      </div>

      {/* API Key Indicators & Action elements */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Keys Sync Indicators */}
        <div className={`hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all ${
          isDarkMode 
            ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' 
            : 'bg-neutral-50 border-neutral-200'
        }`}>
          <div className="flex items-center gap-1.5 cursor-help" title={geminiApiKey ? "Gemini API Key Active" : encryptedApiKey ? "Gemini Key Encrypted" : "Gemini Missing"}>
            <div className={`w-1.5 h-1.5 rounded-full ${geminiApiKey ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : encryptedApiKey ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70">GEMINI</span>
          </div>
          
          <div className="w-[1px] h-3 bg-neutral-200 dark:bg-white/10" />
          
          <div className="flex items-center gap-1.5 cursor-help" title={openaiApiKey ? "OpenAI API Key Active" : encryptedApiKey ? "OpenAI Key Encrypted" : "OpenAI Missing"}>
            <div className={`w-1.5 h-1.5 rounded-full ${openaiApiKey ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : encryptedApiKey ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70">OPENAI</span>
          </div>
          
          <div className="w-[1px] h-3 bg-neutral-200 dark:bg-white/10" />

          <button
            onClick={onSyncKeys}
            disabled={isFetchingKeys}
            className={`p-0.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors ${isFetchingKeys ? 'animate-spin text-emerald-400' : 'text-neutral-500 dark:text-neutral-400 hover:text-emerald-400 dark:hover:text-emerald-400'}`}
            title="Sync API Keys"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search button for smaller screens */}
        <button
          onClick={onCommandPaletteOpen}
          className={`p-2 rounded-xl transition-all border md:hidden ${
            isDarkMode 
              ? 'bg-white/5 border-white/5 text-white/70 hover:text-white' 
              : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
          }`}
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme select button */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-2 rounded-xl transition-all border ${
            isDarkMode 
              ? 'bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10' 
              : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
        </button>

        {/* Vertical Separator */}
        <div className="w-[1px] h-6 bg-neutral-200 dark:bg-white/10" />

        {/* Profile / Auth element */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 group">
              {/* User Avatar with elegant status ring */}
              <div className="relative cursor-pointer">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "User Profile"} 
                    className="w-8 h-8 rounded-xl object-cover border border-emerald-500/20 group-hover:border-emerald-500/60 transition-all shadow-md"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center border hover:border-emerald-500/50 transition-all ${
                    isDarkMode ? 'bg-[#18191e] border-white/10 text-emerald-400' : 'bg-neutral-200 border-neutral-300 text-neutral-700'
                  }`}>
                    {user.email?.substring(0, 2).toUpperCase() || 'US'}
                  </div>
                )}
                {/* Embedded online badge */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 dark:border-neutral-950 sm:block hidden" />
              </div>

              {/* Quick display text */}
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100 max-w-[120px] truncate leading-none">
                  {user.displayName || user.email?.split('@')[0] || "Authenticated"}
                </span>
                <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 shrink-0 leading-none mt-1">
                  Pro Account
                </span>
              </div>

              {/* Logout button */}
              <button
                onClick={onLogout}
                className={`p-2 rounded-xl transition-all border ${
                  isDarkMode 
                    ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/40 text-red-400' 
                    : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'
                }`}
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthTrigger}
              className={`px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm ${
                isDarkMode 
                  ? 'bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400 hover:scale-[1.02] active:scale-95' 
                  : 'bg-neutral-950 text-white border-neutral-800 hover:bg-neutral-800 hover:scale-[1.02] active:scale-95'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
