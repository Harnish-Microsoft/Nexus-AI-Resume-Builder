import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  LayoutGrid, 
  UserCircle, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Target, 
  Sliders, 
  Layers, 
  LineChart, 
  Compass, 
  FolderLock,
  Menu
} from 'lucide-react';

interface NavigationRailProps {
  activeTab: 'dashboard' | 'build' | 'profile' | 'tools';
  isDarkMode: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  isDarkMode,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  // Use local state if no controlled collapsible state is passed
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : localCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setLocalCollapsed(!localCollapsed));

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // High-level navigation blueprint schema mapped to existing 4 tabs
  const navItems = [
    {
      id: 'dashboard',
      label: 'Workspace Dashboard',
      icon: Compass,
      tabMapping: 'dashboard' as const,
      route: '/dashboard',
      description: 'Career landing'
    },
    {
      id: 'build',
      label: 'Resume Studio',
      icon: FileText,
      tabMapping: 'build' as const,
      route: '/build',
      description: 'AI resume generator'
    },
    {
      id: 'tools',
      label: 'Career Tools',
      icon: LayoutGrid,
      tabMapping: 'tools' as const,
      route: '/tools',
      description: 'SaaS utilities'
    },
    {
      id: 'profile',
      label: 'Settings & Profile',
      icon: UserCircle,
      tabMapping: 'profile' as const,
      route: '/profile',
      description: 'User settings'
    }
  ];

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div className={`md:hidden flex h-11 items-center px-4 justify-between border-b ${
        isDarkMode ? 'bg-[#0b0c10] border-white/5 text-white/80' : 'bg-neutral-50 border-neutral-200'
      }`}>
        <div className="flex items-center gap-1.5">
          <Menu className="w-4 h-4 cursor-pointer text-emerald-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <span className="text-[10px] font-black uppercase tracking-widest">Navigation Workspace</span>
        </div>
        <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full capitalize">
          {activeTab} Mode
        </span>
      </div>

      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Drawer Context Container */}
      <aside className={`
        fixed md:relative top-0 left-0 h-screen md:h-full z-50 md:z-auto transition-all duration-300 flex flex-col justify-between shrink-0
        ${isDarkMode ? 'bg-[#090b0e] text-white border-r border-white/10' : 'bg-white text-neutral-800 border-r border-neutral-200'}
        ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-16' : 'md:w-60'}
      `}>
        {/* Upper Menu Section */}
        <div className="flex flex-col p-3 overflow-y-auto overflow-x-hidden flex-1 select-none custom-scrollbar pb-16">
          <div className="flex items-center justify-between mb-4 px-2">
            {!isCollapsed && (
              <span className="text-[9px] font-black tracking-[0.2em] uppercase opacity-40">
                Main Console
              </span>
            )}
            
            {/* Collapse Icon Button */}
            <button 
              onClick={toggleCollapse}
              className={`hidden md:flex p-1.5 rounded-lg border transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 text-white/50 hover:text-emerald-400' 
                  : 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100 text-neutral-500 hover:text-emerald-600'
              }`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          <nav className="space-y-1.5 flex flex-col">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isTabActive = activeTab === item.tabMapping;
              
              return (
                <Link
                  key={item.id}
                  to={item.route}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center group relative rounded-xl p-2.5 transition-all text-left border ${
                    isTabActive 
                      ? (isDarkMode 
                          ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400 shadow-sm' 
                          : 'bg-neutral-900 border-neutral-950 text-white shadow-md')
                      : (isDarkMode 
                          ? 'bg-transparent border-transparent text-white/50 hover:text-white hover:bg-white/[0.03]' 
                          : 'bg-transparent border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-black/5')
                  }`}
                  title={`${item.label} - ${item.description}`}
                >
                  {/* Left Side Active bar indicator */}
                  {isTabActive && (
                    <div className="absolute left-0 top-[25%] bottom-[25%] w-0.5 bg-emerald-500 rounded" />
                  )}

                  <IconComponent className={`w-4 h-4 shrink-0 transition-transform ${isCollapsed ? 'mx-auto' : 'mr-3'} ${
                    isTabActive ? 'text-emerald-400' : 'group-hover:scale-105 group-hover:text-emerald-400/80 duration-200'
                  }`} />

                  {!isCollapsed && (
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold tracking-wide">
                        {item.label}
                      </span>
                      <span className="text-[8px] opacity-50 block md:max-w-[150px] truncate leading-tight font-medium">
                        {item.description}
                      </span>
                    </div>
                  )}

                  {/* Tooltip for collapsed mode */}
                  {isCollapsed && (
                    <div className="absolute left-16 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-neutral-900 border border-white/10 text-white text-[9px] font-bold uppercase tracking-widest hidden group-hover:block whitespace-nowrap z-50 shadow-2xl">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pro features footer element */}
        {!isCollapsed && (
          <div className="p-3 m-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/15 hidden md:block select-none shadow-sm relative overflow-hidden">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">
              Active Engines
            </span>
            <span className="text-[10px] leading-relaxed opacity-75 block text-left">
              Advanced Hybrid Scoring and PDF dynamic pagination modules active.
            </span>
            <div className="absolute -bottom-6 -right-6 w-12 h-12 bg-emerald-500/5 blur-xl rounded-full" />
          </div>
        )}
      </aside>
    </>
  );
};
