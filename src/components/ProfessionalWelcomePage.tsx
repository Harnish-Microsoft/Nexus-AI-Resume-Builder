import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, FileText, Moon, ShieldCheck, Sun, Target } from 'lucide-react';
import { AuthForm, BrandMark } from './auth/AuthForm';

interface ProfessionalWelcomePageProps {
  onLogin: () => Promise<void> | void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignUp: (email: string, pass: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  externalError?: string | null;
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

const features = [
  { icon: Target, title: 'Target the role', body: 'Paste a job description and focus on what recruiters screen for.' },
  { icon: BarChart3, title: 'Score your fit', body: 'See ATS match, missing keywords and impact signals instantly.' },
  { icon: FileText, title: 'Export cleanly', body: 'Download polished PDF, DOCX or JSON, ready to submit.' },
];

const previewKeywords = ['Kubernetes', 'Terraform', 'AWS', '+9 keywords'];

export function ProfessionalWelcomePage({
  onLogin,
  onEmailLogin,
  onEmailSignUp,
  onPasswordReset,
  externalError,
  isDarkMode,
  setIsDarkMode,
}: ProfessionalWelcomePageProps) {
  const muted = isDarkMode ? 'text-white/60' : 'text-slate-500';

  return (
    // The page is its own scroll container because the app sets `overflow: hidden` on <body>.
    <div
      className={`relative h-dvh w-full overflow-y-auto overflow-x-hidden font-sans antialiased selection:bg-emerald-500/20 ${
        isDarkMode ? 'bg-neutral-950 text-white' : 'bg-slate-100 text-slate-900'
      }`}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -top-48 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-500/15'}`} />
        <div className={`absolute -bottom-56 -right-32 h-[32rem] w-[32rem] rounded-full blur-3xl ${isDarkMode ? 'bg-blue-500/15' : 'bg-blue-400/20'}`} />
        <div className={`absolute -bottom-48 -left-40 h-[28rem] w-[28rem] rounded-full blur-3xl ${isDarkMode ? 'bg-fuchsia-500/10' : 'bg-fuchsia-300/20'}`} />
        <div
          className={`absolute inset-0 ${isDarkMode ? 'opacity-20' : 'opacity-40'}`}
          style={{
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
      </div>

      <div className="relative flex min-h-full flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg-short:py-3">
        <header className="flex items-center justify-between gap-3">
          <div className="lg:hidden">
            <BrandMark onDark={isDarkMode} />
          </div>
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              isDarkMode ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <main className="flex flex-1 items-center justify-center py-6 sm:py-10 lg-short:py-3">
          <div className="w-full max-w-md lg:max-w-5xl">
            <div className="mb-5 text-center lg:hidden">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tune every resume to the job</h1>
              <p className={`mt-1 text-sm ${muted}`}>ATS-ready resumes, tailored in minutes.</p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`grid overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_1fr] ${
                isDarkMode ? 'border-white/10 bg-neutral-900/80 shadow-black/40' : 'border-white bg-white/90 shadow-slate-900/10'
              }`}
            >
              <aside className="relative hidden overflow-hidden bg-neutral-950 p-10 text-white lg:flex xl:p-12 lg-short:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
                  <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
                  <div
                    className="absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
                      backgroundSize: '32px 32px',
                    }}
                  />
                </div>

                <div className="relative flex w-full flex-col">
                  <BrandMark onDark />

                  <div className="mt-10 lg-short:mt-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Private &amp; ATS-ready
                    </span>
                    <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight xl:text-4xl lg-short:mt-4 lg-short:text-3xl">
                      Tune every resume to the job before you apply.
                    </h1>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 lg-short:mt-3">
                      Paste a job description, compare fit signals, rewrite experience bullets and export a clean resume from one focused workspace.
                    </p>
                  </div>

                  <ul className="mt-8 space-y-4 lg-short:mt-6 lg-short:space-y-3">
                    {features.map((feature) => (
                      <li key={feature.title} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                          <feature.icon className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{feature.title}</p>
                          <p className="mt-0.5 text-sm text-white/60">{feature.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto hidden pt-10 [@media(min-height:860px)]:block">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Live preview</p>
                          <p className="mt-0.5 truncate text-sm font-semibold">Senior Cloud Architect</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Ready to apply</span>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60">ATS match</span>
                          <span className="font-semibold">84%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-[84%] rounded-full bg-emerald-500" />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {previewKeywords.map((keyword) => (
                          <span key={keyword} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/70 ring-1 ring-white/10">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <section className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 xl:p-12 lg-short:p-8">
                <AuthForm
                  isDarkMode={isDarkMode}
                  onGoogle={onLogin}
                  onEmailLogin={onEmailLogin}
                  onEmailSignUp={onEmailSignUp}
                  onPasswordReset={onPasswordReset}
                  externalError={externalError}
                />
              </section>
            </motion.div>
          </div>
        </main>

        <footer className={`flex items-center justify-center gap-1.5 pb-1 text-center text-xs ${muted}`}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Your data stays private. Resumes are synced securely to your account.
        </footer>
      </div>
    </div>
  );
}
