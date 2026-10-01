import React, { useEffect, useId } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
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
import { AuthForm, BrandMark } from './auth/AuthForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onSuccess: () => void;
}

function getEmailAuthErrorMessage(err: any) {
  if (err?.code === 'auth/user-not-found') return 'No user found with this email';
  if (err?.code === 'auth/wrong-password') return 'Incorrect password';
  if (err?.code === 'auth/email-already-in-use') return 'Email already in use';
  if (err?.code === 'auth/weak-password') return 'Password is too weak';
  if (err?.code === 'auth/invalid-email') return 'Invalid email address';
  return 'An unexpected error occurred';
}

function getGoogleAuthErrorMessage(err: any) {
  if (err?.code === 'auth/popup-closed-by-user') return 'Login cancelled: Popup was closed before completion.';
  if (err?.code === 'auth/cancelled-popup-request') return 'Another login request is already in progress.';
  if (err?.code === 'auth/unauthorized-domain') return 'Domain not authorized. Please add this domain to your Firebase Authorized Domains list.';
  if (err?.message) return `Google error: ${err.message}`;
  return 'Google login failed. Please try again.';
}

export function AuthModal({ isOpen, onClose, isDarkMode, onSuccess }: AuthModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const completeSignIn = () => {
    onSuccess();
    onClose();
  };

  const handleEmailLogin = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Auth error:', err);
      throw new Error(getEmailAuthErrorMessage(err));
    }
    completeSignIn();
  };

  const handleEmailSignUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Auth error:', err);
      throw new Error(getEmailAuthErrorMessage(err));
    }
    completeSignIn();
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      console.error('Auth error:', err);
      throw new Error(getEmailAuthErrorMessage(err));
    }
  };

  const handleGoogleLogin = async () => {
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
    } catch (err) {
      console.error('Google login error:', err);
      throw new Error(getGoogleAuthErrorMessage(err));
    }
    completeSignIn();
  };

  if (!isOpen) return null;

  return (
    // The overlay scrolls so the dialog is never clipped on short or small windows.
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div
        className="flex min-h-full items-end justify-center sm:items-center sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`relative w-full overflow-hidden rounded-t-3xl border shadow-2xl sm:max-w-md sm:rounded-3xl ${
            isDarkMode ? 'border-white/10 bg-neutral-900 text-white' : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500" />
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <BrandMark onDark={isDarkMode} subtitle="Sync your resume versions" />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isDarkMode ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AuthForm
              isDarkMode={isDarkMode}
              titleId={titleId}
              onGoogle={handleGoogleLogin}
              onEmailLogin={handleEmailLogin}
              onEmailSignUp={handleEmailSignUp}
              onPasswordReset={handlePasswordReset}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
