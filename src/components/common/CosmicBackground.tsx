import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

type CursorMode = 'default' | 'pointer' | 'text' | 'disabled';

const IDLE_HIDE_DELAY_MS = 1200;

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isDark } = useTheme();
  const rafRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);
  const fadeAlphaRef = useRef<number>(0); 

  const mouseRef = useRef({
    x: -1000,
    y: -1000,
    targetX: -1000,
    targetY: -1000,
    ringX: -1000,
    ringY: -1000,
    mode: 'default' as CursorMode,
    isClicking: false,
    isInsideWindow: false,
    isIdle: false,
  });

  const ripplesRef = useRef<WaterRipple[]>([]);
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (mouseRef.current.targetX === -1000) {
        mouseRef.current.x = canvas.width / 2;
        mouseRef.current.y = canvas.height * 0.3;
        mouseRef.current.targetX = mouseRef.current.x;
        mouseRef.current.targetY = mouseRef.current.y;
        mouseRef.current.ringX = mouseRef.current.x;
        mouseRef.current.ringY = mouseRef.current.y;
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const resetIdleTimer = () => {
      mouseRef.current.isIdle = false;
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(() => {
        mouseRef.current.isIdle = true;
      }, IDLE_HIDE_DELAY_MS);
    };

    const onMouseMove = (event: MouseEvent) => {
      mouseRef.current.targetX = event.clientX;
      mouseRef.current.targetY = event.clientY;
      mouseRef.current.isInsideWindow = true;
      resetIdleTimer();

      const target = event.target as HTMLElement | null;
      if (target) {
        if (target.closest('input, textarea, [contenteditable="true"]')) {
          mouseRef.current.mode = 'text';
        } else if (target.closest('button:disabled, [aria-disabled="true"]')) {
          mouseRef.current.mode = 'disabled';
        } else if (
          target.closest('button, a, select, [role="button"], .project-card, .file-workspace-row, .editor-cue-card, .cursor-pointer, .sidebar-nav-item, .ui-button')
        ) {
          mouseRef.current.mode = 'pointer';
        } else {
          mouseRef.current.mode = 'default';
        }
      }
    };

    const onMouseEnter = () => {
      mouseRef.current.isInsideWindow = true;
      resetIdleTimer();
    };

    const onMouseLeave = () => {
      mouseRef.current.isInsideWindow = false;
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const onWindowBlur = () => {
      mouseRef.current.isInsideWindow = false;
    };

    const onWindowFocus = () => {
      mouseRef.current.isInsideWindow = true;
      resetIdleTimer();
    };

    const onMouseDown = (event: MouseEvent) => {
      mouseRef.current.isClicking = true;
      mouseRef.current.isInsideWindow = true;
      resetIdleTimer();

      const x = event.clientX;
      const y = event.clientY;

      ripplesRef.current.push(
        {
          x,
          y,
          radius: 4,
          maxRadius: 85,
          alpha: 0.75,
          speed: 2.8,
          lineWidth: 2.2,
        },
        {
          x,
          y,
          radius: 2,
          maxRadius: 130,
          alpha: 0.55,
          speed: 3.6,
          lineWidth: 1.6,
        },
        {
          x,
          y,
          radius: 1,
          maxRadius: 175,
          alpha: 0.35,
          speed: 4.4,
          lineWidth: 1.0,
        }
      );
    };

    const onMouseUp = () => {
      mouseRef.current.isClicking = false;
      resetIdleTimer();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseenter', onMouseEnter, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });

    const tick = () => {
      const shouldBeVisible = mouseRef.current.isInsideWindow && !mouseRef.current.isIdle;
      const targetAlpha = shouldBeVisible ? 1 : 0;
      fadeAlphaRef.current += (targetAlpha - fadeAlphaRef.current) * 0.12;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;
      mouseRef.current.ringX += (mouseRef.current.targetX - mouseRef.current.ringX) * 0.22;
      mouseRef.current.ringY += (mouseRef.current.targetY - mouseRef.current.ringY) * 0.22;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentAlpha = fadeAlphaRef.current;

      if (currentAlpha > 0.005) {
        const maxDim = Math.max(canvas.width, canvas.height);
        const spotlightRadius = maxDim * 0.55;
        const spotlight = ctx.createRadialGradient(
          mouseRef.current.x,
          mouseRef.current.y,
          0,
          mouseRef.current.x,
          mouseRef.current.y,
          spotlightRadius
        );

        if (isDark) {
          spotlight.addColorStop(0, `rgba(59, 130, 246, ${(0.15 * currentAlpha).toFixed(3)})`); 
          spotlight.addColorStop(0.25, `rgba(99, 102, 241, ${(0.08 * currentAlpha).toFixed(3)})`); 
          spotlight.addColorStop(0.55, `rgba(37, 99, 235, ${(0.025 * currentAlpha).toFixed(3)})`);
          spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          spotlight.addColorStop(0, `rgba(37, 99, 235, ${(0.09 * currentAlpha).toFixed(3)})`);
          spotlight.addColorStop(0.35, `rgba(79, 70, 229, ${(0.03 * currentAlpha).toFixed(3)})`);
          spotlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const ripple = ripplesRef.current[i];
        ripple.radius += ripple.speed;
        ripple.alpha *= 0.945; 

        if (ripple.alpha <= 0.01 || ripple.radius >= ripple.maxRadius) {
          ripplesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.lineWidth = ripple.lineWidth;

        if (isDark) {
          ctx.strokeStyle = `rgba(96, 165, 250, ${ripple.alpha.toFixed(3)})`;
        } else {
          ctx.strokeStyle = `rgba(37, 99, 235, ${(ripple.alpha * 0.8).toFixed(3)})`;
        }
        ctx.stroke();
      }

      if (currentAlpha > 0.005 && window.matchMedia('(pointer: fine)').matches) {
        const { mode, isClicking, targetX, targetY, ringX, ringY } = mouseRef.current;

        if (mode === 'text') {
          
          const beamHeight = 16;
          ctx.beginPath();
          
          ctx.moveTo(targetX, targetY - beamHeight / 2);
          ctx.lineTo(targetX, targetY + beamHeight / 2);
          
          ctx.moveTo(targetX - 3.5, targetY - beamHeight / 2);
          ctx.lineTo(targetX + 3.5, targetY - beamHeight / 2);
          
          ctx.moveTo(targetX - 3.5, targetY + beamHeight / 2);
          ctx.lineTo(targetX + 3.5, targetY + beamHeight / 2);

          ctx.strokeStyle = isDark
            ? `rgba(96, 165, 250, ${currentAlpha.toFixed(3)})`
            : `rgba(37, 99, 235, ${currentAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.75;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else if (mode === 'disabled') {
          
          ctx.beginPath();
          ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
          ctx.moveTo(targetX - 5.5, targetY + 5.5);
          ctx.lineTo(targetX + 5.5, targetY - 5.5);
          ctx.strokeStyle = isDark
            ? `rgba(248, 113, 113, ${(0.75 * currentAlpha).toFixed(3)})`
            : `rgba(239, 68, 68, ${(0.75 * currentAlpha).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          
          const isPointer = mode === 'pointer';
          const targetRingRadius = isClicking ? 10 : isPointer ? 22 : 13;

          ctx.beginPath();
          ctx.arc(ringX, ringY, targetRingRadius, 0, Math.PI * 2);
          if (isDark) {
            ctx.strokeStyle = isPointer
              ? `rgba(96, 165, 250, ${(0.75 * currentAlpha).toFixed(3)})`
              : `rgba(255, 255, 255, ${(0.45 * currentAlpha).toFixed(3)})`;
            ctx.fillStyle = isPointer
              ? `rgba(59, 130, 246, ${(0.14 * currentAlpha).toFixed(3)})`
              : 'transparent';
          } else {
            ctx.strokeStyle = isPointer
              ? `rgba(37, 99, 235, ${(0.85 * currentAlpha).toFixed(3)})`
              : `rgba(0, 0, 0, ${(0.38 * currentAlpha).toFixed(3)})`;
            ctx.fillStyle = isPointer
              ? `rgba(37, 99, 235, ${(0.10 * currentAlpha).toFixed(3)})`
              : 'transparent';
          }
          ctx.lineWidth = 1.35;
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(targetX, targetY, isPointer ? 2.8 : 2.2, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(96, 165, 250, ${currentAlpha.toFixed(3)})`
            : `rgba(37, 99, 235, ${currentAlpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startLoop();

    return () => {
      stopLoop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseenter', onMouseEnter);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDark, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

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
        zIndex: 99999, 
      }}
    />
  );
};
