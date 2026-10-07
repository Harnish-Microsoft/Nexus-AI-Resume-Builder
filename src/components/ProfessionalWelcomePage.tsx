import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, BarChart3, CheckCircle2, FileText, Key, Lock, LogIn, Mail, Moon, ShieldCheck, Sparkles, Sun, Target, UserPlus } from 'lucide-react';

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
      <main className="min-h-screen flex flex-col lg:grid lg:grid-cols-[1fr_0.8fr] relative z-10">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-white text-emerald-600' : 'bg-slate-950 text-emerald-300'}`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-tight">Nexus AI</p>
                <p className={`text-[10px] ${muted}`}>Workspace</p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-lg border p-1.5 transition-colors ${isDarkMode ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="py-12 lg:py-8">
            <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              <ShieldCheck className="w-3 h-3" />
              Private & ATS-Ready
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Tune every resume to the job before you apply.
            </h1>
            <p className={`mt-4 max-w-xl text-sm leading-relaxed sm:text-base ${muted}`}>
              Paste a job description, compare fit signals, rewrite experience bullets, and export a clean ATS-ready resume from one focused workspace.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-2xl">
              {[
                { icon: Target, title: 'Target', body: 'Role & JD.', color: 'text-emerald-500' },
                { icon: BarChart3, title: 'Score', body: 'Keyword analysis.', color: 'text-blue-500' },
                { icon: FileText, title: 'Export', body: 'PDF/DOCX/JSON.', color: isDarkMode ? 'text-white/70' : 'text-slate-700' },
              ].map((item) => (
                <div key={item.title} className={`rounded-xl border p-4 ${panel}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <p className="mt-2 text-xs font-semibold">{item.title}</p>
                  <p className={`mt-0.5 text-[10px] leading-4 ${muted}`}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <p className={`hidden text-[10px] lg:block ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Fast-tracked resume tailoring.</p>
        </section>

        <section className={`flex items-center justify-center border-t px-6 py-12 lg:border-l lg:border-t-0 lg:px-12 ${isDarkMode ? 'bg-black/10 border-white/10' : 'bg-slate-50/50 border-slate-200'}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <div className={`mb-6 rounded-xl border p-4 ${softPanel}`}>
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div>
                  <p className={`text-[10px] font-semibold uppercase ${isDarkMode ? 'text-white/45' : 'text-slate-500'}`}>Preview</p>
                  <p className="text-xs font-bold">Cloud Architect</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Ready</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previewRows.map((row) => (
                  <div key={row.label} className={`rounded-lg border p-2 ${getMetricTone(row.tone)}`}>
                    <p className="text-sm font-bold">{row.value}</p>
                    <p className="text-[9px] font-semibold uppercase leading-3 opacity-80">{row.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border p-5 shadow-sm ${panel}`}>
              <AnimatePresence mode="wait">
                {view === 'welcome' ? (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
                      <p className={`mt-0.5 text-xs ${muted}`}>Sync everything.</p>
                    </div>

                    {displayError && (
                      <div className={`rounded-md border p-2.5 text-xs ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
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
                      className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isDarkMode ? 'border-white/10 bg-white text-black hover:bg-white/90' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
                    >
                      {isLoading ? (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
                      ) : (
                        <img src="https://www.google.com/favicon.ico" className="h-3.5 w-3.5" alt="Google" referrerPolicy="no-referrer" />
                      )}
                      Google
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setView('email-login')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${isDarkMode ? 'bg-white text-black hover:bg-white/90' : 'bg-slate-950 text-white hover:bg-slate-800'}`}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Log In
                      </button>
                      <button
                        onClick={() => setView('email-signup')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-bold transition-colors ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Sign Up
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="auth-form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div>
                      <h2 className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
                        {view === 'email-login' && <LogIn className="h-4 w-4 text-emerald-500" />}
                        {view === 'email-signup' && <UserPlus className="h-4 w-4 text-emerald-500" />}
                        {view === 'reset-pass' && <Key className="h-4 w-4 text-emerald-500" />}
                        {authTitle}
                      </h2>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        {view === 'reset-pass' ? 'We will send a link.' : 'Use your saved email.'}
                      </p>
                    </div>

                    {displayError && (
                      <div className={`rounded-md border p-2.5 text-xs ${isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {displayError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div>
                        <label className={`mb-1 block text-[10px] font-semibold ${muted}`}>Email</label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className={inputClass}
                            style={{ paddingLeft: '2rem', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>

                      {view !== 'reset-pass' && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className={`text-[10px] font-semibold ${muted}`}>Password</label>
                            {view === 'email-login' && (
                              <button
                                type="button"
                                onClick={() => setView('reset-pass')}
                                className="text-[10px] font-semibold text-emerald-500 hover:text-emerald-400"
                              >
                                Forgot?
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className={inputClass}
                              style={{ paddingLeft: '2rem', fontSize: '0.875rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? 'Processing...' : (
                          view === 'email-login' ? 'Login' :
                          view === 'email-signup' ? 'Create Account' :
                          'Reset Link'
                        )}
                        {!isLoading && <ArrowRight className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('welcome')}
                        className={`w-full rounded-lg py-1.5 text-xs font-semibold transition-colors ${isDarkMode ? 'text-white/50 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        Back
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
