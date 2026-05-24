import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface GeminiAmbientGlowProps {
  status?: 'idle' | 'optimizing' | 'analyzing' | 'listening' | 'loading';
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

/**
 * GeminiAmbientGlow
 * A high-performance, GPU-accelerated ambient background system.
 * Designed to be PDF-safe and non-blocking for existing UI.
 */
export const GeminiAmbientGlow: React.FC<GeminiAmbientGlowProps> = ({ 
  status = 'idle', 
  intensity = 'medium',
  className = ''
}) => {
  return (
    <div 
      id="gemini-ambient-glow-root"
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none print:hidden z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Base Atmospheric Layer */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${
        status === 'optimizing' ? 'opacity-100' : 'opacity-60'
      }`}>
        <div className={`gemini-glow-container status-${status} intensity-${intensity}`}>
          <div className="glow-mesh glow-1" />
          <div className="glow-mesh glow-2" />
          <div className="glow-mesh glow-3" />
          <div className="glow-mesh glow-4" />
        </div>
      </div>

      {/* Narrative/Status Light Pulse (Overlay) */}
      <AnimatePresence>
        {status === 'optimizing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-0 h-[40vh] bg-gradient-to-b from-blue-500/20 to-transparent blur-[120px]"
          />
        )}
      </AnimatePresence>

      {/* Grain/Texture Overlay for Cinematic Quality */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
};
