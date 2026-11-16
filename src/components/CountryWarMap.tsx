import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Crosshair,
  Flame,
  Menu,
  ShieldAlert,
  Swords,
  Trophy,
} from 'lucide-react';
import { COUNTRIES, CountryDef } from '../data/countries';
import {
  CommentaryLanguage,
  getCountrySpokenName,
  resolveSpokenLanguage,
} from '../data/raceCommentary';
import { getFlagBitmap } from '../utils/flagRenderer';
import { soundEngine } from '../utils/sound';
import { FlagBadge } from './FlagBadge';
import { HeaderStatBox } from './HeaderStatBox';
import { VictoryConfetti } from './VictoryConfetti';

interface Province {
  id: number;
  name: string;
  x: number;
  y: number;
  polygon: Array<[number, number]>;
  neighbors: number[];
  owner: 'A' | 'B';
  isCapital: boolean;
  isCoastal: boolean;
  garrison: number;
  maxGarrison: number;
  captureFlash: number;
}

interface MilitaryUnit {
  id: number;
  side: 'A' | 'B';
  type: 'tank' | 'infantry' | 'ship';
  x: number;
  y: number;
  targetProvinceId: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
}

interface ExplosionFx {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

interface FloatingExp {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface WarSimState {
  provinces: Province[];
  units: MilitaryUnit[];
  explosions: ExplosionFx[];
  floatTexts: FloatingExp[];
  treasuryA: number;
  treasuryB: number;
  manpowerA: number;
  manpowerB: number;
  factoriesA: number;
  factoriesB: number;
  dayCount: number;
  dayAccum: number;
  aiTimerA: number;
  aiTimerB: number;
  nextUnitId: number;
  winner: 'A' | 'B' | null;
  bannerText: string;
  killsA: number;
  killsB: number;
}

export interface WarConfig {
  countryACode: string;
  countryBCode: string;
  autoGeneral: boolean;
}

interface CountryWarMapProps {
  config: WarConfig;
  isPlaying: boolean;
  speedMultiplier: number;
  restartSignal: number;
  commLang: CommentaryLanguage;
  isPortrait916?: boolean;
  onUpdateConfig: (patch: Partial<WarConfig>) => void;
  onOpenMenu: () => void;
  onBackToArena: () => void;
  onRecordWin?: (country: CountryDef) => void;
}

const MAP_W = 920;
const MAP_H = 540;

const CITY_NAMES_A = [
  'Capital',
  'Portsmouth',
  'Northgate',
  'Ironridge',
  'Westford',
  'Redcliff',
  'Oakbridge',
  'Sunhaven',
  'Silverport',
  'Vanguard',
  'Stonewall',
  'Harborview',
];

const CITY_NAMES_B = [
  'Citadel',
  'Eastwatch',
  'Highland',
  'Crownpoint',
  'Bayshore',
  'Frostburg',
  'Goldvale',
  'Belfield',
  'Cresthaven',
  'Driftwood',
  'Fortress',
  'Seaview',
];

function getSideColor(country: CountryDef, avoidHex?: string): string {
  const candidates = country.colors.filter(Boolean) as string[];
  const cleanAvoid = avoidHex?.toLowerCase();
  for (const c of candidates) {
    const low = c.toLowerCase();
    if (low === '#ffffff' || low === '#f4f5f8' || low === '#111111' || low === '#141414') continue;
    if (cleanAvoid && low === cleanAvoid) continue;
    return c;
  }
  return avoidHex === '#D9383A' ? '#2B8A57' : '#D9383A';
}

function createWarMapState(countryA: CountryDef, countryB: CountryDef): WarSimState {
  // Build 24 tactical provinces (12 West/Left Island-Continent for A, 12 East/Right Continent for B)
  // arranged on jittered grid cells with organic polygonal boundaries
  const cols = 6;
  const rows = 4;
  const padX = 74;
  const padY = 64;
  const cellW = (MAP_W - padX * 2) / cols;
  const cellH = (MAP_H - padY * 2) / rows;

  const centers: Array<{ x: number; y: number; col: number; row: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Create a central sea channel gap between col 2 and col 3
      const seaGap = c >= 3 ? 28 : -28;
      const jx = (Math.sin(r * 7.3 + c * 3.1) * 0.22) * cellW;
      const jy = (Math.cos(r * 4.7 + c * 9.2) * 0.22) * cellH;
      centers.push({
        x: padX + (c + 0.5) * cellW + seaGap + jx,
        y: padY + (r + 0.5) * cellH + jy,
        col: c,
        row: r,
      });
    }
  }

  const provinces: Province[] = centers.map((pt, idx) => {
    const owner: 'A' | 'B' = pt.col < 3 ? 'A' : 'B';
    const isCapital = (pt.col === 0 && pt.row === 1) || (pt.col === 5 && pt.row === 2);
    const isCoastal = pt.col === 2 || pt.col === 3;

    // Build organic 7-sided polygon around province center
    const sides = 7;
    const poly: Array<[number, number]> = [];
    const rx = cellW * 0.53;
    const ry = cellH * 0.53;
    for (let s = 0; s < sides; s++) {
      const a = (s * Math.PI * 2) / sides + 0.2;
      const wobble = 0.88 + 0.2 * Math.abs(Math.sin(idx * 2.1 + s * 1.7));
      poly.push([pt.x + Math.cos(a) * rx * wobble, pt.y + Math.sin(a) * ry * wobble]);
    }

    // Neighbors on grid + sea crossings between col 2 and col 3
    const neighbors: number[] = [];
    for (let j = 0; j < centers.length; j++) {
      if (j === idx) continue;
      const other = centers[j];
      const dc = Math.abs(other.col - pt.col);
      const dr = Math.abs(other.row - pt.row);
      if (dc <= 1 && dr <= 1) {
        neighbors.push(j);
      }
    }

    const nameList = owner === 'A' ? CITY_NAMES_A : CITY_NAMES_B;
    const localIndex = owner === 'A' ? pt.row * 3 + pt.col : pt.row * 3 + (pt.col - 3);
    const name = isCapital
      ? `${owner === 'A' ? countryA.name : countryB.name} HQ`
      : nameList[localIndex % nameList.length];

    return {
      id: idx,
      name,
      x: pt.x,
      y: pt.y,
      polygon: poly,
      neighbors,
      owner,
      isCapital,
      isCoastal,
      garrison: isCapital ? 100 : 55,
      maxGarrison: isCapital ? 100 : 65,
      captureFlash: 0,
    };
  });

  // Spawn initial frontline troops
  const units: MilitaryUnit[] = [];
  let nextUnitId = 1;

  provinces.forEach((p) => {
    if (p.isCapital || p.isCoastal) {
      const enemyProvs = provinces.filter((ep) => ep.owner !== p.owner);
      const target = enemyProvs[Math.floor(Math.random() * enemyProvs.length)];
      units.push({
        id: nextUnitId++,
        side: p.owner,
        type: p.isCapital ? 'tank' : 'infantry',
        x: p.x,
        y: p.y,
        targetProvinceId: target.id,
        hp: p.isCapital ? 110 : 75,
        maxHp: p.isCapital ? 110 : 75,
        speed: p.isCapital ? 42 : 34,
        angle: Math.atan2(target.y - p.y, target.x - p.x),
      });
    }
  });

  return {
    provinces,
    units,
    explosions: [],
    floatTexts: [],
    treasuryA: 29500,
    treasuryB: 29500,
    manpowerA: 12000,
    manpowerB: 12000,
    factoriesA: 58,
    factoriesB: 58,
    dayCount: 1,
    dayAccum: 0,
    aiTimerA: 1.5,
    aiTimerB: 1.8,
    nextUnitId,
    winner: null,
    bannerText: `${countryA.name} declared War on ${countryB.name}`,
    killsA: 0,
    killsB: 0,
  };
}

export const CountryWarMap: React.FC<CountryWarMapProps> = ({
  config,
  isPlaying,
  speedMultiplier,
  restartSignal,
  commLang,
  isPortrait916 = false,
  onUpdateConfig,
  onOpenMenu,
  onBackToArena,
  onRecordWin,
}) => {
  const { countryACode, countryBCode, autoGeneral } = config;
  const [selectedProvId, setSelectedProvId] = useState<number | null>(null);
  const [, setHudTick] = useState<number>(0);

  const countryA = useMemo(
    () => COUNTRIES.find((c) => c.code === countryACode) ?? COUNTRIES[0],
    [countryACode]
  );
  const countryB = useMemo(
    () => COUNTRIES.find((c) => c.code === countryBCode) ?? COUNTRIES[1],
    [countryBCode]
  );

  const colorA = useMemo(() => getSideColor(countryA), [countryA]);
  const colorB = useMemo(() => getSideColor(countryB, colorA), [countryB, colorA]);

  const simRef = useRef<WarSimState>(createWarMapState(countryA, countryB));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speedMultiplier);
  const autoGenRef = useRef(autoGeneral);
  const isPortrait916Ref = useRef(isPortrait916);

  useEffect(() => {
    isPortrait916Ref.current = isPortrait916;
  }, [isPortrait916]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    autoGenRef.current = autoGeneral;
  }, [autoGeneral]);

  const startNewWar = useCallback(
    (cA: CountryDef, cB: CountryDef, announce = true) => {
      simRef.current = createWarMapState(cA, cB);
      setSelectedProvId(null);
      setHudTick((t) => t + 1);
      if (announce) {
        const lang = resolveSpokenLanguage(soundEngine.commentaryLang, [cA.code, cB.code]);
        const nameA = getCountrySpokenName(cA, lang);
        const nameB = getCountrySpokenName(cB, lang);
        const customStart = soundEngine.customCommentary.customIntroLine.trim();
        const text = customStart
          ? customStart
              .replace(/\{leader\}|\{country\}|\{winner\}/gi, nameA)
              .replace(/\{rival\}/gi, nameB)
          : `${nameA} vs ${nameB}!`;
        soundEngine.speakText(text, true, lang, 'countdown');
      }
    },
    []
  );

  useEffect(() => {
    startNewWar(countryA, countryB, false);
  }, [countryA, countryB, startNewWar, restartSignal]);

  const spawnUnit = useCallback(
    (side: 'A' | 'B', type: 'tank' | 'infantry' | 'ship', targetId?: number) => {
      const s = simRef.current;
      if (s.winner) return;
      const owned = s.provinces.filter((p) => p.owner === side);
      const enemies = s.provinces.filter((p) => p.owner !== side);
      if (owned.length === 0 || enemies.length === 0) return;

      const origin =
        owned.find((p) => p.isCapital) ??
        owned[Math.floor(Math.random() * owned.length)];
      const target =
        (targetId !== undefined ? s.provinces.find((p) => p.id === targetId) : undefined) ??
        enemies.sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
            Math.hypot(b.x - origin.x, b.y - origin.y)
        )[0];

      if (!target) return;

      s.units.push({
        id: s.nextUnitId++,
        side,
        type,
        x: origin.x + (Math.random() - 0.5) * 14,
        y: origin.y + (Math.random() - 0.5) * 14,
        targetProvinceId: target.id,
        hp: type === 'tank' ? 120 : type === 'ship' ? 140 : 75,
        maxHp: type === 'tank' ? 120 : type === 'ship' ? 140 : 75,
        speed: type === 'tank' ? 46 : type === 'ship' ? 52 : 36,
        angle: Math.atan2(target.y - origin.y, target.x - origin.x),
      });
    },
    []
  );

  const handlePlayerCommand = (action: 'tank' | 'wave' | 'naval' | 'air') => {
    const s = simRef.current;
    if (s.winner) return;
    soundEngine.unlockSpeech();

    if (action === 'tank') {
      if (s.treasuryA < 2500) return;
      s.treasuryA -= 2500;
      s.manpowerA = Math.max(0, s.manpowerA - 400);
      spawnUnit('A', 'tank');
      soundEngine.playShieldPickup();
    } else if (action === 'naval') {
      if (s.treasuryA < 3500) return;
      s.treasuryA -= 3500;
      spawnUnit('A', 'ship');
      s.bannerText = `${countryA.name} Naval Fleet entering the strait!`;
      soundEngine.playShieldPickup();
    } else if (action === 'wave') {
      if (s.treasuryA < 3000) return;
      s.treasuryA -= 3000;
      s.manpowerA = Math.max(0, s.manpowerA - 900);
      spawnUnit('A', 'infantry');
      spawnUnit('A', 'infantry');
      spawnUnit('A', 'tank');
      s.bannerText = `${countryA.name} launched an all-out offensive!`;
      soundEngine.playShieldPickup();
    } else if (action === 'air') {
      if (s.treasuryA < 4000) return;
      s.treasuryA -= 4000;
      const enemyUnits = s.units.filter((u) => u.side === 'B');
      enemyUnits.slice(0, 4).forEach((eu) => {
        eu.hp -= 55;
        s.explosions.push({
          x: eu.x,
          y: eu.y,
          r: 6,
          maxR: 36,
          alpha: 1,
          color: '#FBBF24',
        });
      });
      s.bannerText = `${countryA.name} Air Strike hit enemy forces!`;
      soundEngine.playEliminate();
    }
    setHudTick((t) => t + 1);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    soundEngine.unlockSpeech();
    const rect = canvas.getBoundingClientRect();
    const activeMapH = isPortrait916 ? 860 : MAP_H;
    const yOffset = (activeMapH - MAP_H) * 0.5;
    const x = ((e.clientX - rect.left) / rect.width) * MAP_W;
    const y = ((e.clientY - rect.top) / rect.height) * activeMapH - yOffset;

    const s = simRef.current;
    if (s.winner) return;

    // Find closest province
    let closest: Province | null = null;
    let bestD = 54;
    for (const p of s.provinces) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        closest = p;
      }
    }
    if (!closest) {
      setSelectedProvId(null);
      return;
    }

    if (closest.owner === 'A') {
      setSelectedProvId(closest.id);
    } else if (closest.owner === 'B') {
      // Launch immediate strike on clicked enemy province!
      if (s.treasuryA >= 1200) {
        s.treasuryA -= 1200;
        spawnUnit('A', 'tank', closest.id);
        s.bannerText = `${countryA.name} advancing on ${closest.name}`;
      } else {
        // Redirect existing closest A unit
        const unitsA = s.units.filter((u) => u.side === 'A');
        if (unitsA.length > 0) {
          unitsA[0].targetProvinceId = closest.id;
        }
      }
      setSelectedProvId(null);
    }
    setHudTick((t) => t + 1);
  };

  const onRecordWinRef = useRef(onRecordWin);
  useEffect(() => {
    onRecordWinRef.current = onRecordWin;
  }, [onRecordWin]);

  // Main War Map Animation Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let syncAcc = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = simRef.current;
      if (isPlayingRef.current && !s.winner) {
        const dt = rawDt * speedRef.current;
        stepWarSim(s, dt, countryA, countryB, colorA, colorB, autoGenRef.current, spawnUnit);
        if (s.winner) {
          onRecordWinRef.current?.(s.winner === 'A' ? countryA : countryB);
        }
        syncAcc += rawDt;
        if (syncAcc > 0.2) {
          syncAcc = 0;
          setHudTick((t) => t + 1);
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const activeMapH = isPortrait916Ref.current ? 860 : MAP_H;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tw = Math.round(MAP_W * dpr);
        const th = Math.round(activeMapH * dpr);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          drawWarMap(ctx, s, countryA, countryB, colorA, colorB, selectedProvId, activeMapH);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [countryA, countryB, colorA, colorB, selectedProvId, spawnUnit]);

  const s = simRef.current;
  const provCountA = s.provinces.filter((p) => p.owner === 'A').length;
  const provCountB = s.provinces.filter((p) => p.owner === 'B').length;
  const campaignDate = useMemo(() => {
    const base = new Date(2026, 7, 1);
    base.setDate(base.getDate() + s.dayCount - 1);
    return base.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [s.dayCount]);

  return (
    <div className="vortexia-shell bg-[#060918] text-slate-100">
      {/* Pro Header: Brand + Colorful Total/Left Countries Box + 3-Lines Menu */}
      <header className="border-b border-slate-800 bg-[#0A1024] px-3 py-1.5 sm:px-6 sm:py-2.5 shrink-0">
        <div className="mx-auto max-w-[1360px] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] sm:text-lg lg:text-xl font-black uppercase tracking-tight leading-none truncate">
              <span className="text-white">VORTEXIA GLOBAL </span>
              <span className="text-amber-400">BATTLE</span>
            </h1>
            <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-[#8C96C8] uppercase tracking-wide tabular-nums truncate">
              War Map · {countryA.code} vs {countryB.code} · Day {s.dayCount} · {(s.treasuryA / 1000).toFixed(1)}k Gold
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <HeaderStatBox
              totalCount={2}
              totalLabel="Countries"
              leftCount={s.winner ? 1 : 2}
              leftLabel="Left"
              extraText={`${provCountA} vs ${provCountB} Cities · ${campaignDate}`}
            />
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-[#0F1633] text-amber-300 hover:border-amber-400 hover:text-white shrink-0"
              aria-label="Open controls menu"
              title="All War Options, Countries, Speed, Music & Game Modes"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Territory Balance Bar + Full-Width Map Viewport */}
      <div className="mx-auto w-full max-w-[1360px] px-2.5 py-2 sm:px-5 sm:pt-3 sm:pb-4 flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
        {/* Territory Dominance Meter */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 max-w-[34%] sm:min-w-[130px]">
            <FlagBadge code={countryA.code} name={countryA.name} size={20} />
            <span className="text-[11px] sm:text-xs font-bold text-white truncate">
              {countryA.name}
            </span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-amber-300 tabular-nums shrink-0">
              {provCountA}
            </span>
          </div>

          <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden flex min-w-[60px]">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(provCountA / s.provinces.length) * 100}%`,
                backgroundColor: colorA,
              }}
            />
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(provCountB / s.provinces.length) * 100}%`,
                backgroundColor: colorB,
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-1.5 min-w-0 max-w-[34%] sm:min-w-[130px]">
            <span className="font-mono text-[11px] sm:text-xs font-bold text-amber-300 tabular-nums shrink-0">
              {provCountB}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-white truncate">
              {countryB.name}
            </span>
            <FlagBadge code={countryB.code} name={countryB.name} size={20} />
          </div>
        </div>

        {/* Diplomatic Event Banner on 9:16 Portrait */}
        <div className="vortexia-portrait-only items-center justify-center rounded-lg border border-slate-700/70 bg-[#091229] px-3 py-1 shrink-0">
          <p className="text-[11px] font-bold tracking-wide text-amber-200 truncate">{s.bannerText}</p>
        </div>

        {/* Full-Width Tactical War Map Canvas + Adaptive Desktop/Portrait Action Rail */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="vortexia-warmap-canvas-box">
            <div
              className="vortexia-warmap-frame relative rounded-xl border border-slate-700/80 bg-[#134B91] overflow-hidden shadow-2xl"
              style={{ aspectRatio: isPortrait916 ? `${MAP_W} / 860` : '16 / 9' }}
            >
              {/* Diplomatic Event Banner on Desktop */}
              <div className="vortexia-desktop-only pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 w-[92%] max-w-xl justify-center">
                <div className="rounded-lg border border-slate-400/35 bg-[#081226]/80 px-4 py-1.5 text-center backdrop-blur-sm shadow-lg">
                  <p className="text-xs sm:text-sm font-bold tracking-wide text-white truncate">
                    {s.bannerText}
                  </p>
                </div>
              </div>

              {/* Left Tactical Action Rail (Desktop Only Inside Map) */}
              <div className="vortexia-desktop-only absolute left-3 top-1/2 z-10 -translate-y-1/2 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handlePlayerCommand('tank')}
                  disabled={s.treasuryA < 2500 || Boolean(s.winner)}
                  title="Deploy Heavy Tank (2.5k Gold)"
                  className="flex items-center gap-2 rounded-lg border border-slate-500/60 bg-[#0A1329]/90 px-3 py-2 text-xs font-bold text-white hover:border-amber-400 disabled:opacity-45 whitespace-nowrap"
                >
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Tank · 2.5k</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayerCommand('wave')}
                  disabled={s.treasuryA < 3000 || Boolean(s.winner)}
                  title="Launch Infantry & Armor Wave (3k Gold)"
                  className="flex items-center gap-2 rounded-lg border border-slate-500/60 bg-[#0A1329]/90 px-3 py-2 text-xs font-bold text-white hover:border-emerald-400 disabled:opacity-45 whitespace-nowrap"
                >
                  <Swords className="h-4 w-4 text-emerald-400" />
                  <span>Attack Wave · 3k</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayerCommand('naval')}
                  disabled={s.treasuryA < 3500 || Boolean(s.winner)}
                  title="Deploy Naval Destroyer (3.5k Gold)"
                  className="flex items-center gap-2 rounded-lg border border-slate-500/60 bg-[#0A1329]/90 px-3 py-2 text-xs font-bold text-white hover:border-cyan-400 disabled:opacity-45 whitespace-nowrap"
                >
                  <Anchor className="h-4 w-4 text-cyan-400" />
                  <span>Fleet · 3.5k</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayerCommand('air')}
                  disabled={s.treasuryA < 4000 || Boolean(s.winner)}
                  title="Air Strike on Enemy Units (4k Gold)"
                  className="flex items-center gap-2 rounded-lg border border-slate-500/60 bg-[#0A1329]/90 px-3 py-2 text-xs font-bold text-white hover:border-rose-400 disabled:opacity-45 whitespace-nowrap"
                >
                  <Flame className="h-4 w-4 text-rose-400" />
                  <span>Air Strike · 4k</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ autoGeneral: !autoGeneral })}
                  title="Toggle AI Commander for your country"
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap ${
                    autoGeneral
                      ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-500/60 bg-[#0A1329]/90 text-slate-300'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>{autoGeneral ? 'Auto-General: On' : 'Manual Control'}</span>
                </button>
              </div>

              {/* Interactive Hint Footer (Desktop) */}
              <div className="vortexia-desktop-only pointer-events-none absolute bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-md bg-[#081226]/75 px-3 py-1 text-[11px] font-medium text-slate-200 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-amber-400" />
                  <span>Click any enemy city to order an attack · Units fight automatically</span>
                </span>
              </div>

              {/* Interactive Tactical War Map Canvas */}
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="w-full h-full object-contain block cursor-crosshair select-none"
              />

              {/* Victory Modal */}
              {s.winner && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060918]/78 p-2.5 sm:p-4 backdrop-blur-[2px] overflow-hidden">
                  <VictoryConfetti
                    colors={(s.winner === 'A' ? countryA : countryB).colors.filter(Boolean) as string[]}
                    className="z-20"
                  />
                  <div className="relative z-10 w-full max-w-sm max-h-[95%] overflow-y-auto rounded-xl border border-amber-400/50 bg-[#0A1027]/95 p-3.5 sm:p-6 text-center shadow-2xl">
                    <div className="mx-auto mb-1.5 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400">
                      Total Victory
                    </p>
                    <div className="my-2 sm:my-3 flex justify-center">
                      <FlagBadge
                        code={s.winner === 'A' ? countryA.code : countryB.code}
                        name={s.winner === 'A' ? countryA.name : countryB.name}
                        size={54}
                        className="ring-3 ring-amber-400/70"
                      />
                    </div>
                    <h3 className="text-lg sm:text-2xl font-extrabold text-white">
                      {s.winner === 'A' ? countryA.name : countryB.name} Wins!
                    </h3>
                    <p className="mt-1 text-[11px] sm:text-xs text-slate-300 tabular-nums">
                      Campaign lasted {s.dayCount} days · {s.winner === 'A' ? s.killsA : s.killsB} enemy units defeated
                    </p>
                    <div className="mt-3 sm:mt-5 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => startNewWar(countryA, countryB, true)}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                      >
                        Fight Again
                      </button>
                      <button
                        type="button"
                        onClick={onBackToArena}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:border-slate-400 whitespace-nowrap"
                      >
                        Spinning Arena
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 9:16 Portrait Command Bar + War Telemetry Panel (Always 100% Visible Inside Screen) */}
          <div className="vortexia-portrait-only flex-1 min-h-0 flex-col gap-2 overflow-hidden">
            <div className="grid grid-cols-5 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handlePlayerCommand('tank')}
                disabled={s.treasuryA < 2500 || Boolean(s.winner)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700 bg-[#0A1329] py-2 px-1 text-[10px] font-bold text-white hover:border-amber-400 disabled:opacity-45"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span>Tank</span>
                <span className="text-[9px] text-slate-400">2.5k</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayerCommand('wave')}
                disabled={s.treasuryA < 3000 || Boolean(s.winner)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700 bg-[#0A1329] py-2 px-1 text-[10px] font-bold text-white hover:border-emerald-400 disabled:opacity-45"
              >
                <Swords className="h-3.5 w-3.5 text-emerald-400" />
                <span>Wave</span>
                <span className="text-[9px] text-slate-400">3k</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayerCommand('naval')}
                disabled={s.treasuryA < 3500 || Boolean(s.winner)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700 bg-[#0A1329] py-2 px-1 text-[10px] font-bold text-white hover:border-cyan-400 disabled:opacity-45"
              >
                <Anchor className="h-3.5 w-3.5 text-cyan-400" />
                <span>Fleet</span>
                <span className="text-[9px] text-slate-400">3.5k</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayerCommand('air')}
                disabled={s.treasuryA < 4000 || Boolean(s.winner)}
                className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-700 bg-[#0A1329] py-2 px-1 text-[10px] font-bold text-white hover:border-rose-400 disabled:opacity-45"
              >
                <Flame className="h-3.5 w-3.5 text-rose-400" />
                <span>Air</span>
                <span className="text-[9px] text-slate-400">4k</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ autoGeneral: !autoGeneral })}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border py-2 px-1 text-[10px] font-bold ${
                  autoGeneral
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-[#0A1329] text-slate-300'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Auto</span>
                <span className="text-[9px]">{autoGeneral ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[#1B2344] bg-[#090E23] p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <FlagBadge code={countryA.code} name={countryA.name} size={20} />
                  <span className="text-xs font-extrabold text-white truncate">{countryA.name}</span>
                </div>
                <div className="space-y-1 text-[11px] font-mono tabular-nums">
                  <div className="flex justify-between text-slate-300">
                    <span>Cities</span>
                    <span className="font-bold text-amber-300">{provCountA}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Gold</span>
                    <span className="font-bold text-emerald-300">{(s.treasuryA / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Troops</span>
                    <span className="font-bold text-cyan-300">{(s.manpowerA / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#1B2344] bg-[#090E23] p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1.5">
                  <FlagBadge code={countryB.code} name={countryB.name} size={20} />
                  <span className="text-xs font-extrabold text-white truncate">{countryB.name}</span>
                </div>
                <div className="space-y-1 text-[11px] font-mono tabular-nums">
                  <div className="flex justify-between text-slate-300">
                    <span>Cities</span>
                    <span className="font-bold text-amber-300">{provCountB}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Gold</span>
                    <span className="font-bold text-rose-300">{(s.treasuryB / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Units Hit</span>
                    <span className="font-bold text-slate-200">{s.killsB}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] font-medium text-slate-400 shrink-0">
              Tap any enemy city on map to launch attack · {campaignDate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function stepWarSim(
  s: WarSimState,
  dt: number,
  countryA: CountryDef,
  countryB: CountryDef,
  _colorA: string,
  _colorB: string,
  autoGeneral: boolean,
  spawnUnit: (side: 'A' | 'B', type: 'tank' | 'infantry' | 'ship', targetId?: number) => void
) {
  // Advance campaign day & income
  s.dayAccum += dt;
  if (s.dayAccum >= 1.1) {
    s.dayAccum -= 1.1;
    s.dayCount += 1;
    const provsA = s.provinces.filter((p) => p.owner === 'A').length;
    const provsB = s.provinces.filter((p) => p.owner === 'B').length;
    s.factoriesA = 20 + provsA * 3;
    s.factoriesB = 20 + provsB * 3;
    s.treasuryA += provsA * 180;
    s.treasuryB += provsB * 180;
    s.manpowerA = Math.min(25000, s.manpowerA + provsA * 45);
    s.manpowerB = Math.min(25000, s.manpowerB + provsB * 45);
  }

  // AI Commanders spawn waves
  if (autoGeneral) {
    s.aiTimerA -= dt;
    if (s.aiTimerA <= 0) {
      s.aiTimerA = 2.0 + Math.random() * 1.4;
      const unitsA = s.units.filter((u) => u.side === 'A').length;
      if (unitsA < 14 && s.treasuryA >= 1500) {
        s.treasuryA -= 1500;
        const r = Math.random();
        spawnUnit('A', r < 0.4 ? 'tank' : r < 0.7 ? 'infantry' : 'ship');
      }
    }
  }

  s.aiTimerB -= dt;
  if (s.aiTimerB <= 0) {
    s.aiTimerB = 2.1 + Math.random() * 1.5;
    const unitsB = s.units.filter((u) => u.side === 'B').length;
    if (unitsB < 14 && s.treasuryB >= 1500) {
      s.treasuryB -= 1500;
      const r = Math.random();
      spawnUnit('B', r < 0.4 ? 'tank' : r < 0.7 ? 'infantry' : 'ship');
    }
  }

  // Regenerate province garrisons slowly
  for (const p of s.provinces) {
    if (p.captureFlash > 0) p.captureFlash = Math.max(0, p.captureFlash - dt * 2);
    if (p.garrison < p.maxGarrison) {
      p.garrison = Math.min(p.maxGarrison, p.garrison + dt * 2.4);
    }
  }

  // Move units along attack vectors
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    let target = s.provinces.find((p) => p.id === u.targetProvinceId);
    if (!target || target.owner === u.side) {
      const enemies = s.provinces.filter((p) => p.owner !== u.side);
      if (enemies.length === 0) continue;
      enemies.sort(
        (a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y)
      );
      target = enemies[0];
      u.targetProvinceId = target.id;
    }

    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const dist = Math.hypot(dx, dy);
    u.angle = Math.atan2(dy, dx);

    if (dist > 14) {
      u.x += (dx / dist) * u.speed * dt;
      u.y += (dy / dist) * u.speed * dt;
    } else {
      // Siege enemy province!
      const dps = u.type === 'tank' ? 32 : u.type === 'ship' ? 38 : 22;
      target.garrison -= dps * dt;
      u.hp -= 12 * dt;

      if (Math.random() < dt * 4) {
        s.explosions.push({
          x: target.x + (Math.random() - 0.5) * 16,
          y: target.y + (Math.random() - 0.5) * 16,
          r: 3,
          maxR: 18,
          alpha: 0.9,
          color: '#FBBF24',
        });
      }

      if (target.garrison <= 0) {
        const oldOwner = target.owner;
        target.owner = u.side;
        target.garrison = 45;
        target.captureFlash = 1;
        const capturer = u.side === 'A' ? countryA.name : countryB.name;
        const loser = oldOwner === 'A' ? countryA.name : countryB.name;

        s.floatTexts.push({
          x: target.x,
          y: target.y - 16,
          text: `${target.name} Captured!`,
          color: '#FDE047',
          life: 0,
        });
        s.explosions.push({
          x: target.x,
          y: target.y,
          r: 6,
          maxR: 48,
          alpha: 1,
          color: '#4ADE80',
        });
        s.bannerText = `${capturer} captured ${target.name} from ${loser}!`;
        soundEngine.playEliminate();
      }
    }
  }

  // Unit vs Unit clashes
  for (let i = 0; i < s.units.length; i++) {
    const a = s.units[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < s.units.length; j++) {
      const b = s.units[j];
      if (b.hp <= 0 || a.side === b.side) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < 26) {
        const dmgA = (a.type === 'tank' ? 36 : a.type === 'ship' ? 40 : 24) * dt;
        const dmgB = (b.type === 'tank' ? 36 : b.type === 'ship' ? 40 : 24) * dt;
        b.hp -= dmgA;
        a.hp -= dmgB;
        if (Math.random() < dt * 5) {
          s.explosions.push({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            r: 2,
            maxR: 15,
            alpha: 0.85,
            color: '#F87171',
          });
        }
        if (b.hp <= 0) s.killsA += 1;
        if (a.hp <= 0) s.killsB += 1;
      }
    }
  }

  s.units = s.units.filter((u) => u.hp > 0);

  // Effects
  for (let i = s.explosions.length - 1; i >= 0; i--) {
    const ex = s.explosions[i];
    ex.r += (ex.maxR - ex.r) * Math.min(1, dt * 8);
    ex.alpha -= dt * 2.4;
    if (ex.alpha <= 0) s.explosions.splice(i, 1);
  }
  for (let i = s.floatTexts.length - 1; i >= 0; i--) {
    const ft = s.floatTexts[i];
    ft.life += dt;
    ft.y -= dt * 18;
    if (ft.life > 1.4) s.floatTexts.splice(i, 1);
  }

  // Victory Check
  const remA = s.provinces.filter((p) => p.owner === 'A').length;
  const remB = s.provinces.filter((p) => p.owner === 'B').length;
  if (remB === 0) {
    s.winner = 'A';
    s.bannerText = `${countryA.name} conquered all territories!`;
    soundEngine.playVictory();
    soundEngine.speakWinner(countryA, [countryA.code, countryB.code]);
  } else if (remA === 0) {
    s.winner = 'B';
    s.bannerText = `${countryB.name} conquered all territories!`;
    soundEngine.playVictory();
    soundEngine.speakWinner(countryB, [countryA.code, countryB.code]);
  }
}

function drawWarMap(
  ctx: CanvasRenderingContext2D,
  s: WarSimState,
  countryA: CountryDef,
  countryB: CountryDef,
  colorA: string,
  colorB: string,
  selectedProvId: number | null,
  mapH: number = MAP_H
) {
  // Deep strategy ocean water background
  const oceanGrad = ctx.createLinearGradient(0, 0, MAP_W, mapH);
  oceanGrad.addColorStop(0, '#1B5AA8');
  oceanGrad.addColorStop(0.5, '#1F69BF');
  oceanGrad.addColorStop(1, '#164A8E');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, MAP_W, mapH);

  // Subtle nautical latitude/longitude grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < MAP_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, mapH);
    ctx.stroke();
  }
  for (let y = 0; y < mapH; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }

  const yOffset = (mapH - MAP_H) * 0.5;
  ctx.save();
  ctx.translate(0, yOffset);

  // Supply / sea-lane dashed lines between neighboring provinces
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 5]);
  for (const p of s.provinces) {
    for (const nId of p.neighbors) {
      if (nId > p.id) {
        const nb = s.provinces[nId];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Draw Province Polygons (dark outline coastline + colored territory fill)
  for (const p of s.provinces) {
    ctx.save();
    ctx.beginPath();
    p.polygon.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    // Dark coastal shadow
    ctx.shadowColor = 'rgba(7, 20, 48, 0.65)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.owner === 'A' ? colorA : colorB;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Subtle terrain shading overlay
    ctx.fillStyle =
      p.captureFlash > 0
        ? `rgba(255, 255, 255, ${p.captureFlash * 0.45})`
        : 'rgba(15, 23, 42, 0.18)';
    ctx.fill();

    ctx.strokeStyle = selectedProvId === p.id ? '#FACC15' : '#0B1730';
    ctx.lineWidth = selectedProvId === p.id ? 3.5 : 2.2;
    ctx.stroke();
    ctx.restore();
  }

  // Draw Attack Arrows for marching units
  for (const u of s.units) {
    const target = s.provinces.find((p) => p.id === u.targetProvinceId);
    if (!target) continue;
    const dx = target.x - u.x;
    const dy = target.y - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) continue;

    ctx.save();
    const arrowColor = u.side === 'A' ? '#FACC15' : '#F87171';
    ctx.strokeStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.lineTo(u.x + (dx / dist) * Math.min(dist - 12, 62), u.y + (dy / dist) * Math.min(dist - 12, 62));
    ctx.stroke();

    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    const tipX = u.x + (dx / dist) * Math.min(dist - 12, 62);
    const tipY = u.y + (dy / dist) * Math.min(dist - 12, 62);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Arrowhead
    const ang = Math.atan2(dy, dx);
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(ang) * 7, tipY + Math.sin(ang) * 7);
    ctx.lineTo(tipX + Math.cos(ang + 2.5) * 7, tipY + Math.sin(ang + 2.5) * 7);
    ctx.lineTo(tipX + Math.cos(ang - 2.5) * 7, tipY + Math.sin(ang - 2.5) * 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Draw City Nodes + Labels
  for (const p of s.provinces) {
    ctx.save();
    // City white circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.isCapital ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = p.isCapital ? '#FACC15' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // City name label
    ctx.font = p.isCapital ? '700 12px "Outfit", sans-serif' : '600 10.5px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(8, 13, 30, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.name, p.x, p.y - 11);
    ctx.fillStyle = p.isCapital ? '#FEF08A' : '#F8FAFC';
    ctx.fillText(p.name, p.x, p.y - 11);
    ctx.restore();
  }

  // Draw Military Units (Tanks / Infantry / Warships + mini circular flag)
  const flagBmpA = getFlagBitmap(countryA.code);
  const flagBmpB = getFlagBitmap(countryB.code);
  for (const u of s.units) {
    ctx.save();
    ctx.translate(u.x, u.y);

    // Unit body
    ctx.save();
    ctx.rotate(u.angle);
    if (u.type === 'tank') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-11, -7, 22, 14);
      ctx.strokeRect(-11, -7, 22, 14);
      // Turret barrel
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(2, -2, 13, 4);
    } else if (u.type === 'ship') {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -6);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Mini Country Flag badge on unit
    const bmp = u.side === 'A' ? flagBmpA : flagBmpB;
    ctx.drawImage(bmp, -8, -8, 16, 16);

    // Unit HP bar
    const hpRatio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(-10, -14, 20, 3);
    ctx.fillStyle = u.side === 'A' ? '#4ADE80' : '#F87171';
    ctx.fillRect(-10, -14, 20 * hpRatio, 3);

    ctx.restore();
  }

  // Draw Explosions
  for (const ex of s.explosions) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ex.alpha);
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
    ctx.fillStyle = ex.color;
    ctx.fill();
    ctx.restore();
  }

  // Draw Floating Capture Callouts
  for (const ft of s.floatTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ft.life / 1.4);
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}
