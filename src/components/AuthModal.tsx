import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User as UserIcon, X, Loader2, AlertCircle, ArrowRight, Key } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, isDarkMode, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess();
        onClose();
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        onSuccess();
        onClose();
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setMessage('Password reset email sent! Check your inbox.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'An unexpected error occurred';
      if (err.code === 'auth/user-not-found') msg = 'No user found with this email';
      else if (err.code === 'auth/wrong-password') msg = 'Incorrect password';
      else if (err.code === 'auth/email-already-in-use') msg = 'Email already in use';
      else if (err.code === 'auth/weak-password') msg = 'Password is too weak';
      else if (err.code === 'auth/invalid-email') msg = 'Invalid email address';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive');
      console.log("[AuthModal] Initiating Google Popup...");
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      console.log("[AuthModal] Google Result Success");
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken && auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          driveAccessToken: credential.accessToken,
          settings: { isDriveConnected: true }
        }, { merge: true });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Google login error:', err);
      let msg = 'Google login failed. Please try again.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Login cancelled: Popup was closed before completion.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Another login request is already in progress.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'Domain not authorized. Please add this domain to your Firebase Authorized Domains list.';
      } else if (err.message) {
        msg = `Google error: ${err.message}`;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] overflow-y-auto outline-none focus:outline-none">
          <div className="min-h-screen flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-[420px] rounded-[2rem] shadow-2xl border overflow-hidden flex flex-col ${
                isDarkMode ? 'glass-thick border-white/10 text-white' : 'glass-panel-light border-black/5 text-black bg-white'
              }`}
            >
              <div className="p-6 md:p-8 border-b border-black/5 dark:border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-2xl shadow-inner ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <UserIcon className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">
                      {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
                    </h3>
                    <p className="text-[11px] font-medium opacity-50 uppercase tracking-widest mt-0.5">
                      {mode === 'login' ? 'Nexus AI Executive Suite' : mode === 'signup' ? 'Access FAANG-Tier Optimization' : 'Secure Account Recovery'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all hover:rotate-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar max-h-[calc(100vh-160px)]">
                <form onSubmit={handleAuth} className="p-6 md:p-8 space-y-5">
                  {(error || message) && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={`p-4 rounded-2xl border flex items-start gap-3 ${
                        error 
                          ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                      }`}
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium leading-relaxed">{error || message}</span>
                    </motion.div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-40 ml-1">Identity Gateway</label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDarkMode ? 'opacity-30 group-focus-within:text-emerald-500 group-focus-within:opacity-100' : 'opacity-40'}`} />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-medium`}
                          placeholder="executive@nexus.ai"
                        />
                      </div>
                    </div>

                    {mode !== 'reset' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Authentication Key</label>
                        </div>
                        <div className="relative group">
                          <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDarkMode ? 'opacity-30 group-focus-within:text-emerald-500 group-focus-within:opacity-100' : 'opacity-40'}`} />
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-medium`}
                            placeholder="••••••••••••"
                          />
                        </div>
                        {mode === 'login' && (
                          <div className="flex justify-end mt-2">
                            <button
                              type="button"
                              onClick={() => setMode('reset')}
                              className="text-[10px] font-black text-emerald-500 hover:text-emerald-600 transition-colors uppercase tracking-widest px-1"
                            >
                              Forgot Access?
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span className="uppercase tracking-widest text-xs">
                          {mode === 'login' ? 'Establish Session' : mode === 'signup' ? 'Create Identity' : 'Request Reset'}
                        </span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-black/5 dark:border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className={`px-4 text-[9px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'bg-[#141414]' : 'bg-white'} opacity-40`}>Hardware Auth</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className={`group w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border font-bold text-xs transition-all uppercase tracking-widest ${
                      isDarkMode 
                        ? 'border-white/10 hover:bg-white/5 hover:border-white/20' 
                        : 'border-black/5 hover:bg-black/5 hover:border-black/10'
                    }`}
                  >
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google Cloud Login
                  </button>
                </form>

                <div className={`p-8 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} text-center border-t border-black/5 dark:border-white/5 shrink-0`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">
                    {mode === 'login' ? "New to the Suite?" : "Already Authorized?"}
                  </p>
                  <button
                    onClick={() => {
                      setMode(mode === 'signup' ? 'login' : 'signup');
                      setError(null);
                      setMessage(null);
                    }}
                    className="w-full py-3.5 rounded-xl border border-emerald-500/30 text-emerald-500 font-black text-xs uppercase tracking-widest hover:bg-emerald-500/10 transition-all active:scale-95"
                  >
                    {mode === 'signup' ? 'Access Portal' : 'Register New Identity'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
