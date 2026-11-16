import React, { useEffect, useRef } from 'react';

interface VictoryConfettiProps {
  colors?: string[];
  className?: string;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vRot: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  isSpark: boolean;
}

export const VictoryConfetti: React.FC<VictoryConfettiProps> = ({
  colors = ['#FBBF24', '#22D3EE', '#4ADE80', '#FFFFFF'],
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = Array.from(
      new Set(['#FBBF24', '#22D3EE', '#4ADE80', '#F8FAFC', ...colors.filter(Boolean)])
    );

    const pieces: ConfettiPiece[] = [];
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width || 480;
      h = rect.height || 480;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const spawnFirework = (cx: number, cy: number, count: number, power = 1) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (90 + Math.random() * 240) * power;
        const isSpark = i % 3 === 0;
        pieces.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 65 * power,
          w: isSpark ? 3.5 : 5 + Math.random() * 5,
          h: isSpark ? 3.5 : 3 + Math.random() * 3.5,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 12,
          color: palette[i % palette.length],
          alpha: 1,
          life: 0,
          maxLife: 1.4 + Math.random() * 1.1,
          isSpark,
        });
      }
    };

    // Initial grand burst + two staggered fireworks
    spawnFirework(w * 0.5, h * 0.44, 75, 1.1);
    const t1 = window.setTimeout(() => spawnFirework(w * 0.28, h * 0.32, 42, 0.9), 340);
    const t2 = window.setTimeout(() => spawnFirework(w * 0.72, h * 0.34, 42, 0.9), 720);
    const t3 = window.setTimeout(() => spawnFirework(w * 0.5, h * 0.24, 48, 0.95), 1150);

    let rafId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      ctx.clearRect(0, 0, w, h);

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          pieces.splice(i, 1);
          continue;
        }
        p.vy += 260 * dt; // Gravity
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vRot * dt;
        const t = p.life / p.maxLife;
        p.alpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.isSpark) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.65, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      if (pieces.length > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
};
