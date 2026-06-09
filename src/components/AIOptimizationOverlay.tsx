import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Square, Zap, Cpu, CheckCircle2, Shield, 
  Activity, Award, Search, Check, AlertCircle 
} from 'lucide-react';

interface AIOptimizationOverlayProps {
  isOptimizing: boolean;
  onStop: () => void;
  progress: number;
  statusText?: string;
  targetRole?: string;
  targetCompany?: string;
}

export const AIOptimizationOverlay: React.FC<AIOptimizationOverlayProps> = ({
  isOptimizing,
  onStop,
  progress,
  statusText = "Analyzing resume nodes...",
  targetRole = "Software Engineer",
  targetCompany = "Enterprise"
}) => {
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const explosionTriggered = useRef(false);

  // Auto-progress stages over 9 seconds for cinematic effect
  useEffect(() => {
    if (!isOptimizing) {
      setStage(1);
      setTimeElapsed(0);
      setScore(0);
      explosionTriggered.current = false;
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => {
        const nextTime = prev + 0.1;
        
        // Define stage boundaries
        if (nextTime < 1.0) {
          if (stage !== 1) setStage(1);
        } else if (nextTime < 2.0) {
          if (stage !== 2) setStage(2);
        } else if (nextTime < 4.0) {
          if (stage !== 3) setStage(3);
        } else if (nextTime < 6.0) {
          if (stage !== 4) setStage(4);
        } else if (nextTime < 7.5) {
          if (stage !== 5) setStage(5);
        } else {
          if (stage !== 6) setStage(6);
        }

        // Animated Score during Stage 5 and 6
        if (nextTime >= 6.0) {
          const targetScore = 95;
          const startSec = 6.0;
          const endSec = 7.5;
          const ratio = Math.min(1, (nextTime - startSec) / (endSec - startSec));
          
          // Custom interpolation sequence reflecting the steps: 0 → 15 → 25 → 40 → 68 → 82 → 95
          let interpolatedScore = 0;
          if (ratio < 0.15) {
            interpolatedScore = Math.round(0 + (15 - 0) * (ratio / 0.15));
          } else if (ratio < 0.3) {
            interpolatedScore = Math.round(15 + (25 - 15) * ((ratio - 0.15) / 0.15));
          } else if (ratio < 0.5) {
            interpolatedScore = Math.round(25 + (40 - 25) * ((ratio - 0.3) / 0.2));
          } else if (ratio < 0.7) {
            interpolatedScore = Math.round(40 + (68 - 40) * ((ratio - 0.5) / 0.2));
          } else if (ratio < 0.85) {
            interpolatedScore = Math.round(68 + (82 - 68) * ((ratio - 0.7) / 0.15));
          } else {
            interpolatedScore = Math.round(82 + (95 - 82) * ((ratio - 0.85) / 0.15));
          }
          setScore(interpolatedScore);
        }

        return nextTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOptimizing, stage]);

  // Particle Canvas field logic (GPU accelerated with clean WebGL-like aesthetic)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
      pulse?: boolean;
      pulseSpeed?: number;
    }> = [];

    // Initialize network particles
    const particleCount = 100;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.15,
        color: '#00E5FF'
      });
    }

    const explosions: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      life: number;
      maxLife: number;
      color: string;
    }> = [];

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep Space Blue Ambient radial glow
      const radialGlow = ctx.createRadialGradient(
        width / 2, height / 2, 50,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      radialGlow.addColorStop(0, '#0a0d16');
      radialGlow.addColorStop(0.5, '#05070d');
      radialGlow.addColorStop(1, '#020306');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // Render Stage 1 background target grid in perspective
      if (stage >= 1) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.03)';
        ctx.lineWidth = 1;
        const spacing = 40;
        for (let x = 0; x < width; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      // Draw particle nodes
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        // Circular warp boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Gravitational pull toward central resume at Stage 3
        if (stage === 3) {
          const dx = width / 2 - p.x;
          const dy = height / 2 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 100 && dist < 400) {
            p.vx += (dx / dist) * 0.015;
            p.vy += (dy / dist) * 0.015;
            // Cap velocity
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > 1.5) {
              p.vx = (p.vx / speed) * 1.5;
              p.vy = (p.vy / speed) * 1.5;
            }
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${p.alpha})`;
        ctx.fill();

        // Connect near nodes to look like an AI neural nexus
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.12;
            ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      // Handle custom success explosion triggers on Stage 6
      if (stage === 6 && !explosionTriggered.current) {
        explosionTriggered.current = true;
        const colors = ['#00E5FF', '#00E676', '#311B92', '#ffffff'];
        for (let k = 0; k < 120; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 8 + 3;
          explosions.push({
            x: width / 2,
            y: height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 3 + 1,
            alpha: 1,
            life: 0,
            maxLife: Math.random() * 40 + 30,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }

      // Draw active explosions
      for (let eIdx = explosions.length - 1; eIdx >= 0; eIdx--) {
        const e = explosions[eIdx];
        e.x += e.vx;
        e.y += e.vy;
        e.vx *= 0.96; // drag
        e.vy *= 0.96;
        e.life++;
        e.alpha = 1 - e.life / e.maxLife;

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = e.alpha > 0 ? e.color : 'transparent';
        ctx.globalAlpha = Math.max(0, e.alpha);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (e.life >= e.maxLife) {
          explosions.splice(eIdx, 1);
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [stage]);

  return (
    <AnimatePresence>
      {isOptimizing && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] overflow-hidden select-none flex flex-col justify-between p-6 md:p-8 text-white font-sans"
        >
          {/* Canvas Component for High Performance Particle Acceleration */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

          {/* Floating HUD ambient lines and grid decorations */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00E5FF]/20 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#00E5FF]/10 to-transparent pointer-events-none" />
          
          {/* TOP HEADER: Brand Identity */}
          <div className="relative z-10 w-full max-w-7xl mx-auto flex justify-between items-center bg-transparent pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF]/20 to-[#311B92]/30 border border-[#00E5FF]/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Cpu className="w-5 h-5 text-[#00E5FF] animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-widest text-[#00E5FF] uppercase">NEXUS RESUME AI</h2>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">FAANG Core Alignment Engine v3.2</p>
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1 font-mono text-[10px] text-cyan-400">
              <span className="flex items-center gap-1.5 bg-black/40 border border-cyan-500/20 px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                SYSTEM LOG: PIPELINE_ACTIVE
              </span>
              <span className="text-gray-500">OPTIMIZING STAGE {stage}/6</span>
            </div>
          </div>

          {/* CENTRAL STAGE: Cinematic Scene Flow Area */}
          <div className="relative z-10 w-full max-w-7xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center justify-center my-4 overflow-hidden">
            
            {/* Left Wing - AI HUD metrics and charts */}
            <div className="hidden lg:col-span-3 lg:flex flex-col gap-5 h-[410px]">
              <AnimatePresence mode="popLayout">
                {stage >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 flex flex-col justify-between p-5 rounded-2xl bg-neutral-950/70 border border-white/5 backdrop-blur-xl relative overflow-hidden group hover:border-[#00E5FF]/20 transition-all duration-500"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#00E5FF]/5 rounded-bl-full pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-[#00E5FF]" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF]">Holographic Intel</h3>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-4 font-mono leading-relaxed leading-3">
                        Analyzing critical semantic weights and context clusters...
                      </p>
                    </div>

                    {/* Handcrafted Interactive SVG Radar Chart */}
                    <div className="flex-1 flex items-center justify-center relative my-2">
                      <RadarChartWidget stage={stage} />
                    </div>

                    <div className="border-t border-white/5 pt-3 mt-1 text-[9px] font-mono text-gray-500 flex justify-between">
                      <span>RADAR SCAN</span>
                      <span className="text-cyan-400 animate-pulse">MATCH_RATIO: 95%</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {stage >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="p-5 rounded-2xl bg-neutral-950/70 border border-white/5 backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-500"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-gray-500 uppercase">System Integrity</span>
                      <span className={`text-[10px] font-mono ${stage === 6 ? 'text-emerald-400' : 'text-[#00E5FF] animate-pulse'}`}>
                        {stage === 6 ? 'SECURE' : 'PROCESSING'}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                      <motion.div 
                        className={`h-full ${stage === 6 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                        initial={{ width: '10%' }}
                        animate={{ width: stage === 6 ? '100%' : '75%' }}
                        transition={{ duration: 1.5 }}
                      />
                    </div>
                    <div className="mt-2.5 flex justify-between items-center">
                      <span className="text-[9px] font-mono text-gray-500">Latency Profile</span>
                      <span className="text-[10px] font-mono text-[#00E5FF]">14ms</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Middle Wing - 3D Floating Resume Template and Scanning Beam */}
            <div className="col-span-1 lg:col-span-6 flex flex-col justify-center items-center relative min-h-[460px]">
              
              {/* Circular Materialization Platform at stage 1+ */}
              <div className="absolute w-[280px] h-[30px] rounded-full bg-gradient-to-r from-[#00E5FF]/20 to-[#311B92]/3 transition-all duration-1000 bottom-12 filter blur-md transform scale-125 opacity-30 pointer-events-none" />
              <div className="absolute w-[180px] h-[15px] rounded-full bg-cyan-400/40 bottom-14 filter blur-sm opacity-20 pointer-events-none animate-pulse" />

              {/* Floating Resume Holder */}
              <AnimatePresence>
                {stage >= 2 && (
                  <FloatingResumeCard stage={stage} targetRole={targetRole} targetCompany={targetCompany} />
                )}
              </AnimatePresence>

              {/* Laser Scanning Beam Component */}
              <AnimatePresence>
                {stage === 3 && (
                  <ScanBeam />
                )}
              </AnimatePresence>

              {/* Holographic HUD Circle Ring */}
              <AnimatePresence>
                {stage === 5 && (
                  <ATSScoreRing value={score} />
                )}
              </AnimatePresence>

              {/* Success Showcase Overlay State */}
              <AnimatePresence>
                {stage === 6 && (
                  <OptimizationSuccessState score={score} />
                )}
              </AnimatePresence>
            </div>

            {/* Right Wing - Real-time metrics analyzer feedback */}
            <div className="hidden lg:col-span-3 lg:flex flex-col gap-5 h-[410px]">
              <AnimatePresence mode="popLayout">
                {stage >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 p-5 rounded-2xl bg-neutral-950/70 border border-white/5 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between hover:border-[#00E5FF]/20 transition-all duration-500"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Search className="w-4 h-4 text-[#00E5FF]" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-[#00E5FF]">Real-time Analysis</h3>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mb-4 leading-relaxed leading-3">
                        Evaluating suitability scores and matching keyword frequencies...
                      </p>
                    </div>

                    {/* HUD Status Analytics Rows */}
                    <div className="flex-1 flex flex-col justify-center gap-3">
                      <HudRow label="ATS Compatibility" value="Optimized" status="success" stage={stage} />
                      <HudRow label="Keyword Overlaps" value="95% Alignment" status="success" stage={stage} />
                      <HudRow label="Leadership Voice" value="Executive" status="active" stage={stage} />
                      <HudRow label="Education Nodes" value="Validated" status="success" stage={stage} />
                    </div>

                    <div className="border-t border-white/5 pt-3 text-[9px] font-mono text-gray-500 flex justify-between">
                      <span>FEEDBACK LOGS</span>
                      <span className="text-[#00E5FF]">{Math.round(progress)}% COMPLETE</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {stage >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="p-5 rounded-2xl bg-neutral-950/70 border border-white/5 backdrop-blur-xl flex flex-col gap-1 text-center items-center justify-center relative overflow-hidden group hover:border-[#00E5FF]/25 duration-500 transition-all"
                  >
                    <span className="text-[10px] uppercase font-mono text-gray-500 tracking-widest">Selected Company Profile</span>
                    <span className="text-sm font-black tracking-wide text-[#00E5FF] capitalize mt-0.5">{targetCompany}</span>
                    <span className="text-[9px] font-mono text-gray-500 tracking-wide mt-1">Optimization Profile Active</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* BOTTOM REGION: System Logs, Status and stop controls */}
          <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between border-t border-white/5 pt-4 bg-transparent mb-2">
            <div className="text-left max-w-lg mb-4 md:mb-0">
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block mb-1">CURRENT ACTIVE ROUTE STATUS</span>
              <p className="text-xs font-mono text-[#00E5FF] animate-pulse whitespace-pre-line leading-relaxed h-[36px] overflow-hidden">
                {statusText || "Assembling semantic structural frameworks..."}
              </p>
            </div>

            {/* MANDATORY STOP BUTTON: Cancel immediately and return to safety workspace */}
            <div className="flex items-center gap-4">
              <button
                onClick={onStop}
                className="group relative overflow-hidden px-6 py-2.5 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold font-mono uppercase tracking-widest transition-all duration-300 shadow-lg shadow-red-500/5 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <Square className="w-3.5 h-3.5 fill-current text-red-500" />
                <span>TERMINATE OPTIMIZER</span>
              </button>
            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* Mini Helper Components */

const HudRow: React.FC<{ label: string; value: string; status: 'success' | 'active' | 'warning'; stage: number }> = ({ label, value, status, stage }) => {
  return (
    <div className="flex flex-col gap-1 w-full text-left bg-white/[0.02] border border-white/5 px-3 py-2 rounded-lg">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono text-gray-400">{label}</span>
        <span className={`text-[10.5px] font-mono uppercase font-black ${status === 'success' ? 'text-emerald-400' : 'text-cyan-400'}`}>{value}</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full ${status === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'}`}
          initial={{ width: '0%' }}
          animate={{ width: stage === 6 ? '100%' : '80%' }}
          transition={{ duration: 1.2 }}
        />
      </div>
    </div>
  );
};

// Handcrafted interactive SVG Radar Chart for futuristic tech center feel
const RadarChartWidget: React.FC<{ stage: number }> = ({ stage }) => {
  // Vertices configurations (5 vertices representing: ATS, Word Count, Keywords, Skills, Experience)
  const [val1, setVal1] = useState(40);
  const [val2, setVal2] = useState(30);
  const [val3, setVal3] = useState(50);
  const [val4, setVal4] = useState(25);
  const [val5, setVal5] = useState(35);

  useEffect(() => {
    if (stage === 1 || stage === 2) {
      setVal1(30); setVal2(40); setVal3(30); setVal4(35); setVal5(25);
    } else if (stage === 3) {
      setVal1(55); setVal2(45); setVal3(60); setVal4(50); setVal5(40);
    } else if (stage === 4) {
      setVal1(75); setVal2(68); setVal3(82); setVal4(70); setVal5(65);
    } else if (stage >= 5) {
      setVal1(95); setVal2(90); setVal3(95); setVal4(92); setVal5(94);
    }
  }, [stage]);

  // Convert vertex percentage to polar coordinates
  const getCoordinates = (percent: number, angleDegrees: number) => {
    const angleRad = (angleDegrees - 90) * (Math.PI / 180);
    const radius = (percent / 100) * 65; // Max radius 65
    return {
      x: 100 + radius * Math.cos(angleRad),
      y: 100 + radius * Math.sin(angleRad)
    };
  };

  const p1 = getCoordinates(val1, 0);       // ATS
  const p2 = getCoordinates(val2, 72);      // Word Count
  const p3 = getCoordinates(val3, 144);     // Keywords
  const p4 = getCoordinates(val4, 216);     // Skills
  const p5 = getCoordinates(val5, 288);     // Experience

  const pointsString = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y}`;

  return (
    <svg className="w-full h-full max-w-[170px] max-h-[170px]" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#311B92" stopOpacity="0.0" />
        </radialGradient>
      </defs>

      {/* Spiderweb Background Circles or Pentagons */}
      {[20, 40, 60, 80, 100].map((level) => {
        const c1 = getCoordinates(level, 0);
        const c2 = getCoordinates(level, 72);
        const c3 = getCoordinates(level, 144);
        const c4 = getCoordinates(level, 216);
        const c5 = getCoordinates(level, 288);
        return (
          <polygon
            key={level}
            points={`${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y} ${c5.x},${c5.y}`}
            fill="none"
            stroke="rgba(0, 229, 255, 0.08)"
            strokeWidth="1"
          />
        );
      })}

      {/* Spoke lines */}
      {[0, 72, 144, 216, 288].map((angle, idx) => {
        const coord = getCoordinates(100, angle);
        return (
          <line
            key={idx}
            x1="100"
            y1="100"
            x2={coord.x}
            y2={coord.y}
            stroke="rgba(0, 229, 255, 0.12)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        );
      })}

      {/* Shaded Active Area */}
      <polygon
        points={pointsString}
        fill="url(#radarGlow)"
        stroke="#00E5FF"
        strokeWidth="1.5"
        className="transition-all duration-1000 ease-out"
      />

      {/* Floating Active Node Vertices */}
      {[p1, p2, p3, p4, p5].map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r="3"
          fill="#00E5FF"
          stroke="#05070d"
          strokeWidth="1"
          className="transition-all duration-1000 ease-out"
        />
      ))}

      {/* Axis Labels */}
      <text x="100" y="22" fill="#00E5FF" fontSize="7" fontWeight="bold" textAnchor="middle" className="font-mono">ATS</text>
      <text x="175" y="80" fill="gray" fontSize="7" textAnchor="start" className="font-mono">WORDS</text>
      <text x="150" y="172" fill="gray" fontSize="7" textAnchor="start" className="font-mono">KEYWORDS</text>
      <text x="50" y="172" fill="gray" fontSize="7" textAnchor="end" className="font-mono">SKILLS</text>
      <text x="25" y="80" fill="gray" fontSize="7" textAnchor="end" className="font-mono">EXP</text>
    </svg>
  );
};

// 3D Glassmorphic Floating Resume Card
const FloatingResumeCard: React.FC<{ stage: number; targetRole: string; targetCompany: string }> = ({ stage, targetRole, targetCompany }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 120, rotateX: 65, rotateZ: -15, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: stage >= 6 ? -15 : 0, 
        rotateX: stage >= 5 ? 12 : 28,
        rotateY: stage >= 5 ? -8 : -18,
        rotateZ: stage >= 5 ? -3 : -6, 
        scale: stage >= 5 ? 0.94 : 0.90,
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 55, 
        damping: 18,
        y: { duration: 1.2 }
      }}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
      className={`relative w-[310px] h-[400px] rounded-2xl glass-panel border ${
        stage === 6 ? 'border-emerald-500/40 shadow-2xl shadow-emerald-500/10 bg-black/85' : 'border-white/10 shadow-2xl shadow-cyan-500/5 bg-black/60'
      } backdrop-blur-xl p-5 flex flex-col justify-between overflow-hidden transition-all duration-1000 z-10`}
    >
      {/* Decorative circuitry and highlights */}
      <div className="absolute top-0 left-0 w-16 h-1 bg-[#00E5FF] shadow-lg shadow-[#00E5FF]/40 rounded-full" />
      <div className="absolute -right-40 -top-40 w-80 h-80 bg-[#00E5FF]/[0.02] rounded-full pointer-events-none filter blur-xl" />

      {/* Header section of floating resume Mockup */}
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1 text-left">
            <div className={`h-3 w-28 rounded-full ${stage === 6 ? 'bg-emerald-400' : 'bg-gray-700'} animate-pulse`} />
            <div className="h-2 w-36 bg-gray-800 rounded-full" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Award className={`w-4 h-4 ${stage === 6 ? 'text-emerald-400' : 'text-[#00E5FF]'}`} />
          </div>
        </div>

        {/* Contact Strip */}
        <div className="flex gap-2 justify-start items-center">
          <div className="h-1.5 w-12 bg-gray-800 rounded-full" />
          <div className="h-1.5 w-1.5 bg-gray-700 rounded-full" />
          <div className="h-1.5 w-16 bg-gray-800 rounded-full" />
        </div>

        <div className="w-full h-[1px] bg-white/5" />

        {/* Summary Placeholder */}
        <div className="space-y-2 text-left">
          <div className="text-[10px] font-black tracking-widest text-[#00E5FF] font-mono">EXECUTIVE SUMMARY</div>
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-gray-800 rounded-full" />
            <div className="h-2 w-full bg-gray-800 rounded-full" />
            <div className="h-2 w-5/6 bg-gray-800 rounded-full" />
          </div>
        </div>

        {/* Experience Placeholder */}
        <div className="space-y-3.5 text-left pt-2">
          <div className="text-[10px] font-black tracking-widest text-[#00E5FF] font-mono">PROFESSIONAL EXPERIENCE</div>
          
          <div className="space-y-2.5 relative">
            <div className="flex justify-between items-center">
              <div className="h-2.5 w-32 bg-gray-700 rounded-full" />
              <div className="h-2 w-14 bg-gray-800 rounded-full" />
            </div>

            {/* Simulated bullet list highlights scanned */}
            <div className="space-y-1.5 pl-2 relative">
              <div className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-[#00E5FF]/40 to-transparent" />
              <div className="flex items-center gap-1.5">
                <div className={`w-1 h-1 rounded-full ${stage === 6 ? 'bg-emerald-400' : 'bg-[#00E5FF] animate-ping'}`} />
                <div className="h-2 flex-1 bg-neutral-800/80 rounded-full relative overflow-hidden">
                  {stage === 3 && (
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#00E5FF] to-transparent w-2/3"
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-neutral-700" />
                <div className="h-2 w-4/5 bg-neutral-800/80 rounded-full" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-neutral-700" />
                <div className="h-2 w-11/12 bg-neutral-800/80 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mock target tags at the bottom */}
      <div className="flex justify-between items-center bg-black/40 border border-white/5 p-2 rounded-xl mt-4">
        <span className="text-[9px] font-mono text-gray-500 uppercase">Target Role:</span>
        <span className="text-[10px] font-bold text-[#00E5FF] truncate max-w-[120px] capitalize">{targetRole}</span>
      </div>
    </motion.div>
  );
};

// Scan Beam laser light swoop
const ScanBeam: React.FC = () => {
  return (
    <motion.div
      initial={{ top: '15%' }}
      animate={{ top: ['15%', '82%', '15%'] }}
      transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
      className="absolute w-[335px] left-1/2 -translate-x-1/2 h-[5px] bg-[#00E5FF] pointer-events-none z-20 flex items-center justify-center filter blur-[0.6px]"
      style={{
        boxShadow: '0 0 15px 4px rgba(0, 229, 255, 0.7), 0 0 4px 1px #00E5FF'
      }}
    >
      <div className="w-full h-[1px] bg-white" />
    </motion.div>
  );
};

// ATS Score radial gauge countdown spinner
const ATSScoreRing: React.FC<{ value: number }> = ({ value }) => {
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      className="absolute inset-0 m-auto w-[220px] h-[220px] bg-neutral-950/95 border border-[#00E5FF]/20 rounded-full backdrop-blur-2xl flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/25 z-30"
    >
      <div className="relative w-[150px] h-[150px] flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {/* Base track */}
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth={strokeWidth}
          />
          {/* Progress fill */}
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="transparent"
            stroke="#00E5FF"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.1s ease',
              filter: 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.6))'
            }}
          />
        </svg>

        {/* Dynamic score label centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none">ATS Score</span>
          <span className="text-4xl font-black tracking-tight text-[#00E5FF] font-mono leading-none my-1">{value}</span>
          <span className="text-[9.5px] font-mono text-cyan-400/80 leading-none">CRITICAL CAP</span>
        </div>
      </div>

      {/* Pulsing energy waves */}
      <div className="absolute -inset-2.5 border border-cyan-400/10 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
    </motion.div>
  );
};

// Successful Optimization Showcase Complete State overlay
const OptimizationSuccessState: React.FC<{ score: number }> = ({ score }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 m-auto w-[240px] h-[240px] bg-neutral-950 border border-emerald-500/40 rounded-full backdrop-blur-3xl flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/20 z-40"
    >
      {/* Dynamic green verification circle */}
      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-2.5 shadow-lg shadow-emerald-500/5 select-none font-mono">
        <Check className="w-7 h-7 text-emerald-400 stroke-[3px]" />
      </div>

      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest leading-none">TARGET ATS SEGMENT</span>
      <h3 className="text-sm font-black tracking-widest text-emerald-400 font-mono mt-1 leading-none uppercase">SUCCESS SECURED</h3>
      
      {/* Highly optimized prominent displays */}
      <div className="mt-3 text-center">
        <span className="text-4xl font-black text-white font-mono leading-none tracking-tight">{score}</span>
        <span className="text-[11px] font-mono text-gray-400 block mt-0.5">EXECUTIVE SUITE 95/100</span>
      </div>

      {/* Decorative success pulses around */}
      <div className="absolute -inset-3 border border-emerald-500/20 rounded-full animate-pulse opacity-70" />
    </motion.div>
  );
};
