import React from 'react';

interface DashboardShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  navigationRail?: React.ReactNode;
  footer?: React.ReactNode;
  isDarkMode?: boolean;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  header,
  navigationRail,
  footer,
  isDarkMode = true,
}) => {
  return (
    <div className={`h-screen w-screen flex overflow-hidden transition-colors duration-500 relative ${
      isDarkMode ? 'bg-[#030507] text-[#e2e8f0]' : 'bg-[#f8f9fa] text-slate-800'
    }`}>
      {/* Decorative ambient background lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[160px] bg-emerald-500/10 mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[160px] bg-teal-500/5 mix-blend-screen" />
      </div>

      {/* Main Layout Grid */}
      <div className="flex flex-1 relative z-10 w-full h-full min-w-0">
        {/* Navigation Rail Panel Component */}
        {navigationRail && (
          <div className="h-full shrink-0 flex flex-col z-20">
            {navigationRail}
          </div>
        )}

        {/* Content Container Body */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
          
          {/* Main Top Header */}
          {header && (
            <div className="w-full shrink-0 z-10">
              {header}
            </div>
          )}

          {/* Core Dynamic Content Panel */}
          <div className="flex-1 w-full min-h-0 overflow-hidden relative">
            {children}
          </div>

          {/* Persistent Workspace Footer */}
          {footer && (
            <div className="w-full shrink-0 z-10">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DashboardShell;
