import React, { useEffect, useRef } from 'react';

interface AINeuralNetworkBackgroundProps {
  isDarkMode: boolean;
  opacity?: number;
}

interface NetworkNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
  pulseSpeed: number;
  size: number;
  glow: number;
  energy: number;
  group: number;
}

interface NetworkPacket {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  speed: number;
  color: string;
  size: number;
}

interface ClickRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
}

export function AINeuralNetworkBackground({ isDarkMode, opacity = 0.25 }: AINeuralNetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const ripplesRef = useRef<ClickRipple[]>([]);
  const packetsRef = useRef<NetworkPacket[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Setup resize handler
    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Pointer activity tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
        mouseRef.current.active = true;
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.active = false;
    };

    const handleWindowClick = (e: MouseEvent) => {
      // Spawn standard expanding ripple
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: Math.max(width, height) * 0.45,
        speed: 4.5,
        opacity: 0.8
      });

      // Additionally inject direct energy packets outwards from closest nodes
      let targetNodesIdxs: number[] = [];
      nodes.forEach((node, idx) => {
        const dist = Math.hypot(node.x - e.clientX, node.y - e.clientY);
        if (dist < 220) {
          targetNodesIdxs.push(idx);
          node.energy = Math.min(2.5, node.energy + 1.5);
          node.glow = Math.min(3, node.glow + 2.0);
        }
      });

      // Spawn packets between stimulated nodes
      if (targetNodesIdxs.length >= 2) {
        const numPackets = Math.min(8, targetNodesIdxs.length);
        for (let p = 0; p < numPackets; p++) {
          const startIdx = targetNodesIdxs[p % targetNodesIdxs.length];
          const endIdx = targetNodesIdxs[(p + 1) % targetNodesIdxs.length];
          const n1 = nodes[startIdx];
          const n2 = nodes[endIdx];
          
          packetsRef.current.push({
            startX: n1.x,
            startY: n1.y,
            endX: n2.x,
            endY: n2.y,
            progress: 0,
            speed: 0.015 + Math.random() * 0.02,
            color: isDarkMode ? '#10b981' : '#3b82f6',
            size: 2 + Math.random() * 2
          });
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('click', handleWindowClick);

    // Dynamic scale node count based on display size
    const nodeDensity = 17000; // px per node
    const numNodes = Math.min(85, Math.max(30, Math.floor((width * height) / nodeDensity)));
    const nodes: NetworkNode[] = [];

    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.008 + Math.random() * 0.012,
        size: 1.5 + Math.random() * 2.5,
        glow: 0.2 + Math.random() * 0.5,
        energy: 1.0,
        group: Math.floor(Math.random() * 3)
      });
    }

    // Main Draw Cycle
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Color themes depending on light vs dark mode
      const primaryColor = isDarkMode ? '16, 185, 129' : '59, 130, 246'; // emerald vs blue
      const secondaryColor = isDarkMode ? '6, 182, 212' : '99, 102, 241'; // cyan vs indigo
      const pulseColor = isDarkMode ? '#34d399' : '#60a5fa';

      // 1. Process Ripples
      const ripples = ripplesRef.current;
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r];
        rip.radius += rip.speed;
        rip.opacity -= 0.015;

        if (rip.opacity <= 0 || rip.radius > rip.maxRadius) {
          ripples.splice(r, 1);
          continue;
        }

        // Draw elegant circular indicator wave
        ctx.strokeStyle = `rgba(${primaryColor}, ${rip.opacity * 0.15})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Stimulate nodes in ripple threshold
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const dist = Math.hypot(node.x - rip.x, node.y - rip.y);
          if (Math.abs(dist - rip.radius) < 25) {
            node.energy = Math.min(2.5, node.energy + 0.15 * rip.opacity);
            node.glow = Math.min(2.5, node.glow + 0.2 * rip.opacity);
          }
        }
      }

      // 2. Physics & Node Movement
      const mouse = mouseRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        
        // Decay stimulated visual parameters back to baseline
        if (n.energy > 1.0) n.energy -= 0.012;
        if (n.glow > 0.4) n.glow -= 0.015;

        // Apply standard drift physics
        n.x += n.vx * n.energy;
        n.y += n.vy * n.energy;
        n.pulse += n.pulseSpeed * n.energy;

        // Handle screen boundaries with soft wrap
        if (n.x < -30) n.x = width + 30;
        else if (n.x > width + 30) n.x = -30;

        if (n.y < -30) n.y = height + 30;
        else if (n.y > height + 30) n.y = -30;

        // Interaction with mouse gravity
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 220) {
            const pullStrength = (1 - dist / 220) * 0.18;
            n.x += (dx / dist) * pullStrength * n.energy;
            n.y += (dy / dist) * pullStrength * n.energy;
            // Elevate energy of nodes in mouse bubble
            n.energy = Math.min(1.8, n.energy + 0.015);
            n.glow = Math.min(1.8, n.glow + 0.01);
          }
        }
      }

      // 3. Render Connections / Lines
      const maxDistance = 160;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          
          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.14 * ((n1.glow + n2.glow) / 2);
            ctx.lineWidth = (1 - dist / maxDistance) * 0.8 + 0.2;
            
            // Draw connection line
            const matchColor = n1.group === n2.group ? primaryColor : secondaryColor;
            ctx.strokeStyle = `rgba(${matchColor}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();

            // Intermittently spawn packets organically
            if (packetsRef.current.length < 35 && Math.random() < 0.00035) {
              packetsRef.current.push({
                startX: n1.x,
                startY: n1.y,
                endX: n2.x,
                endY: n2.y,
                progress: 0,
                speed: 0.004 + Math.random() * 0.008,
                color: n1.group === n2.group ? pulseColor : `rgba(${secondaryColor}, 1)`,
                size: 1 + Math.random() * 1.5
              });
            }
          }
        }
      }

      // 4. Connect active mouse point directly to closest nodes
      if (mouse.active) {
        ctx.shadowBlur = 0;
        let count = 0;
        for (let i = 0; i < nodes.length && count < 6; i++) {
          const n = nodes[i];
          const dist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          if (dist < 180) {
            count++;
            const alpha = (1 - dist / 180) * 0.18;
            ctx.strokeStyle = `rgba(${primaryColor}, ${alpha})`;
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // 5. Draw Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulseFactor = Math.sin(n.pulse);
        const currentSize = (n.size + pulseFactor * 0.6) * Math.min(2.0, n.energy);
        const colorAlpha = 0.18 + (pulseFactor + 1) * 0.15 + (n.glow * 0.15);

        // Subtly choose teal vs cyan
        const useColor = n.group === 0 ? primaryColor : secondaryColor;

        // Inner glowing shadow
        if (n.glow > 0.8) {
          ctx.shadowBlur = n.glow * 4.5;
          ctx.shadowColor = `rgba(${useColor}, 0.8)`;
        }

        ctx.fillStyle = `rgba(${useColor}, ${colorAlpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentSize, 0, Math.PI * 2);
        ctx.fill();

        // Node core
        ctx.fillStyle = isDarkMode 
          ? `rgba(255, 255, 255, ${0.45 + n.glow * 0.25})`
          : `rgba(255, 255, 255, ${0.75 + n.glow * 0.1})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentSize * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset
      }

      // 6. Draw Energy Packets (Pulses)
      const packets = packetsRef.current;
      for (let k = packets.length - 1; k >= 0; k--) {
        const p = packets[k];
        p.progress += p.speed;

        if (p.progress >= 1) {
          packets.splice(k, 1);
          continue;
        }

        const currentX = p.startX + (p.endX - p.startX) * p.progress;
        const currentY = p.startY + (p.endY - p.startY) * p.progress;

        // Draw elegant glowing pulse node
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        
        ctx.beginPath();
        ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('click', handleWindowClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDarkMode]);

  return (
    <div 
      className="fixed inset-0 w-full h-full pointer-events-none -z-20 overflow-hidden" 
      style={{ opacity }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full bg-transparent" />
    </div>
  );
}
