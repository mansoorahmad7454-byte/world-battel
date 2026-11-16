import React, { useEffect, useRef } from 'react';
import {
  ARENA_APOTHEM,
  ARENA_RADIUS,
  ARENA_SIDES,
  ArenaEvents,
  ArenaState,
  BAFFLE_COUNT,
  BAFFLE_LENGTH,
  BAFFLE_RADIUS,
  BAFFLE_TILT,
  CENTER_WHEEL_RADIUS,
  GATE_FACET_INDEX,
  stepArena,
} from '../engine/arenaPhysics';
import { getFlagBitmap } from '../utils/flagRenderer';

interface ArenaCanvasProps {
  arenaRef: React.MutableRefObject<ArenaState>;
  isPlaying: boolean;
  speedMultiplier: number;
  championCode: string | null;
  eventsRef: React.MutableRefObject<ArenaEvents>;
  onTickSync: () => void;
}

const LOGICAL_SIZE = 540;
const HALF = LOGICAL_SIZE / 2;

export const ArenaCanvas: React.FC<ArenaCanvasProps> = ({
  arenaRef,
  isPlaying,
  speedMultiplier,
  championCode,
  eventsRef,
  onTickSync,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speedMultiplier);
  const championRef = useRef(championCode);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    championRef.current = championCode;
  }, [championCode]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let uiSyncAccum = 0;

    const renderFrame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const state = arenaRef.current;

      if (isPlayingRef.current) {
        const simDt = rawDt * speedRef.current;
        const prevElimCount = state.eliminated.length;
        const prevPoppingCount = state.eliminatingFlags.length;
        const prevWinner = state.winner;
        stepArena(state, simDt, eventsRef.current);

        uiSyncAccum += rawDt;
        if (
          state.eliminated.length !== prevElimCount ||
          state.eliminatingFlags.length !== prevPoppingCount ||
          state.winner !== prevWinner ||
          uiSyncAccum > 0.25
        ) {
          uiSyncAccum = 0;
          onTickSync();
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetPx = Math.round(LOGICAL_SIZE * dpr);
        if (canvas.width !== targetPx || canvas.height !== targetPx) {
          canvas.width = targetPx;
          canvas.height = targetPx;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          drawArena(ctx, state, championRef.current);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [arenaRef, eventsRef, onTickSync]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full max-w-[540px] max-h-[540px] aspect-square block mx-auto select-none"
      aria-label="Flags War Arena simulation canvas"
    />
  );
};

function drawArena(
  ctx: CanvasRenderingContext2D,
  state: ArenaState,
  championCode: string | null
) {
  ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  ctx.save();
  ctx.translate(HALF, HALF);

  const sectorStep = (Math.PI * 2) / ARENA_SIDES;

  // Clip & fill original 12-sided Vortexia Reactor floor
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < ARENA_SIDES; i++) {
    const va = state.ringAngle + i * sectorStep;
    const vx = Math.cos(va) * ARENA_RADIUS;
    const vy = Math.sin(va) * ARENA_RADIUS;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();

  const bgGrad = ctx.createRadialGradient(0, 0, CENTER_WHEEL_RADIUS, 0, 0, ARENA_RADIUS);
  bgGrad.addColorStop(0, '#0F173A');
  bgGrad.addColorStop(0.55, '#080D24');
  bgGrad.addColorStop(1, '#040715');
  ctx.fillStyle = bgGrad;
  ctx.fill();
  ctx.clip();

  // Subtle geometric reactor floor rings & spoke guidelines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1.2;
  [ARENA_APOTHEM * 0.45, ARENA_APOTHEM * 0.76].forEach((rr) => {
    ctx.beginPath();
    for (let i = 0; i < ARENA_SIDES; i++) {
      const va = state.ringAngle + i * sectorStep;
      const vx = Math.cos(va) * rr;
      const vy = Math.sin(va) * rr;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.stroke();
  });
  for (let i = 0; i < ARENA_SIDES; i += 2) {
    const va = state.ringAngle + i * sectorStep;
    ctx.beginPath();
    ctx.moveTo(Math.cos(va) * CENTER_WHEEL_RADIUS, Math.sin(va) * CENTER_WHEEL_RADIUS);
    ctx.lineTo(Math.cos(va) * ARENA_RADIUS, Math.sin(va) * ARENA_RADIUS);
    ctx.stroke();
  }
  ctx.restore();

  // Draw 6 canted armored Vortexia turbine deflector blades
  for (let b = 0; b < BAFFLE_COUNT; b++) {
    const bAngle = state.ringAngle + (b * 2 * Math.PI * 2) / ARENA_SIDES;
    const tipAngle = bAngle + BAFFLE_TILT;
    const x1 = Math.cos(bAngle) * (ARENA_RADIUS - 2);
    const y1 = Math.sin(bAngle) * (ARENA_RADIUS - 2);
    const x2 = x1 - Math.cos(tipAngle) * BAFFLE_LENGTH;
    const y2 = y1 - Math.sin(tipAngle) * BAFFLE_LENGTH;

    const nx = -Math.sin(tipAngle);
    const ny = Math.cos(tipAngle);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1 + nx * (BAFFLE_RADIUS + 2), y1 + ny * (BAFFLE_RADIUS + 2));
    ctx.lineTo(x2 + nx * 2.5, y2 + ny * 2.5);
    ctx.lineTo(x2 - nx * 2.5, y2 - ny * 2.5);
    ctx.lineTo(x1 - nx * (BAFFLE_RADIUS + 2), y1 - ny * (BAFFLE_RADIUS + 2));
    ctx.closePath();

    const bladeGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    bladeGrad.addColorStop(0, '#0F766E');
    bladeGrad.addColorStop(0.6, '#14B8A6');
    bladeGrad.addColorStop(1, '#FBBF24');
    ctx.fillStyle = bladeGrad;
    ctx.fill();

    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  // Draw Outer 12-Sided Armored Reactor Perimeter Wall (with open Plasma Gate facet in gate mode)
  ctx.save();
  for (let i = 0; i < ARENA_SIDES; i++) {
    const a1 = state.ringAngle + i * sectorStep;
    const a2 = state.ringAngle + (i + 1) * sectorStep;
    const x1 = Math.cos(a1) * ARENA_RADIUS;
    const y1 = Math.sin(a1) * ARENA_RADIUS;
    const x2 = Math.cos(a2) * ARENA_RADIUS;
    const y2 = Math.sin(a2) * ARENA_RADIUS;

    const isOpenGate = state.mode === 'gate' && i === GATE_FACET_INDEX;
    if (isOpenGate) {
      // Glowing Escape Breach Portal markers
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();

      [
        [x1, y1],
        [x2, y2],
      ].forEach(([gx, gy]) => {
        ctx.beginPath();
        ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
      });
    } else {
      // Faceted Armor Rail + Emerald/Amber Neon Trim
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = i % 2 === 0 ? '#14B8A6' : '#F59E0B';
      ctx.shadowColor = i % 2 === 0 ? '#2DD4BF' : '#FBBF24';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // 12 Corner Armor Pylons
  for (let i = 0; i < ARENA_SIDES; i++) {
    const a = state.ringAngle + i * sectorStep;
    const px = Math.cos(a) * ARENA_RADIUS;
    const py = Math.sin(a) * ARENA_RADIUS;
    ctx.beginPath();
    ctx.arc(px, py, i % 2 === 0 ? 4.8 : 3.4, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#FDE047' : '#2DD4BF';
    ctx.fill();
  }
  ctx.restore();

  // Draw Original Vortexia Reactor Turbine Core
  drawCenterWheel(ctx, state);

  // Draw Shield Orb Pickup if active
  if (state.shieldOrb) {
    const orb = state.shieldOrb;
    const pulseR = orb.r + Math.sin(orb.pulse) * 2.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, pulseR + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(orb.x, orb.y, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#4ADE80';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = 10;
    ctx.stroke();

    // Inner shield cross/plus spark
    ctx.fillStyle = '#BBF7D0';
    ctx.fillRect(orb.x - 1.5, orb.y - 5, 3, 10);
    ctx.fillRect(orb.x - 5, orb.y - 1.5, 10, 3);
    ctx.restore();
  }

  // Draw Shockwaves
  for (const s of state.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.alpha);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Draw Active Flags
  for (const f of state.flags) {
    if (f.eliminated) continue;
    const isChampion = championCode === f.id;

    // Glowing Green Shield Aura (matches screenshot's double-ring green halo)
    if (f.hasShield) {
      const pulse = 1 + Math.sin(f.shieldPulse) * 0.05;
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x, f.y, (f.r + 5) * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#22C55E';
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    // Selected Champion subtle amber target ring
    if (isChampion) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw cached circular vector flag bitmap
    const bmp = getFlagBitmap(f.country.code);
    ctx.drawImage(bmp, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  }

  // Draw Eliminating Flags ('pop' scale + fade-out before moving to eliminated tray)
  for (const anim of state.eliminatingFlags) {
    const t = Math.min(1, anim.life / anim.maxLife);
    const scale =
      t < 0.35
        ? 1 + (t / 0.35) * 0.36
        : 1.36 - ((t - 0.35) / 0.65) * 0.78;
    const alpha = t < 0.18 ? 1 : Math.max(0, 1 - (t - 0.18) / 0.82);

    ctx.save();
    ctx.globalAlpha = alpha;
    const drawR = anim.r * scale;

    // Subtle pop ring
    ctx.beginPath();
    ctx.arc(anim.x, anim.y, drawR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    const bmp = getFlagBitmap(anim.country.code);
    ctx.drawImage(bmp, anim.x - drawR, anim.y - drawR, drawR * 2, drawR * 2);
    ctx.restore();
  }

  // Draw Particles
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Floating Elimination Callouts
  for (const c of state.callouts) {
    const alpha = Math.max(0, 1 - c.life / c.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = c.color;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(c.text, c.x, c.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawCenterWheel(ctx: CanvasRenderingContext2D, state: ArenaState) {
  const r = CENTER_WHEEL_RADIUS;
  const isVortex = state.mode === 'vortex';
  ctx.save();

  // Outer Plasma Core Halo Ring
  ctx.beginPath();
  ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = isVortex ? '#F43F5E' : '#14B8A6';
  ctx.lineWidth = 3.2;
  ctx.shadowColor = isVortex ? '#FB7185' : '#2DD4BF';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Rotating 8-Blade Vortexia Reactor Turbine
  ctx.save();
  ctx.rotate(state.centerAngle);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    const px = Math.cos(a) * (r - 1);
    const py = Math.sin(a) * (r - 1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#090F26';
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Swept metallic reactor blades
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a + 0.34) * (r - 4), Math.sin(a + 0.34) * (r - 4));
    ctx.strokeStyle = i % 2 === 0 ? '#FBBF24' : isVortex ? '#FB7185' : '#2DD4BF';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Center Hub Jewel
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fillStyle = isVortex ? '#881337' : '#0F766E';
  ctx.fill();
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}
