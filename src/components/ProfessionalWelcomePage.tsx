import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BarChart3, CheckCircle2, FileText, Key, Lock, LogIn, Mail, Moon, ShieldCheck, Sparkles, Sun, Target, UserPlus, Loader2 } from 'lucide-react';

interface ProfessionalWelcomePageProps {
  onLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  externalError?: string | null;
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

const previewRows = [
  { label: 'ATS Match', value: '84%', tone: 'emerald' },
  { label: 'Missing Keywords', value: '12', tone: 'amber' },
  { label: 'Resume Versions', value: '3', tone: 'blue' },
];

export function ProfessionalWelcomePage({
  onLogin,
  onEmailLogin,
  onEmailSignUp,
  onPasswordReset,
  externalError,
  isDarkMode,
  setIsDarkMode,
}: ProfessionalWelcomePageProps) {
  const [view, setView] = useState<'welcome' | 'email-login' | 'email-signup' | 'reset-pass'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(false);
  }, [externalError]);

  const displayError = externalError || error;
  const surface = isDarkMode ? 'text-white' : 'text-slate-950';
  const panel = isDarkMode ? 'glass-panel' : 'glass-panel-light';
  const muted = isDarkMode ? 'text-white/55' : 'text-slate-600';
  const softPanel = isDarkMode ? 'glass-panel border-white/10' : 'glass-panel-light border-slate-200';

  const getMetricTone = (tone: string) => {
    if (tone === 'emerald') return isDarkMode ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (tone === 'amber') return isDarkMode ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-100';
    return isDarkMode ? 'text-blue-300 bg-blue-500/10 border-blue-500/20' : 'text-blue-700 bg-blue-50 border-blue-100';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (view === 'email-login') {
        await onEmailLogin(email, password);
      } else if (view === 'email-signup') {
        await onEmailSignUp(email, password);
      } else if (view === 'reset-pass') {
        await onPasswordReset(email);
        setView('email-login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const authTitle =
    view === 'email-login' ? 'Welcome Back' :
    view === 'email-signup' ? 'Create Account' :
    'Reset Password';

  const inputClass = `w-full rounded-lg border py-3 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 ${
    isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-white/25' : 'bg-white border-slate-300 text-slate-950'
  }`;

  return (
    <div 
      className={`min-h-screen font-sans selection:bg-emerald-500/20 ${surface} relative overflow-hidden z-0`}
      style={{ backgroundImage: 'var(--glass-bg-image)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 pointer-events-none -z-10" />
      <div className="liquid-container z-10 opacity-50">
        <div className="liquid-blob w-[110vw] h-[110vh] bg-blue-500/10 -top-1/2 -left-1/4" style={{ animationDelay: '-2s' }} />
        <div className="liquid-blob w-[90vw] h-[90vh] bg-pink-500/10 top-1/2 -right-1/4" style={{ animationDelay: '-5s' }} />
        <div className="liquid-blob w-[100vw] h-[100vh] bg-amber-500/8 -bottom-1/4 left-1/3" style={{ animationDelay: '-8s' }} />
      </div>
      <main className="min-h-screen flex flex-col lg:flex-row relative z-10 w-full overflow-x-hidden">
        {/* Left Section: Branding & Intro */}
        <section className="flex-[1.1] flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-20 lg:py-16">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 md:h-12 md:w-12 rounded-2xl flex items-center justify-center shadow-xl ${isDarkMode ? 'bg-white text-emerald-600' : 'bg-slate-900 text-emerald-300'}`}>
                <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-base md:text-lg font-black tracking-tight leading-none">Nexus AI</p>
                <p className={`text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1 ${muted}`}>Executive Resume Suite</p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-2xl border p-2.5 transition-all active:scale-95 ${isDarkMode ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm'}`}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="max-w-xl py-12 md:py-20 lg:py-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-widest mb-8 ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              FAANG-Compliant • ISO-Encrypted • Private
            </motion.div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-8">
              Precision Resume <span className="text-emerald-500">Engineering.</span>
            </h1>
            <p className={`max-w-md text-base sm:text-lg leading-relaxed font-medium ${muted}`}>
              Transform raw experience into high-impact narratives tailored for technical leadership and executive roles.
            </p>

            <div className="mt-12 hidden sm:grid grid-cols-3 gap-4">
              {[
                { icon: Target, title: 'Strategic Alignment', body: 'AI-driven JD matching.' },
                { icon: BarChart3, title: 'Impact Metrics', body: 'STAR-method optimization.' },
                { icon: FileText, title: 'Universal Export', body: 'PDF, DOCX & JSON.' },
              ].map((item) => (
                <div key={item.title} className={`rounded-2xl border p-5 ${panel} transition-transform hover:-translate-y-1`}>
                  <item.icon className={`w-6 h-6 text-emerald-500 mb-3`} />
                  <p className="text-xs font-black uppercase tracking-widest mb-1">{item.title}</p>
                  <p className={`text-[10px] leading-relaxed font-bold opacity-40`}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center gap-8 border-t border-black/5 dark:border-white/10 pt-8 opacity-40">
            <div className="flex flex-col">
              <span className="text-xs font-black">20k+</span>
              <span className="text-[8px] uppercase tracking-widest">Optimized</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black">4.9/5</span>
              <span className="text-[8px] uppercase tracking-widest">Efficiency</span>
            </div>
          </div>
        </section>

        {/* Right Section: Auth Card */}
        <section className={`flex-[0.9] flex items-center justify-center p-6 md:p-12 lg:p-20 relative ${isDarkMode ? 'bg-black/20 lg:bg-black/10 border-white/5' : 'bg-white/40 lg:bg-white/10 border-slate-200'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md relative"
          >
            {/* Visual Teaser for Mobile */}
            <div className={`mb-6 lg:hidden rounded-2xl border p-4 ${softPanel}`}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest">Portfolio Preview</p>
              </div>
            </div>

            <div className={`rounded-[2.5rem] border shadow-2xl p-8 md:p-10 relative overflow-hidden ${isDarkMode ? 'glass-thick border-white/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
              <AnimatePresence mode="wait">
                {view === 'welcome' ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-8"
                  >
                    <div className="text-center">
                      <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Open Gateway</h2>
                      <p className={`text-xs font-bold uppercase tracking-widest opacity-40`}>Establish secure workspace session</p>
                    </div>

                    {displayError && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={`rounded-2xl border p-4 text-xs font-bold ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600 shadow-sm'}`}
                      >
                        {displayError}
                      </motion.div>
                    )}

                    <div className="space-y-4">
                      <button
                        onClick={() => {
                          if (isLoading) return;
                          setIsLoading(true);
                          onLogin();
                        }}
                        disabled={isLoading}
                        className={`group flex w-full items-center justify-center gap-4 rounded-2xl py-4 text-xs font-black transition-all disabled:opacity-60 uppercase tracking-[0.2em] shadow-lg active:scale-95 ${isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}`}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <img src="https://www.google.com/favicon.ico" className="h-5 w-5 filter contrast-125" alt="Google" referrerPolicy="no-referrer" />
                            <span>Continue with Google</span>
                          </>
                        )}
                      </button>

                      <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className={`w-full border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className={`${isDarkMode ? 'bg-[#18181b]' : 'bg-white'} px-4 text-[9px] font-black uppercase tracking-[0.4em] opacity-30`}>Or Manual Entry</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setView('email-login')}
                          className={`flex items-center justify-center gap-3 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${isDarkMode ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'}`}
                        >
                          <LogIn className="h-4 w-4 text-emerald-500" />
                          Log In
                        </button>
                        <button
                          onClick={() => setView('email-signup')}
                          className={`flex items-center justify-center gap-3 rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${isDarkMode ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                        >
                          <UserPlus className="h-4 w-4" />
                          Register
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="auth-form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-2xl font-black tracking-tight mb-1 uppercase">{authTitle}</h2>
                      <p className={`text-[10px] font-bold uppercase tracking-widest opacity-40`}>
                        {view === 'reset-pass' ? 'Enter identity for recovery' : 'Nexus Identity Verification'}
                      </p>
                    </div>

                    {displayError && (
                      <div className={`rounded-2xl border p-4 text-[11px] font-bold ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                        {displayError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">E-Mail Address</label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="executive@nexus.ai"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {view !== 'reset-pass' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Password</label>
                            {view === 'email-login' && (
                              <button
                                type="button"
                                onClick={() => setView('reset-pass')}
                                className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 uppercase tracking-widest"
                              >
                                Forgot?
                              </button>
                            )}
                          </div>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
                            <input
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••••••"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-4 text-xs font-black text-white transition-all hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 active:scale-98 uppercase tracking-widest"
                      >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                          <>
                            <span>{view === 'email-login' ? 'Authorize' : view === 'email-signup' ? 'Complete Identity' : 'Send Recovery'}</span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('welcome')}
                        className={`w-full rounded-2xl py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                      >
                        Cancel Verification
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
