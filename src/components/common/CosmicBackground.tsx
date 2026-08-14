import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  blinkPhase: number;
  blinkSpeed: number;
}

const PARTICLE_COUNT = 80;

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  useEffect(() => {
    if (prefersReducedMotion || !isDark) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      size: Math.random() * 1.5 + 0.4,
      opacity: Math.random() * 0.6 + 0.1,
      blinkPhase: Math.random() * Math.PI * 2,
      blinkSpeed: Math.random() * 0.012 + 0.006,
    }));

    const tick = () => {
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -2) p.x = canvas.width + 2;
        if (p.x > canvas.width + 2) p.x = -2;
        if (p.y < -2) p.y = canvas.height + 2;
        if (p.y > canvas.height + 2) p.y = -2;

        p.blinkPhase += p.blinkSpeed;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.blinkPhase));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(157, 143, 255, ${alpha.toFixed(2)})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isDark, prefersReducedMotion]);

  if (prefersReducedMotion || !isDark) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
