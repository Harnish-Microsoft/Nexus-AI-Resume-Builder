import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BarChart3, CheckCircle2, FileText, Key, Lock, LogIn, Mail, Moon, ShieldCheck, Sparkles, Sun, Target, UserPlus } from 'lucide-react';
import { GeminiAmbientGlow } from './GeminiAmbientGlow';

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
    >
      <GeminiAmbientGlow status="idle" intensity="high" />
      <main className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1.08fr_0.92fr] relative z-10">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-lg ${isDarkMode ? 'bg-white text-emerald-600' : 'bg-slate-950 text-emerald-300'}`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-base font-black tracking-tight uppercase gemini-glow-text">Nexus AI</p>
                <p className={`text-[10px] uppercase tracking-widest font-bold ${muted}`}>Professional Hub</p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-xl border p-2.5 transition-all active:scale-95 ${isDarkMode ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          <div className="max-w-2xl py-12 lg:py-20">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide uppercase ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              FAANG-GRADE OPTIMIZATION ENGINE
            </motion.div>
            <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl leading-[1.1]">
              Tune every resume <br className="hidden sm:block" />
              <span className="gemini-glow-text italic">to the job.</span>
            </h1>
            <p className={`mt-6 max-w-xl text-lg leading-relaxed sm:text-xl font-medium ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>
              Paste a job description, analyze target match scores, and generate high-impact STAR stories in one intelligent workspace.
            </p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Target, title: 'Target', body: 'Deep role analysis.', color: 'text-emerald-500' },
                { icon: BarChart3, title: 'Score', body: 'ATS match tracking.', color: 'text-blue-500' },
                { icon: FileText, title: 'Export', body: 'FAANG-ready PDFs.', color: isDarkMode ? 'text-purple-400' : 'text-purple-600' },
              ].map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (i * 0.1) }}
                  key={item.title} 
                  className={`rounded-2xl border p-5 transition-all hover:scale-[1.02] ${panel}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest">{item.title}</p>
                  <p className={`mt-1 text-xs font-medium leading-5 ${muted}`}>{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 py-4">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              Trusted by professionals at top tech firms
            </p>
          </div>
        </section>

        <section className={`flex items-center justify-center border-t lg:border-t-0 lg:border-l px-6 py-12 sm:px-10 ${isDarkMode ? 'bg-slate-950/20 border-white/5' : 'bg-white/40 border-slate-200'} backdrop-blur-3xl`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className={`rounded-3xl border p-8 shadow-2xl ${isDarkMode ? 'bg-slate-950/20 border-white/10' : 'bg-white/80 border-slate-200'}`}>
              <AnimatePresence mode="wait">
                {view === 'welcome' ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="space-y-5"
                  >
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">Sign in to continue</h2>
                      <p className={`mt-1 text-sm ${muted}`}>Sync versions, keys, and Drive exports across sessions.</p>
                    </div>

                    {displayError && (
                      <div className={`rounded-md border p-3 text-sm ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {displayError}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (isLoading) return;
                        setIsLoading(true);
                        onLogin();
                      }}
                      disabled={isLoading}
                      className={`flex w-full items-center justify-center gap-3 rounded-lg border py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isDarkMode ? 'border-white/10 bg-white text-black hover:bg-white/90' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
                    >
                      {isLoading ? (
                        <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                      ) : (
                        <img src="https://www.google.com/favicon.ico" className="h-4 w-4" alt="Google" referrerPolicy="no-referrer" />
                      )}
                      Continue with Google
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setView('email-login')}
                        className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-colors ${isDarkMode ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-950 text-white hover:bg-slate-800'}`}
                      >
                        <LogIn className="h-4 w-4" />
                        Log In
                      </button>
                      <button
                        onClick={() => setView('email-signup')}
                        className={`flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-bold transition-colors ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      >
                        <UserPlus className="h-4 w-4" />
                        Sign Up
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="auth-form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="space-y-4"
                  >
                    <div>
                      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        {view === 'email-login' && <LogIn className="h-5 w-5 text-emerald-500" />}
                        {view === 'email-signup' && <UserPlus className="h-5 w-5 text-emerald-500" />}
                        {view === 'reset-pass' && <Key className="h-5 w-5 text-emerald-500" />}
                        {authTitle}
                      </h2>
                      <p className={`mt-1 text-sm ${muted}`}>
                        {view === 'reset-pass' ? 'Enter your email and we will send a reset link.' : 'Use the same account you use for saved resume versions.'}
                      </p>
                    </div>

                    {displayError && (
                      <div className={`rounded-md border p-3 text-sm ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {displayError}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className={`mb-1.5 block text-xs font-semibold ${muted}`}>Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      {view !== 'reset-pass' && (
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <label className={`text-xs font-semibold ${muted}`}>Password</label>
                            {view === 'email-login' && (
                              <button
                                type="button"
                                onClick={() => setView('reset-pass')}
                                className="text-xs font-semibold text-emerald-500 hover:text-emerald-400"
                              >
                                Forgot password?
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className={inputClass}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? 'Processing...' : (
                          view === 'email-login' ? 'Login' :
                          view === 'email-signup' ? 'Create Account' :
                          'Send Reset Link'
                        )}
                        {!isLoading && <ArrowRight className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('welcome')}
                        className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${isDarkMode ? 'text-white/50 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        Back to options
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
