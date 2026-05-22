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
      <main className="min-h-screen grid lg:grid-cols-[1.08fr_0.92fr] relative z-10">
        <section className="flex flex-col justify-between px-6 py-6 sm:px-10 lg:px-14 lg:py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-white text-emerald-600' : 'bg-slate-950 text-emerald-300'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">Nexus AI</p>
                <p className={`text-xs ${muted}`}>Resume optimization workspace</p>
              </div>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`rounded-lg border p-2 transition-colors ${isDarkMode ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="max-w-2xl py-10 sm:py-14 lg:py-20">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Private resume data, role-specific outputs
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Tune every resume to the job before you apply.
            </h1>
            <p className={`mt-5 max-w-xl text-base leading-7 sm:text-lg ${muted}`}>
              Paste a job description, compare fit signals, rewrite experience bullets, and export a clean ATS-ready resume from one focused workspace.
            </p>

            <div className="mt-8 hidden max-w-xl gap-3 sm:grid sm:grid-cols-3">
              {[
                { icon: Target, title: 'Target', body: 'Role, company, and job description.', color: 'text-emerald-500' },
                { icon: BarChart3, title: 'Score', body: 'Keyword and match analysis.', color: 'text-blue-500' },
                { icon: FileText, title: 'Export', body: 'PDF, DOCX, and JSON versions.', color: isDarkMode ? 'text-white/70' : 'text-slate-700' },
              ].map((item) => (
                <div key={item.title} className={`rounded-lg border p-4 ${panel}`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  <p className={`mt-1 text-xs leading-5 ${muted}`}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <p className={`hidden text-xs sm:block ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Built for repeated applications, not one-off resume decoration.</p>
        </section>

        <section className={`flex items-start justify-center border-t px-4 py-6 sm:items-center sm:py-8 lg:border-l lg:border-t-0 lg:px-10 ${isDarkMode ? 'bg-black/10 border-white/10' : 'bg-white/10 border-slate-200'}`}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className={`mb-4 hidden rounded-lg border p-3 sm:block ${softPanel}`}>
              <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase ${isDarkMode ? 'text-white/45' : 'text-slate-500'}`}>Workspace Preview</p>
                  <p className="text-sm font-bold">Senior Cloud Architect</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Ready</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previewRows.map((row) => (
                  <div key={row.label} className={`rounded-md border p-2 ${getMetricTone(row.tone)}`}>
                    <p className="text-lg font-bold">{row.value}</p>
                    <p className="text-[10px] font-semibold uppercase leading-4 opacity-80">{row.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {['Leadership bullets aligned to Azure migration scope', 'Quantified cost and reliability outcomes added'].map((item) => (
                  <div key={item} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${isDarkMode ? 'bg-white/5 text-white/65' : 'bg-white text-slate-600'}`}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border p-6 shadow-sm ${panel}`}>
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
