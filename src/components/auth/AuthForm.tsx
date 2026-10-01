import React, { useId, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AuthMode = 'login' | 'signup' | 'reset';

const COPY: Record<AuthMode, { title: string; subtitle: string; submit: string }> = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to sync your resumes across devices.',
    submit: 'Sign in',
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Start tailoring resumes to every job, free.',
    submit: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    subtitle: "Enter your email and we'll send you a reset link.",
    submit: 'Send reset link',
  },
};

export function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function BrandMark({ onDark, subtitle = 'AI resume workspace' }: { onDark: boolean; subtitle?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className={`text-sm font-bold tracking-tight ${onDark ? 'text-white' : 'text-slate-900'}`}>Nexus AI</p>
        {subtitle && <p className={`truncate text-xs ${onDark ? 'text-white/60' : 'text-slate-500'}`}>{subtitle}</p>}
      </div>
    </div>
  );
}

interface AuthTextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  icon: LucideIcon;
  isDarkMode: boolean;
  labelAction?: React.ReactNode;
  hint?: string;
}

function AuthTextField({ label, icon: Icon, isDarkMode, labelAction, hint, type = 'text', id, ...inputProps }: AuthTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const [isRevealed, setIsRevealed] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className={`text-xs font-semibold ${isDarkMode ? 'text-white/80' : 'text-slate-700'}`}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}
        />
        <input
          id={inputId}
          type={isPassword && isRevealed ? 'text' : type}
          aria-describedby={hintId}
          className={`h-11 w-full rounded-xl border pl-10 ${isPassword ? 'pr-11' : 'pr-3'} text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 sm:text-sm ${
            isDarkMode
              ? 'border-white/10 bg-white/5 text-white placeholder:text-white/30'
              : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
          }`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setIsRevealed((value) => !value)}
            aria-label={isRevealed ? 'Hide password' : 'Show password'}
            aria-pressed={isRevealed}
            className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors ${
              isDarkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className={`mt-1.5 text-xs ${isDarkMode ? 'text-white/60' : 'text-slate-500'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function AuthAlert({ tone, isDarkMode, children }: { tone: 'error' | 'success'; isDarkMode: boolean; children: React.ReactNode }) {
  const isError = tone === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;
  const toneClass = isError
    ? isDarkMode ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'
    : isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${toneClass}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </motion.div>
  );
}

function AuthModeTabs({ mode, onChange, isDarkMode, disabled }: { mode: AuthMode; onChange: (mode: AuthMode) => void; isDarkMode: boolean; disabled: boolean }) {
  const tabs: { id: AuthMode; label: string }[] = [
    { id: 'login', label: 'Sign in' },
    { id: 'signup', label: 'Create account' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Choose sign in or create account"
      className={`grid grid-cols-2 gap-1 rounded-xl p-1 ring-1 ${isDarkMode ? 'bg-white/5 ring-white/10' : 'bg-slate-100 ring-slate-200'}`}
    >
      {tabs.map((tab) => {
        const isActive = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={`h-9 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : isDarkMode ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export interface AuthFormProps {
  isDarkMode: boolean;
  onGoogle: () => Promise<void> | void;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  externalError?: string | null;
  titleId?: string;
}

export function AuthForm({
  isDarkMode,
  onGoogle,
  onEmailLogin,
  onEmailSignUp,
  onPasswordReset,
  externalError,
  titleId,
}: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Errors raised by the parent (e.g. a failed Google popup) are hidden once the user starts a new action.
  const [showExternalError, setShowExternalError] = useState(true);

  const copy = COPY[mode];
  const muted = isDarkMode ? 'text-white/60' : 'text-slate-500';
  const displayError = message ? null : error ?? (showExternalError ? externalError ?? null : null);
  const isBusy = pending !== null;

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
    setShowExternalError(false);
  };

  const changeMode = (next: AuthMode) => {
    if (isBusy) return;
    setMode(next);
    resetFeedback();
  };

  const getErrorMessage = (err: unknown) =>
    err instanceof Error && err.message ? err.message : 'Authentication failed. Please try again.';

  const handleGoogle = async () => {
    if (isBusy) return;
    resetFeedback();
    setPending('google');
    try {
      await onGoogle();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(null);
      setShowExternalError(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    resetFeedback();
    setPending('email');
    try {
      if (mode === 'login') {
        await onEmailLogin(email, password);
      } else if (mode === 'signup') {
        await onEmailSignUp(email, password);
      } else {
        await onPasswordReset(email);
        setMode('login');
        setMessage(`Reset link sent to ${email}. Check your inbox.`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-5 lg-short:space-y-4">
      <motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <h2 id={titleId} className="text-2xl font-bold tracking-tight">
          {copy.title}
        </h2>
        <p className={`mt-1 text-sm ${muted}`}>{copy.subtitle}</p>
      </motion.div>

      {mode !== 'reset' && <AuthModeTabs mode={mode} onChange={changeMode} isDarkMode={isDarkMode} disabled={isBusy} />}

      {displayError && <AuthAlert tone="error" isDarkMode={isDarkMode}>{displayError}</AuthAlert>}
      {message && <AuthAlert tone="success" isDarkMode={isDarkMode}>{message}</AuthAlert>}

      {mode !== 'reset' && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isBusy}
            className={`flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${
              isDarkMode ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {pending === 'google' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className={`h-px flex-1 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            <span className={`text-xs font-medium ${muted}`}>or continue with email</span>
            <span className={`h-px flex-1 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthTextField
          label="Email"
          type="email"
          icon={Mail}
          isDarkMode={isDarkMode}
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
        />

        {mode !== 'reset' && (
          <AuthTextField
            label="Password"
            type="password"
            icon={Lock}
            isDarkMode={isDarkMode}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'signup' ? 6 : undefined}
            hint={mode === 'signup' ? 'Use at least 6 characters.' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            labelAction={
              mode === 'login' && (
                <button
                  type="button"
                  onClick={() => changeMode('reset')}
                  className="text-xs font-semibold text-emerald-500 hover:underline"
                >
                  Forgot password?
                </button>
              )
            }
          />
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'email' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Please wait…
            </>
          ) : (
            <>
              {copy.submit}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      {mode === 'reset' && (
        <button
          type="button"
          onClick={() => changeMode('login')}
          className={`mx-auto flex items-center gap-1.5 text-sm font-semibold transition-colors ${isDarkMode ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </button>
      )}
    </div>
  );
}
