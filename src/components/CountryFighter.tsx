import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Mic,
  MicOff,
  Search,
  Shield,
  Swords,
  Trophy,
  Volume2,
} from 'lucide-react';
import { COUNTRIES, CountryDef } from '../data/countries';
import {
  buildFighterCommentary,
  CommentaryLanguage,
  getCountrySpokenName,
  resolveSpokenLanguage,
} from '../data/raceCommentary';
import { getRectFlagBitmap } from '../utils/flagRenderer';
import { soundEngine } from '../utils/sound';
import { FlagBadge } from './FlagBadge';
import { HeaderStatBox } from './HeaderStatBox';
import { VictoryConfetti } from './VictoryConfetti';

export type FighterStageTheme = 'shrine' | 'rooftop' | 'dojo';
export type FighterControlMode = 'cpu' | 'p1';
export type FighterCameraMode = 'all' | 'focus';

export interface FighterConfig {
  fighterCodes: string[];
  controlMode: FighterControlMode;
  stageTheme: FighterStageTheme;
  commLang: CommentaryLanguage;
}

interface CountryFighterProps {
  config: FighterConfig;
  camMode: FighterCameraMode;
  isPlaying: boolean;
  speedMultiplier: number;
  autoNextCycle: boolean;
  restartSignal: number;
  voiceOn: boolean;
  customModalOpen: boolean;
  isPortrait916?: boolean;
  onCloseCustomModal: () => void;
  onToggleVoice: () => void;
  onUpdateConfig: (patch: Partial<FighterConfig>) => void;
  onOpenMenu: () => void;
  onRecordWin?: (country: CountryDef) => void;
}

type MoveKind =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'backdash'
  | 'jump'
  | 'jumpkick'
  | 'axekick'
  | 'guard'
  | 'jab'
  | 'cross'
  | 'lowkick'
  | 'highkick'
  | 'spinkick'
  | 'uppercut'
  | 'throw'
  | 'rage'
  | 'hitstun'
  | 'knockdown'
  | 'victory';

interface FighterEntity {
  slot: number;
  country: CountryDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  trailHp: number;
  maxHp: number;
  roundsWon: number;
  move: MoveKind;
  moveTimer: number;
  moveDuration: number;
  hasHitCurrMove: boolean;
  hitstunTimer: number;
  guardTimer: number;
  aiThinkTimer: number;
  comboCount: number;
  comboResetTimer: number;
  juggleHits: number;
  rageUsed: boolean;
  wavePhase: number;
  stridePhase: number;
  squashY: number;
  depthOffsetY: number;
  spriteScale: number;
  dropDelay: number;
  landedIntro: boolean;
  primaryColor: string;
  accentColor: string;
  skinTone: string;
  hairColor: string;
}

interface HitSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
  isStarburst?: boolean;
}

interface ShockRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  life: number;
  maxLife: number;
}

interface DustPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

interface SwingTrail {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingBanner {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface StageDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

interface FighterSimState {
  fighters: FighterEntity[];
  sparks: HitSpark[];
  rings: ShockRing[];
  dustPuffs: DustPuff[];
  trails: SwingTrail[];
  banners: FloatingBanner[];
  dust: StageDust[];
  stageMinX: number;
  stageMaxX: number;
  stageWidth: number;
  roundNum: number;
  roundTimer: number;
  phase: 'intro' | 'fight' | 'ko' | 'matchEnd';
  phaseTimer: number;
  bannerText: string;
  bannerColor: string;
  hitStopTimer: number;
  shakeTimer: number;
  camX: number;
  camZoom: number;
  focusSlot: number;
  focusTimer: number;
  commentaryTimer: number;
  elimCooldown: number;
  comboSpeakCooldown: number;
  liveCommentary: string;
  roundWinnerSlot: number | null;
  matchWinner: FighterEntity | null;
  announcedFight: boolean;
}

const CANVAS_W = 1280;
const CANVAS_H = 720;
const FLOOR_Y = 535;
const FIGHTER_MAX_HP = 200;
const RAGE_THRESHOLD = 70;
const MAX_FIGHTERS = COUNTRIES.length;

function getStageBounds(count: number): {
  stageMinX: number;
  stageMaxX: number;
  stageWidth: number;
} {
  // Single-frame 1280px arena so ALL 2–64 fighters stay large, clear & inside ONE camera view!
  const stageMinX = 72;
  const stageWidth = count <= 4 ? 1020 : count <= 16 ? 1100 : 1140;
  return {
    stageMinX,
    stageMaxX: stageMinX + stageWidth,
    stageWidth,
  };
}

function pickFighterPalette(country: CountryDef, slot: number): {
  primary: string;
  accent: string;
  skinTone: string;
  hairColor: string;
} {
  const cols = country.colors.filter(Boolean) as string[];
  let primary = cols[0] || '#EF4444';
  for (const c of cols) {
    const l = c.toLowerCase();
    if (l !== '#ffffff' && l !== '#f4f5f8' && l !== '#111111' && l !== '#141414') {
      primary = c;
      break;
    }
  }
  const accent = cols.find((c) => c.toLowerCase() !== primary.toLowerCase()) || '#FACC15';
  const skinTones = ['#F1C29B', '#E0AC7E', '#C68B59', '#F5CBA7', '#D49A6A'];
  const hairColors = ['#111827', '#3B2314', '#92400E', '#1E293B', '#451A03'];
  return {
    primary,
    accent,
    skinTone: skinTones[slot % skinTones.length],
    hairColor: hairColors[slot % hairColors.length],
  };
}

function createFighterEntity(
  slot: number,
  country: CountryDef,
  total: number,
  stageMinX: number,
  stageMaxX: number,
  roundsWon = 0
): FighterEntity {
  const spanLeft = stageMinX + 54;
  const spanRight = stageMaxX - 54;

  // Distribute 50-64 fighters cleanly across 4-5 staggered 2.5D mat rows so EVERY fighter is large & visible!
  const rows = total <= 6 ? 1 : total <= 16 ? 3 : total <= 36 ? 4 : 5;
  const rowIdx = slot % rows;
  const colIdx = Math.floor(slot / rows);
  const totalCols = Math.ceil(total / rows);
  const rowShift = rows > 1 && rowIdx % 2 === 1 ? 0.45 : 0;

  const x =
    total === 2
      ? slot === 0
        ? 410
        : 870
      : spanLeft +
        Math.min(1, (colIdx + rowShift) / Math.max(1, totalCols - (rows > 1 ? 0.4 : 1))) *
          (spanRight - spanLeft);

  const depthRows =
    total <= 6
      ? [0]
      : total <= 16
        ? [-42, 0, 42]
        : total <= 36
          ? [-72, -24, 24, 72]
          : [-88, -44, 0, 44, 88];
  const depthOffsetY = depthRows[rowIdx] ?? 0;

  const spriteScale =
    total <= 6 ? 1.06 : total <= 16 ? 0.94 : total <= 36 ? 0.86 : 0.80;

  const { primary, accent, skinTone, hairColor } = pickFighterPalette(country, slot);

  // Every fighter drops dramatically into their formation lane inside one single frame!
  return {
    slot,
    country,
    x,
    y: -110 - (slot % 4) * 44,
    vx: 0,
    vy: 120,
    facing: x <= (stageMinX + stageMaxX) * 0.5 ? 1 : -1,
    hp: FIGHTER_MAX_HP,
    trailHp: FIGHTER_MAX_HP,
    maxHp: FIGHTER_MAX_HP,
    roundsWon,
    move: 'jump',
    moveTimer: 0,
    moveDuration: 0.4,
    hasHitCurrMove: false,
    hitstunTimer: 0,
    guardTimer: 0,
    aiThinkTimer: 0.05 + (slot % 6) * 0.04,
    comboCount: 0,
    comboResetTimer: 0,
    juggleHits: 0,
    rageUsed: false,
    wavePhase: slot * 1.4,
    stridePhase: slot * 1.2,
    squashY: 1,
    depthOffsetY,
    spriteScale,
    dropDelay: total > 12 ? (slot % 8) * 0.04 : (slot % 4) * 0.08,
    landedIntro: false,
    primaryColor: primary,
    accentColor: accent,
    skinTone,
    hairColor,
  };
}

function createStageDust(): StageDust[] {
  const list: StageDust[] = [];
  for (let i = 0; i < 26; i++) {
    list.push({
      x: Math.random() * CANVAS_W,
      y: 60 + Math.random() * (FLOOR_Y - 70),
      vx: 10 + Math.random() * 16,
      vy: 6 + Math.random() * 12,
      size: 1.4 + Math.random() * 2.2,
      alpha: 0.25 + Math.random() * 0.35,
    });
  }
  return list;
}

function createRoundState(
  countries: CountryDef[],
  roundNum: number,
  prevWins: number[],
  dust?: StageDust[]
): FighterSimState {
  const { stageMinX, stageMaxX, stageWidth } = getStageBounds(countries.length);
  const fighters = countries.map((c, idx) =>
    createFighterEntity(idx, c, countries.length, stageMinX, stageMaxX, prevWins[idx] ?? 0)
  );
  return {
    fighters,
    sparks: [],
    rings: [],
    dustPuffs: [],
    trails: [],
    banners: [],
    dust: dust ?? createStageDust(),
    stageMinX,
    stageMaxX,
    stageWidth,
    roundNum,
    roundTimer: 99,
    phase: 'intro',
    phaseTimer: 1.45,
    bannerText: `ROUND ${roundNum}`,
    bannerColor: '#FACC15',
    hitStopTimer: 0,
    shakeTimer: 0,
    camX: (stageMinX + stageMaxX) * 0.5,
    camZoom: Math.min(1.0, CANVAS_W / (stageWidth + 130)),
    focusSlot: 0,
    focusTimer: 3.5,
    commentaryTimer: 4.5,
    elimCooldown: 0,
    comboSpeakCooldown: 0,
    liveCommentary: `Round ${roundNum}: All ${countries.length} countries entering the ring together!`,
    roundWinnerSlot: null,
    matchWinner: null,
    announcedFight: false,
  };
}

export const CountryFighter: React.FC<CountryFighterProps> = ({
  config,
  camMode,
  isPlaying,
  speedMultiplier,
  autoNextCycle,
  restartSignal,
  voiceOn,
  customModalOpen,
  isPortrait916 = false,
  onCloseCustomModal,
  onToggleVoice,
  onUpdateConfig,
  onOpenMenu,
  onRecordWin,
}) => {
  const [matchCycle, setMatchCycle] = useState<number>(1);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(soundEngine.getIsSpeaking());
  const [draftCodes, setDraftCodes] = useState<string[]>(config.fighterCodes);
  const [modalQuery, setModalQuery] = useState<string>('');
  const [, setHudTick] = useState<number>(0);

  const activeCountries = useMemo(() => {
    const clean = config.fighterCodes
      .slice(0, MAX_FIGHTERS)
      .map((code) => COUNTRIES.find((c) => c.code === code))
      .filter(Boolean) as CountryDef[];
    return clean.length >= 2 ? clean : COUNTRIES.slice(0, 2);
  }, [config.fighterCodes]);

  useEffect(() => {
    if (customModalOpen) {
      setDraftCodes(activeCountries.map((c) => c.code));
      setModalQuery('');
    }
  }, [customModalOpen, activeCountries]);

  const simRef = useRef<FighterSimState>(
    createRoundState(activeCountries, 1, activeCountries.map(() => 0))
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speedMultiplier);
  const configRef = useRef(config);
  const camModeRef = useRef<FighterCameraMode>(camMode);
  const isPortrait916Ref = useRef(isPortrait916);
  const onRecordWinRef = useRef(onRecordWin);
  const keysRef = useRef<Record<string, boolean>>({});
  const p1QueuedActionRef = useRef<MoveKind | null>(null);

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
    configRef.current = config;
    soundEngine.setCommentaryLang(config.commLang);
    const s = simRef.current;
    if (s.phase === 'fight') {
      const alive = s.fighters.filter((f) => f.hp > 0).sort((a, b) => b.hp - a.hp);
      if (alive.length >= 2) {
        const spokenLang = resolveSpokenLanguage(
          config.commLang,
          s.fighters.map((f) => f.country.code)
        );
        const msg = buildFighterCommentary(
          'pace',
          spokenLang,
          s.roundNum,
          getCountrySpokenName(alive[0].country, spokenLang),
          getCountrySpokenName(alive[1].country, spokenLang),
          alive.length
        );
        s.liveCommentary = msg;
        s.commentaryTimer = 5.5;
        if (soundEngine.voiceEnabled) {
          soundEngine.speakText(msg, true, spokenLang, 'excited');
        }
        setHudTick((t) => t + 1);
      }
    }
  }, [config]);

  useEffect(() => {
    const unsub = soundEngine.subscribeSpeaking(setIsSpeaking);
    return () => unsub();
  }, []);

  useEffect(() => {
    camModeRef.current = camMode;
  }, [camMode]);

  useEffect(() => {
    onRecordWinRef.current = onRecordWin;
  }, [onRecordWin]);

  const startFreshMatch = useCallback(
    (incrementCycle: boolean) => {
      soundEngine.stopAllSpeech();
      simRef.current = createRoundState(
        activeCountries,
        1,
        activeCountries.map(() => 0)
      );
      if (incrementCycle) {
        setMatchCycle((c) => c + 1);
      }
      setHudTick((t) => t + 1);
    },
    [activeCountries]
  );

  useEffect(() => {
    startFreshMatch(false);
  }, [startFreshMatch, restartSignal]);

  // Keyboard listener when Player 1 control mode is active
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (configRef.current.controlMode !== 'p1') return;
      if (k === 'j') p1QueuedActionRef.current = 'jab';
      else if (k === 'k') p1QueuedActionRef.current = 'highkick';
      else if (k === 'n') p1QueuedActionRef.current = 'lowkick';
      else if (k === 'l') p1QueuedActionRef.current = 'spinkick';
      else if (k === 'u') p1QueuedActionRef.current = 'uppercut';
      else if (k === 'i') p1QueuedActionRef.current = 'throw';
      else if (k === 'y') p1QueuedActionRef.current = 'jumpkick';
      else if (k === ' ') {
        e.preventDefault();
        p1QueuedActionRef.current = 'rage';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const matchWinnerId = simRef.current.matchWinner?.country.code ?? null;
  useEffect(() => {
    if (!matchWinnerId || !autoNextCycle) return;
    const timer = window.setTimeout(() => {
      startFreshMatch(true);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [matchWinnerId, autoNextCycle, startFreshMatch]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let syncAcc = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = simRef.current;
      if (isPlayingRef.current) {
        const dt = rawDt * speedRef.current;
        const hadWinner = Boolean(s.matchWinner);
        stepFighterSim(
          s,
          dt,
          configRef.current,
          camModeRef.current,
          keysRef.current,
          p1QueuedActionRef
        );

        if (!hadWinner && s.matchWinner) {
          onRecordWinRef.current?.(s.matchWinner.country);
          setHudTick((t) => t + 1);
        }

        syncAcc += rawDt;
        if (syncAcc > 0.14) {
          syncAcc = 0;
          setHudTick((t) => t + 1);
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const activeCanvasH = isPortrait916Ref.current ? 940 : CANVAS_H;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const tw = Math.round(CANVAS_W * dpr);
        const th = Math.round(activeCanvasH * dpr);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          drawFighterCanvas(ctx, s, configRef.current.stageTheme, now * 0.001, activeCanvasH);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const s = simRef.current;
  const triggerTouchMove = (move: MoveKind) => {
    soundEngine.unlockSpeech();
    soundEngine.startRaceMusic();
    p1QueuedActionRef.current = move;
  };

  const aliveCount = s.fighters.filter((f) => f.hp > 0).length;
  const sortedPowerList = [...s.fighters].sort((a, b) => {
    if ((a.hp > 0) !== (b.hp > 0)) return a.hp > 0 ? -1 : 1;
    if (a.hp !== b.hp) return b.hp - a.hp;
    return a.slot - b.slot;
  });

  return (
    <div className="vortexia-shell bg-[#060918] text-slate-100">
      {/* Pro Header: Title + Colorful Total/Left Countries Box + 3-Lines Menu Right */}
      <header className="border-b border-slate-800 bg-[#0A1024] px-3 py-1.5 sm:px-6 sm:py-2.5 shrink-0">
        <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] sm:text-lg lg:text-xl font-black uppercase tracking-tight leading-none truncate">
              <span className="text-white">VORTEXIA GLOBAL </span>
              <span className="text-amber-400">BATTLE</span>
            </h1>
            <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-[#8C96C8] uppercase tracking-wide tabular-nums truncate">
              Tekken 3 Clash · {config.stageTheme} · R{s.roundNum} · {Math.ceil(s.roundTimer)}s
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <HeaderStatBox
              totalCount={activeCountries.length}
              totalLabel="Countries"
              leftCount={aliveCount}
              leftLabel="Left"
              extraText={`Match ${matchCycle} · R${s.roundNum} · ${Math.ceil(s.roundTimer)}s`}
            />
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-[#0F1633] text-amber-300 hover:border-amber-400 hover:text-white shrink-0"
              aria-label="Open game menu and controls"
              title="All Tekken Options, Countries (2-64), Camera, Voice & Modes"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main 1280x720 2.5D Tekken 3 Stage + Commentary Ticker + Dedicated Live Fighter Power Strip */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 min-h-0 px-2.5 py-2 sm:px-5 sm:py-3 vortexia-split-grid">
        <div className="flex flex-col gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          {/* Live Fighter Play-by-Play Commentary + English/Urdu Quick Switch Bar */}
          <div className="rounded-xl border border-[#1B2344] bg-[#090E23] px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Volume2
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ${
                  isSpeaking ? 'text-emerald-400' : 'text-amber-400/80'
                }`}
              />
              <p className="font-semibold text-amber-200 truncate">{s.liveCommentary}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUpdateConfig({ commLang: 'en' })}
                className={`rounded-md border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-[11px] font-bold ${
                  config.commLang === 'en'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                    : 'border-slate-700 bg-[#060918] text-slate-300 hover:border-slate-500'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onUpdateConfig({ commLang: 'ur' })}
                className={`rounded-md border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-[11px] font-bold ${
                  config.commLang === 'ur'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-[#060918] text-slate-300 hover:border-slate-500'
                }`}
              >
                اردو
              </button>
              <button
                type="button"
                onClick={onToggleVoice}
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-[11px] font-bold ${
                  voiceOn
                    ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-700 bg-[#060918] text-slate-400'
                }`}
              >
                {voiceOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                <span className="hidden sm:inline">{voiceOn ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          <div className="vortexia-main-canvas-box w-full">
            <div
              className={`vortexia-canvas-frame relative rounded-xl border border-slate-700/80 bg-[#050814] overflow-hidden shadow-2xl ${
                config.controlMode === 'p1' ? 'vortexia-canvas-compact' : ''
              }`}
              style={{ aspectRatio: isPortrait916 ? '1280 / 940' : '16 / 9' }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain block select-none"
              />

              {/* Match Victory Celebration Modal */}
              {s.matchWinner && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060918]/78 p-2.5 sm:p-4 backdrop-blur-[2px] overflow-hidden">
                  <VictoryConfetti
                    colors={s.matchWinner.country.colors.filter(Boolean) as string[]}
                    className="z-20"
                  />
                  <div className="relative z-10 w-full max-w-sm max-h-[95%] overflow-y-auto rounded-xl border border-amber-400/60 bg-[#0A1027]/95 p-3.5 sm:p-5 text-center shadow-2xl">
                    <div className="mx-auto mb-1.5 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-amber-400">
                      VORTEXIA GLOBAL BATTLE CHAMPION
                    </p>
                    <div className="my-2 flex justify-center">
                      <FlagBadge
                        code={s.matchWinner.country.code}
                        name={s.matchWinner.country.name}
                        size={52}
                        className="ring-3 ring-amber-400/80"
                      />
                    </div>
                    <h3 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                      {s.matchWinner.country.name} Wins!
                    </h3>
                    <p className="mt-1 text-[11px] sm:text-xs text-slate-300 tabular-nums">
                      Last Standing Champion · Won {s.matchWinner.roundsWon} Rounds
                    </p>

                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => startFreshMatch(true)}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                      >
                        Next Match
                      </button>
                      <button
                        type="button"
                        onClick={() => startFreshMatch(false)}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:border-slate-400 whitespace-nowrap"
                      >
                        Rematch
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Arcade Controls Pad (Shown ONLY when Player 1 Control Mode is active) */}
          {config.controlMode === 'p1' && (
            <div className="w-full flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 rounded-xl border border-slate-800 bg-[#0A1024] px-2.5 py-1.5 sm:px-3 sm:py-2.5 shrink-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onPointerDown={() => {
                    keysRef.current['a'] = true;
                  }}
                  onPointerUp={() => {
                    keysRef.current['a'] = false;
                  }}
                  onPointerLeave={() => {
                    keysRef.current['a'] = false;
                  }}
                  className="min-h-[34px] sm:min-h-[40px] min-w-[44px] sm:min-w-[52px] rounded-lg border border-slate-700 bg-[#0F1733] px-2 sm:px-3 text-[11px] sm:text-xs font-bold text-white active:bg-amber-400 active:text-slate-950"
                >
                  Left
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    keysRef.current['d'] = true;
                  }}
                  onPointerUp={() => {
                    keysRef.current['d'] = false;
                  }}
                  onPointerLeave={() => {
                    keysRef.current['d'] = false;
                  }}
                  className="min-h-[34px] sm:min-h-[40px] min-w-[44px] sm:min-w-[52px] rounded-lg border border-slate-700 bg-[#0F1733] px-2 sm:px-3 text-[11px] sm:text-xs font-bold text-white active:bg-amber-400 active:text-slate-950"
                >
                  Right
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    keysRef.current['w'] = true;
                  }}
                  onPointerUp={() => {
                    keysRef.current['w'] = false;
                  }}
                  onPointerLeave={() => {
                    keysRef.current['w'] = false;
                  }}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-slate-700 bg-[#0F1733] px-2 sm:px-3 text-[11px] sm:text-xs font-bold text-cyan-300"
                >
                  Jump
                </button>
                <button
                  type="button"
                  onPointerDown={() => {
                    keysRef.current['s'] = true;
                  }}
                  onPointerUp={() => {
                    keysRef.current['s'] = false;
                  }}
                  onPointerLeave={() => {
                    keysRef.current['s'] = false;
                  }}
                  className="min-h-[34px] sm:min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0F1733] px-2 sm:px-3 text-[11px] sm:text-xs font-bold text-slate-200"
                >
                  <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400" />
                  <span>Block</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => triggerTouchMove('jab')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-amber-400/60 bg-amber-400/15 px-2 text-[11px] sm:text-xs font-bold text-amber-200 hover:bg-amber-400/25"
                >
                  Jab
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('lowkick')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-lime-400/60 bg-lime-400/15 px-2 text-[11px] sm:text-xs font-bold text-lime-200 hover:bg-lime-400/25"
                >
                  Low Kick
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('highkick')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-emerald-400/60 bg-emerald-400/15 px-2 text-[11px] sm:text-xs font-bold text-emerald-200 hover:bg-emerald-400/25"
                >
                  High Kick
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('jumpkick')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-sky-400/60 bg-sky-400/15 px-2 text-[11px] sm:text-xs font-bold text-sky-200 hover:bg-sky-400/25"
                >
                  Fly Kick
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('spinkick')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-cyan-400/60 bg-cyan-400/15 px-2 text-[11px] sm:text-xs font-bold text-cyan-200 hover:bg-cyan-400/25"
                >
                  Spin
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('uppercut')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-orange-400/60 bg-orange-400/15 px-2 text-[11px] sm:text-xs font-bold text-orange-200 hover:bg-orange-400/25"
                >
                  Upper
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('throw')}
                  className="min-h-[34px] sm:min-h-[40px] rounded-lg border border-purple-400/60 bg-purple-400/15 px-2 text-[11px] sm:text-xs font-bold text-purple-200 hover:bg-purple-400/25"
                >
                  Throw
                </button>
                <button
                  type="button"
                  onClick={() => triggerTouchMove('rage')}
                  className="min-h-[34px] sm:min-h-[40px] inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 text-[11px] sm:text-xs font-extrabold text-white hover:bg-rose-400"
                >
                  <Swords className="h-3.5 w-3.5" />
                  <span>Rage</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Fighter Power Strip (Desktop Sidebar / 9:16 Remaining Viewport Fill) */}
        <aside
          className="vortexia-aside-panel rounded-xl border border-[#1B2344] bg-[#090E23] p-2.5 sm:p-3 gap-2"
          aria-label="Fighter live health and power list"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 shrink-0">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-400">
              Fighter Power
            </span>
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] font-black text-amber-300 tabular-nums">
              {aliveCount} / {activeCountries.length} Left
            </span>
          </div>

          <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {sortedPowerList.map((f, idx) => {
              const isAlive = f.hp > 0;
              const pct = Math.max(0, Math.min(100, Math.round((f.hp / f.maxHp) * 100)));
              const barColor =
                pct > 55 ? 'bg-emerald-400' : pct > 25 ? 'bg-amber-400' : 'bg-rose-500';
              return (
                <div
                  key={`${f.country.code}-${f.slot}`}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-opacity ${
                    isAlive
                      ? f.slot === 0 && config.controlMode === 'p1'
                        ? 'border-amber-400/70 bg-amber-400/10'
                        : 'border-slate-800 bg-[#060918]'
                      : 'border-slate-900 bg-[#050814] opacity-45'
                  }`}
                >
                  <span className="w-5 font-mono text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                    #{idx + 1}
                  </span>
                  <FlagBadge code={f.country.code} name={f.country.name} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 text-[11px] leading-tight">
                      <span className="font-bold text-white truncate">{f.country.name}</span>
                      <span
                        className={`font-mono text-[10px] font-black tabular-nums shrink-0 ${
                          isAlive
                            ? pct <= 35
                              ? 'text-rose-400'
                              : 'text-emerald-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {isAlive ? `${Math.ceil(f.hp)}` : 'KO'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {/* Fighter Country Selection Modal (2 to 64 Fighters) */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={onCloseCustomModal}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-slate-700 bg-[#0B1026] p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Pick Countries for Tekken Ring ({draftCodes.length} / {MAX_FIGHTERS})
                </h3>
                <p className="text-xs text-slate-400">
                  Select 2 to {MAX_FIGHTERS} countries — all fighters stay large &amp; visible in one frame!
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCustomModal}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="my-3 flex flex-wrap items-center gap-2">
              {[2, 4, 8, 16, 32, 50, MAX_FIGHTERS].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraftCodes(COUNTRIES.slice(0, n).map((c) => c.code))}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-amber-400"
                >
                  {n === MAX_FIGHTERS ? `All ${MAX_FIGHTERS}` : `${n} Fighters`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDraftCodes(draftCodes.slice(0, 2))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-amber-300"
              >
                Trim to 2
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={modalQuery}
                onChange={(e) => setModalQuery(e.target.value)}
                placeholder="Search any country to add or remove..."
                className="w-full rounded-lg border border-slate-700 bg-[#060918] py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid max-h-60 grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto pr-1">
              {COUNTRIES.filter(
                (c) =>
                  c.name.toLowerCase().includes(modalQuery.toLowerCase()) ||
                  c.code.toLowerCase().includes(modalQuery.toLowerCase())
              ).map((c) => {
                const checked = draftCodes.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setDraftCodes((prev) => {
                        if (prev.includes(c.code)) {
                          if (prev.length <= 2) return prev;
                          return prev.filter((x) => x !== c.code);
                        }
                        if (prev.length >= MAX_FIGHTERS) return prev;
                        return [...prev, c.code];
                      });
                    }}
                    className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-2.5 py-1 text-left text-xs font-medium ${
                      checked
                        ? 'border-rose-400 bg-rose-500/15 text-rose-100'
                        : 'border-slate-800 bg-slate-900/50 text-slate-300'
                    }`}
                  >
                    <FlagBadge code={c.code} name={c.name} size={18} />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  onUpdateConfig({ fighterCodes: draftCodes });
                  onCloseCustomModal();
                }}
                className="min-h-[40px] rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Fight With {draftCodes.length} Countries
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function spawnDustCloud(s: FighterSimState, x: number, y: number, count = 6, dir = 0) {
  if (s.dustPuffs.length > 48) return;
  for (let i = 0; i < count; i++) {
    s.dustPuffs.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y - 4,
      vx: dir * (40 + Math.random() * 80) + (Math.random() - 0.5) * 90,
      vy: -25 - Math.random() * 55,
      r: 4 + Math.random() * 6,
      life: 0,
      maxLife: 0.28 + Math.random() * 0.16,
    });
  }
}

function startMove(f: FighterEntity, move: MoveKind, s?: FighterSimState) {
  if (f.move === 'knockdown' || f.move === 'hitstun') return;
  f.move = move;
  f.moveTimer = 0;
  f.hasHitCurrMove = false;
  if (move === 'jab') {
    f.moveDuration = 0.21;
    f.vx = f.facing * 125;
    soundEngine.playWhoosh();
  } else if (move === 'cross') {
    f.moveDuration = 0.3;
    f.vx = f.facing * 175;
    soundEngine.playWhoosh();
  } else if (move === 'lowkick') {
    f.moveDuration = 0.28;
    f.vx = f.facing * 145;
    soundEngine.playWhoosh();
  } else if (move === 'highkick') {
    f.moveDuration = 0.36;
    f.vx = f.facing * 160;
    soundEngine.playWhoosh();
  } else if (move === 'jumpkick') {
    f.moveDuration = 0.58;
    f.vx = f.facing * 310;
    if (f.y >= FLOOR_Y - 4) f.vy = -490;
    if (s) spawnDustCloud(s, f.x, FLOOR_Y, 5, -f.facing);
    soundEngine.playWhoosh();
  } else if (move === 'axekick') {
    f.moveDuration = 0.54;
    f.vx = f.facing * 240;
    if (f.y >= FLOOR_Y - 4) f.vy = -440;
    if (s) spawnDustCloud(s, f.x, FLOOR_Y, 5, -f.facing);
    soundEngine.playWhoosh();
  } else if (move === 'spinkick') {
    f.moveDuration = 0.46;
    f.vx = f.facing * 235;
    soundEngine.playWhoosh();
  } else if (move === 'uppercut') {
    f.moveDuration = 0.44;
    f.vx = f.facing * 185;
    f.vy = -245;
    soundEngine.playWhoosh();
  } else if (move === 'throw') {
    f.moveDuration = 0.44;
    f.vx = f.facing * 195;
    soundEngine.playWhoosh();
  } else if (move === 'rage') {
    f.moveDuration = 0.64;
    f.vx = f.facing * 360;
    f.vy = -190;
    f.rageUsed = true;
    if (s) spawnDustCloud(s, f.x, FLOOR_Y, 8, -f.facing);
    soundEngine.playWhoosh();
  } else if (move === 'dash') {
    f.moveDuration = 0.28;
    f.vx = f.facing * 420;
    if (s) spawnDustCloud(s, f.x, FLOOR_Y, 5, -f.facing);
  } else if (move === 'backdash') {
    f.moveDuration = 0.24;
    f.vx = -f.facing * 340;
    f.vy = -165;
    if (s) spawnDustCloud(s, f.x, FLOOR_Y, 4, f.facing);
  }
}

function getMoveSpec(move: MoveKind): {
  activeStart: number;
  activeEnd: number;
  reach: number;
  dmg: number;
  knock: number;
  heavy: boolean;
  launchVy: number;
  unblockable?: boolean;
  hitHeightOffset: number;
} | null {
  switch (move) {
    case 'jab':
      return { activeStart: 0.06, activeEnd: 0.16, reach: 82, dmg: 4, knock: 95, heavy: false, launchVy: 0, hitHeightOffset: -84 };
    case 'lowkick':
      return { activeStart: 0.08, activeEnd: 0.21, reach: 92, dmg: 6, knock: 110, heavy: false, launchVy: 0, hitHeightOffset: -24 };
    case 'cross':
      return { activeStart: 0.1, activeEnd: 0.24, reach: 92, dmg: 8, knock: 165, heavy: false, launchVy: 0, hitHeightOffset: -82 };
    case 'highkick':
      return { activeStart: 0.13, activeEnd: 0.29, reach: 104, dmg: 11, knock: 205, heavy: true, launchVy: 0, hitHeightOffset: -94 };
    case 'jumpkick':
      return { activeStart: 0.18, activeEnd: 0.48, reach: 112, dmg: 14, knock: 245, heavy: true, launchVy: -180, hitHeightOffset: -72 };
    case 'axekick':
      return { activeStart: 0.2, activeEnd: 0.46, reach: 96, dmg: 15, knock: 210, heavy: true, launchVy: -150, hitHeightOffset: -86 };
    case 'uppercut':
      return { activeStart: 0.12, activeEnd: 0.31, reach: 88, dmg: 13, knock: 165, heavy: true, launchVy: -380, hitHeightOffset: -96 };
    case 'spinkick':
      return { activeStart: 0.16, activeEnd: 0.38, reach: 112, dmg: 15, knock: 270, heavy: true, launchVy: -165, hitHeightOffset: -86 };
    case 'throw':
      return { activeStart: 0.13, activeEnd: 0.3, reach: 76, dmg: 18, knock: 275, heavy: true, launchVy: -250, unblockable: true, hitHeightOffset: -74 };
    case 'rage':
      return { activeStart: 0.16, activeEnd: 0.56, reach: 132, dmg: 24, knock: 360, heavy: true, launchVy: -330, unblockable: true, hitHeightOffset: -84 };
    default:
      return null;
  }
}

function isAttackMove(m: MoveKind): boolean {
  return (
    m === 'jab' ||
    m === 'cross' ||
    m === 'lowkick' ||
    m === 'highkick' ||
    m === 'jumpkick' ||
    m === 'axekick' ||
    m === 'spinkick' ||
    m === 'uppercut' ||
    m === 'throw' ||
    m === 'rage'
  );
}

function stepFighterSim(
  s: FighterSimState,
  dt: number,
  config: FighterConfig,
  camMode: FighterCameraMode,
  keys: Record<string, boolean>,
  p1QueuedActionRef: React.MutableRefObject<MoveKind | null>
) {
  const spokenLang = resolveSpokenLanguage(
    config.commLang,
    s.fighters.map((f) => f.country.code)
  );

  // Stage dust / embers ambient drift
  for (const d of s.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x > CANVAS_W) d.x = -4;
    if (d.y > FLOOR_Y) {
      d.y = 50;
      d.x = Math.random() * CANVAS_W;
    }
  }

  // Decay sparks, rings, dust puffs, swing trails & floating banners
  for (let i = s.sparks.length - 1; i >= 0; i--) {
    const sp = s.sparks[i];
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      s.sparks.splice(i, 1);
      continue;
    }
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
  }
  for (let i = s.rings.length - 1; i >= 0; i--) {
    const rg = s.rings[i];
    rg.life += dt;
    rg.r += (rg.maxR - rg.r) * Math.min(1, dt * 11);
    if (rg.life >= rg.maxLife) s.rings.splice(i, 1);
  }
  for (let i = s.dustPuffs.length - 1; i >= 0; i--) {
    const dp = s.dustPuffs[i];
    dp.life += dt;
    dp.x += dp.vx * dt;
    dp.y += dp.vy * dt;
    dp.r += dt * 14;
    if (dp.life >= dp.maxLife) s.dustPuffs.splice(i, 1);
  }
  for (let i = s.trails.length - 1; i >= 0; i--) {
    s.trails[i].life += dt;
    if (s.trails[i].life >= s.trails[i].maxLife) s.trails.splice(i, 1);
  }
  for (let i = s.banners.length - 1; i >= 0; i--) {
    s.banners[i].life += dt;
    s.banners[i].y -= dt * 32;
    if (s.banners[i].life > 1.25) s.banners.splice(i, 1);
  }

  for (const f of s.fighters) {
    f.wavePhase += dt * 10;
    f.stridePhase += dt * (f.move === 'dash' ? 24 : f.move === 'walk' ? 15 : 6);
    f.trailHp += (f.hp - f.trailHp) * Math.min(1, dt * 3.4);
    f.squashY += (1 - f.squashY) * Math.min(1, dt * 12);
    if (f.comboResetTimer > 0) {
      f.comboResetTimer = Math.max(0, f.comboResetTimer - dt);
      if (f.comboResetTimer === 0) f.comboCount = 0;
    }
  }
  if (s.shakeTimer > 0) s.shakeTimer = Math.max(0, s.shakeTimer - dt);

  if (s.hitStopTimer > 0) {
    s.hitStopTimer = Math.max(0, s.hitStopTimer - dt);
    return;
  }

  // Camera framing: Default 'all' ALWAYS keeps ALL 2–64 fighters large & inside ONE shared frame!
  const aliveList = s.fighters.filter((f) => f.hp > 0);
  if (camMode === 'all') {
    const midGround = (s.stageMinX + s.stageMaxX) * 0.5;
    const fitZoom = Math.min(1.0, CANVAS_W / (s.stageWidth + 130));
    s.camX += (midGround - s.camX) * Math.min(1, dt * 6);
    s.camZoom += (fitZoom - s.camZoom) * Math.min(1, dt * 6);
  } else if (aliveList.length > 0) {
    s.focusTimer -= dt;
    let focus =
      config.controlMode === 'p1'
        ? aliveList.find((f) => f.slot === 0) ?? aliveList[0]
        : aliveList.find((f) => f.slot === s.focusSlot);
    if (!focus || (config.controlMode !== 'p1' && s.focusTimer <= 0)) {
      focus = aliveList[Math.floor(Math.random() * aliveList.length)] ?? aliveList[0];
      s.focusSlot = focus.slot;
      s.focusTimer = 3.8;
    }
    const nearby = aliveList.filter((f) => Math.abs(f.x - focus!.x) <= 340);
    const cluster = nearby.length >= 2 ? nearby : [focus];
    let minX = cluster[0].x;
    let maxX = cluster[0].x;
    for (const f of cluster) {
      minX = Math.min(minX, f.x);
      maxX = Math.max(maxX, f.x);
    }
    const midX = (minX + maxX) * 0.5;
    const span = Math.max(460, maxX - minX + 260);
    const desiredZoom = Math.max(0.95, Math.min(1.18, CANVAS_W / (span * 1.04)));
    s.camX += (midX - s.camX) * Math.min(1, dt * 4.2);
    s.camZoom += (desiredZoom - s.camZoom) * Math.min(1, dt * 4.2);
  }

  // Phase 1: Dramatic Sky-Drop Entrance ("ROUND X" -> "FIGHT!")
  if (s.phase === 'intro') {
    s.phaseTimer -= dt;
    for (const f of s.fighters) {
      if (f.dropDelay > 0) {
        f.dropDelay -= dt;
        continue;
      }
      if (f.y < FLOOR_Y) {
        f.vy += 1550 * dt;
        f.y += f.vy * dt;
        f.move = 'jumpkick';
        if (f.y >= FLOOR_Y) {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.squashY = 0.72;
          f.move = 'idle';
          if (!f.landedIntro) {
            f.landedIntro = true;
            spawnDustCloud(s, f.x, FLOOR_Y, 8);
            soundEngine.playBounce(0.7);
          }
        }
      }
    }

    if (!s.announcedFight && s.phaseTimer < 1.05) {
      s.announcedFight = true;
      soundEngine.playCountdownBeep(true);
      const customIntro = soundEngine.customCommentary.customIntroLine.trim();
      const call =
        customIntro || buildFighterCommentary('fight', spokenLang, s.roundNum, '', '', s.fighters.length);
      s.liveCommentary = call;
      s.commentaryTimer = 5.2;
      soundEngine.speakText(call, false, spokenLang, 'countdown');
    }
    if (s.phaseTimer < 0.45) {
      s.bannerText = 'FIGHT!';
      s.bannerColor = '#34D399';
    }
    if (s.phaseTimer <= 0) {
      s.phase = 'fight';
      s.bannerText = '';
    }
    return;
  }

  // Phase 3: K.O. celebration before next round or match end
  if (s.phase === 'ko') {
    s.phaseTimer -= dt;
    for (const f of s.fighters) {
      if (f.y < FLOOR_Y || f.vy !== 0) {
        f.vy += 980 * dt;
        f.y += f.vy * dt;
        if (f.y >= FLOOR_Y) {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.squashY = 0.78;
        }
      }
      f.x = Math.max(s.stageMinX, Math.min(s.stageMaxX, f.x + f.vx * dt));
      f.vx *= Math.pow(0.08, dt);
    }
    if (s.phaseTimer <= 0) {
      const winner = s.fighters.find((f) => f.slot === s.roundWinnerSlot) ?? s.fighters[0];
      if (winner.roundsWon >= 2) {
        s.phase = 'matchEnd';
        s.matchWinner = winner;
        winner.move = 'victory';
        soundEngine.playVictory();
        soundEngine.playCrowdCheer();
        const winSpoken = getCountrySpokenName(winner.country, spokenLang);
        const opp = s.fighters.find((f) => f.slot !== winner.slot);
        const oppSpoken = opp ? getCountrySpokenName(opp.country, spokenLang) : '';
        const customWin = soundEngine.customCommentary.customVictoryLine.trim();
        const winLine = customWin
          ? customWin
              .replace(/\{winner\}|\{leader\}|\{country\}/gi, winSpoken)
              .replace(/\{rival\}/gi, oppSpoken || winSpoken)
          : buildFighterCommentary('victory', spokenLang, s.roundNum, winSpoken, oppSpoken, 1);
        s.liveCommentary = winLine;
        soundEngine.speakText(winLine, false, spokenLang, 'victory');
      } else {
        const nextWins = s.fighters.map((f) => f.roundsWon);
        const nextRound = createRoundState(
          s.fighters.map((f) => f.country),
          s.roundNum + 1,
          nextWins,
          s.dust
        );
        Object.assign(s, nextRound);
      }
    }
    return;
  }

  if (s.phase === 'matchEnd') {
    return;
  }

  // Phase 2: High-Tempo Live Combat + Play-by-Play Commentary Timers
  s.roundTimer = Math.max(0, s.roundTimer - dt);
  if (s.elimCooldown > 0) s.elimCooldown = Math.max(0, s.elimCooldown - dt);
  if (s.comboSpeakCooldown > 0) s.comboSpeakCooldown = Math.max(0, s.comboSpeakCooldown - dt);
  s.commentaryTimer -= dt;

  for (const f of s.fighters) {
    if (f.hp <= 0) {
      f.move = 'knockdown';
      f.x = Math.max(s.stageMinX, Math.min(s.stageMaxX, f.x + f.vx * dt));
      f.vx *= Math.pow(0.05, dt);
      if (f.y < FLOOR_Y || f.vy !== 0) {
        f.vy += 1050 * dt;
        f.y += f.vy * dt;
        if (f.y >= FLOOR_Y) {
          f.y = FLOOR_Y;
          f.vy = 0;
          f.squashY = 0.78;
        }
      }
      continue;
    }

    // Pick closest alive opponent (favoring similar 2.5D depth lane cleanly)
    const opponents = s.fighters.filter((o) => o.slot !== f.slot && o.hp > 0);
    const target = opponents.sort(
      (a, b) =>
        Math.hypot(a.x - f.x, (a.depthOffsetY - f.depthOffsetY) * 1.4) -
        Math.hypot(b.x - f.x, (b.depthOffsetY - f.depthOffsetY) * 1.4)
    )[0];
    if (target && (f.move === 'idle' || f.move === 'walk' || f.move === 'guard')) {
      f.facing = target.x >= f.x ? 1 : -1;
    }
    if (target && s.fighters.length > 6 && f.move !== 'hitstun' && f.move !== 'knockdown') {
      const dz = target.depthOffsetY - f.depthOffsetY;
      if (Math.abs(dz) > 6) {
        f.depthOffsetY = Math.max(-92, Math.min(92, f.depthOffsetY + Math.sign(dz) * 24 * dt));
      }
    }

    if (f.hitstunTimer > 0) {
      f.hitstunTimer = Math.max(0, f.hitstunTimer - dt);
      if (f.hitstunTimer === 0 && f.y >= FLOOR_Y - 1) f.move = 'idle';
    } else if (f.guardTimer > 0) {
      f.guardTimer = Math.max(0, f.guardTimer - dt);
      if (f.guardTimer === 0 && f.move === 'guard') f.move = 'idle';
    } else if (f.move === 'dash' || f.move === 'backdash' || isAttackMove(f.move)) {
      f.moveTimer += dt;
      if (f.move === 'dash') {
        f.vx = f.facing * 410;
      }
      // Add subtle motion-blur swing trail during peak active frames
      if (isAttackMove(f.move) && s.trails.length < 32 && Math.random() < dt * 26) {
        const reachX = f.x + f.facing * 52;
        const reachY = f.y - (f.move === 'lowkick' ? 24 : 78);
        s.trails.push({
          x1: f.x + f.facing * 12,
          y1: f.y - 72,
          x2: reachX,
          y2: reachY,
          color: f.move === 'rage' ? '#F43F5E' : f.accentColor,
          life: 0,
          maxLife: 0.14,
        });
      }
      if (f.moveTimer >= f.moveDuration) {
        f.move = 'idle';
        f.moveTimer = 0;
      }
    } else if (config.controlMode === 'p1' && f.slot === 0) {
      const queued = p1QueuedActionRef.current;
      p1QueuedActionRef.current = null;
      if (queued === 'rage' && !f.rageUsed && f.hp <= RAGE_THRESHOLD) {
        startMove(f, 'rage', s);
      } else if (queued && queued !== 'rage') {
        startMove(f, queued, s);
      } else if (keys['s']) {
        f.move = 'guard';
        f.vx *= 0.7;
      } else {
        let dir = 0;
        if (keys['a']) dir -= 1;
        if (keys['d']) dir += 1;
        if (dir !== 0) {
          f.move = 'walk';
          f.vx = dir * 285;
        } else {
          f.move = 'idle';
          f.vx *= 0.65;
        }
        if (keys['w'] && f.y >= FLOOR_Y - 1) {
          f.vy = -510;
          f.move = 'jump';
          spawnDustCloud(s, f.x, FLOOR_Y, 4);
        }
      }
    } else if (target) {
      // Energetic Running, Leaping, Aerial & Karate Combo AI!
      f.aiThinkTimer -= dt;
      const dist = Math.abs(target.x - f.x);
      const targetAirborne = target.y < FLOOR_Y - 14;
      const isThreatened = dist < 130 && isAttackMove(target.move);

      if (f.aiThinkTimer <= 0) {
        f.aiThinkTimer = 0.09 + Math.random() * 0.15;
        if (isThreatened && Math.random() < 0.28) {
          if (Math.random() < 0.45 && f.y >= FLOOR_Y - 2) {
            startMove(f, 'backdash', s);
          } else {
            f.move = 'guard';
            f.guardTimer = 0.28;
            f.vx = -f.facing * 55;
          }
        } else if (targetAirborne && dist < 115 && Math.random() < 0.8) {
          startMove(f, Math.random() < 0.5 ? 'jab' : 'highkick', s);
        } else if (dist > 170) {
          // Far away: Sprint dash OR leap in from the air with a flying jumpkick!
          const roll = Math.random();
          if (roll < 0.42 && f.y >= FLOOR_Y - 2) {
            startMove(f, 'jumpkick', s);
          } else if (roll < 0.78) {
            startMove(f, 'dash', s);
          } else {
            f.move = 'walk';
            f.vx = f.facing * 290;
          }
        } else if (dist < 114) {
          const roll = Math.random();
          if (f.hp <= RAGE_THRESHOLD && !f.rageUsed && roll < 0.34) {
            startMove(f, 'rage', s);
          } else if (dist < 70 && target.move === 'guard' && roll < 0.45) {
            startMove(f, 'throw', s);
          } else if (roll < 0.19) {
            startMove(f, 'jab', s);
          } else if (roll < 0.34) {
            startMove(f, 'lowkick', s);
          } else if (roll < 0.49) {
            startMove(f, 'cross', s);
          } else if (roll < 0.65) {
            startMove(f, 'highkick', s);
          } else if (roll < 0.77) {
            startMove(f, 'spinkick', s);
          } else if (roll < 0.89) {
            startMove(f, 'axekick', s);
          } else {
            startMove(f, 'uppercut', s);
          }
        } else {
          // Mid range: aggressive sprint or flying karate kick!
          if (Math.random() < 0.36 && f.y >= FLOOR_Y - 2) {
            startMove(f, Math.random() < 0.6 ? 'jumpkick' : 'axekick', s);
          } else {
            startMove(f, 'dash', s);
          }
        }
      } else if (f.move === 'walk') {
        f.vx = f.facing * (dist > 90 ? 270 : 120);
      }
    }

    // Physics integration
    f.x += f.vx * dt;
    if (f.move !== 'walk' && f.move !== 'dash') {
      f.vx *= Math.pow(0.05, dt);
    }
    if (f.y < FLOOR_Y || f.vy !== 0) {
      f.vy += 1260 * dt;
      f.y += f.vy * dt;
      if (f.y >= FLOOR_Y) {
        f.y = FLOOR_Y;
        f.vy = 0;
        f.juggleHits = 0;
        f.squashY = 0.8;
        spawnDustCloud(s, f.x, FLOOR_Y, 4);
        if (f.move === 'jump' || f.move === 'hitstun') f.move = 'idle';
      }
    }
    f.x = Math.max(s.stageMinX, Math.min(s.stageMaxX, f.x));
  }

  // 2.5D Fighter pushbox separation (respects depth lanes so crowds spread visibly)
  for (let i = 0; i < s.fighters.length; i++) {
    for (let j = i + 1; j < s.fighters.length; j++) {
      const a = s.fighters[i];
      const b = s.fighters[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dz = Math.abs(a.depthOffsetY - b.depthOffsetY);
      if (Math.abs(dx) < 42 && dz < 28 && Math.abs(a.y - b.y) < 64) {
        const push = (42 - Math.abs(dx)) * 0.5 * (dx >= 0 ? 1 : -1);
        a.x = Math.max(s.stageMinX, Math.min(s.stageMaxX, a.x - push));
        b.x = Math.max(s.stageMinX, Math.min(s.stageMaxX, b.x + push));
      }
    }
  }

  // Hitbox collision resolution
  for (const attacker of s.fighters) {
    if (attacker.hp <= 0 || attacker.hasHitCurrMove) continue;
    const spec = getMoveSpec(attacker.move);
    if (!spec) continue;
    if (attacker.moveTimer < spec.activeStart || attacker.moveTimer > spec.activeEnd) continue;

    for (const def of s.fighters) {
      if (def.slot === attacker.slot || def.hp <= 0) continue;
      const dx = def.x - attacker.x;
      const inFront = attacker.facing === 1 ? dx >= -18 && dx <= spec.reach : dx <= 18 && dx >= -spec.reach;
      const verticalOverlap = Math.abs(def.y - attacker.y) < 110;
      const laneOverlap = s.fighters.length <= 6 || Math.abs(def.depthOffsetY - attacker.depthOffsetY) < 52;
      if (!inFront || !verticalOverlap || !laneOverlap) continue;

      attacker.hasHitCurrMove = true;
      const isBlocking = def.move === 'guard' && !spec.unblockable && attacker.move !== 'lowkick';
      const isAirborne = def.y < FLOOR_Y - 12;
      const isCounterHit = isAttackMove(def.move) && !def.hasHitCurrMove;
      const impactX = (attacker.x + def.x) * 0.5;
      const impactY = def.y + spec.hitHeightOffset;

      if (isBlocking) {
        const chip = Math.max(1, Math.round(spec.dmg * 0.16));
        def.hp = Math.max(1, def.hp - chip);
        def.vx = attacker.facing * (spec.knock * 0.45);
        soundEngine.playMartialBlock();
        if (s.rings.length < 18) {
          s.rings.push({
            x: impactX,
            y: impactY,
            r: 8,
            maxR: 34,
            color: '#38BDF8',
            life: 0,
            maxLife: 0.22,
          });
        }
        if (s.sparks.length < 95) {
          for (let k = 0; k < 8; k++) {
            s.sparks.push({
              x: impactX,
              y: impactY,
              vx: (Math.random() - 0.5) * 260,
              vy: (Math.random() - 0.5) * 240,
              r: 4,
              color: '#38BDF8',
              life: 0,
              maxLife: 0.24,
            });
          }
        }
        s.banners.push({ x: def.x, y: def.y - 144, text: 'BLOCK!', color: '#38BDF8', life: 0 });
      } else {
        const dmgMult = isCounterHit ? 1.25 : isAirborne ? 0.85 : 1;
        const crowdPace = s.fighters.length > 20 ? 1.18 : 1;
        const finalDmg = Math.max(2, Math.round(spec.dmg * dmgMult * crowdPace));
        def.hp = Math.max(0, def.hp - finalDmg);
        def.move = def.hp <= 0 ? 'knockdown' : 'hitstun';
        def.hitstunTimer = spec.heavy ? 0.34 : 0.22;
        def.vx = attacker.facing * spec.knock;
        def.squashY = 1.15;

        if (spec.launchVy !== 0) {
          def.vy = spec.launchVy;
        } else if (isAirborne) {
          def.vy = -220;
          def.juggleHits += 1;
        } else if (def.hp <= 0) {
          def.vy = -270;
        }

        attacker.comboCount += 1;
        attacker.comboResetTimer = 1.75;
        s.hitStopTimer = s.fighters.length > 12 ? 0.015 : spec.heavy ? 0.05 : 0.025;
        s.shakeTimer = spec.heavy ? 0.18 : 0.08;
        soundEngine.playMartialHit(spec.heavy);

        const sparkColors =
          attacker.move === 'rage'
            ? ['#F43F5E', '#FACC15', '#FFFFFF']
            : isCounterHit
              ? ['#F97316', '#FEF08A', '#FFFFFF']
              : ['#FACC15', '#FB923C', '#FFFFFF'];

        if (s.rings.length < 18) {
          s.rings.push({
            x: impactX,
            y: impactY,
            r: 10,
            maxR: spec.heavy ? 66 : 42,
            color: sparkColors[0],
            life: 0,
            maxLife: spec.heavy ? 0.28 : 0.2,
          });
        }

        if (s.sparks.length < 95) {
          const count = spec.heavy ? 16 : 10;
          for (let k = 0; k < count; k++) {
            const ang = (k / count) * Math.PI * 2 + Math.random() * 0.25;
            const spd = 120 + Math.random() * 290;
            s.sparks.push({
              x: impactX,
              y: impactY,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              r: spec.heavy ? 5.8 : 4,
              color: sparkColors[k % sparkColors.length],
              life: 0,
              maxLife: 0.22 + Math.random() * 0.14,
              isStarburst: k % 3 === 0,
            });
          }
        }

        if (attacker.move === 'throw') {
          s.banners.push({ x: def.x, y: def.y - 148, text: 'THROW!', color: '#C084FC', life: 0 });
        } else if (attacker.move === 'jumpkick') {
          s.banners.push({ x: attacker.x, y: attacker.y - 160, text: 'FLYING KICK!', color: '#38BDF8', life: 0 });
        } else if (isCounterHit) {
          s.banners.push({ x: attacker.x, y: attacker.y - 160, text: 'COUNTER HIT!', color: '#FB923C', life: 0 });
        } else if (isAirborne && def.juggleHits >= 1) {
          s.banners.push({ x: attacker.x, y: attacker.y - 160, text: 'AIR COMBO!', color: '#38BDF8', life: 0 });
        } else if (attacker.comboCount >= 2) {
          s.banners.push({
            x: attacker.x,
            y: attacker.y - 150,
            text: `${attacker.comboCount} HIT COMBO!`,
            color: '#FDE047',
            life: 0,
          });
        }

        // Live Play-by-Play Elimination or Combo Commentary!
        const aliveNow = s.fighters.filter((f) => f.hp > 0);
        if (def.hp <= 0 && aliveNow.length >= 2 && s.elimCooldown <= 0) {
          s.elimCooldown = 3.2;
          s.commentaryTimer = 5.2;
          const atkName = getCountrySpokenName(attacker.country, spokenLang);
          const defName = getCountrySpokenName(def.country, spokenLang);
          const msg = buildFighterCommentary(
            'eliminate',
            spokenLang,
            s.roundNum,
            atkName,
            defName,
            aliveNow.length
          );
          s.liveCommentary = msg;
          soundEngine.speakText(msg, false, spokenLang, 'excited');
        } else if (
          (attacker.comboCount >= 3 || attacker.move === 'rage') &&
          s.comboSpeakCooldown <= 0 &&
          s.elimCooldown <= 1.2 &&
          aliveNow.length >= 2
        ) {
          s.comboSpeakCooldown = 5.5;
          s.commentaryTimer = 5.0;
          const atkName = getCountrySpokenName(attacker.country, spokenLang);
          const defName = getCountrySpokenName(def.country, spokenLang);
          const msg = buildFighterCommentary(
            'combo',
            spokenLang,
            s.roundNum,
            atkName,
            defName,
            aliveNow.length
          );
          s.liveCommentary = msg;
          soundEngine.speakText(msg, false, spokenLang, 'excited');
        }
      }
      break;
    }
  }

  // Ongoing Pace Play-by-Play Commentary so broadcast never goes silent
  const remaining = s.fighters.filter((f) => f.hp > 0);
  if (remaining.length >= 2 && s.roundTimer > 0 && s.commentaryTimer <= 0) {
    s.commentaryTimer = 5.8 + Math.random() * 1.6;
    const leaders = [...remaining].sort((a, b) => b.hp - a.hp);
    const topF = leaders[0];
    const rivF =
      leaders.find((o) => o.slot !== topF.slot && Math.abs(o.x - topF.x) < 260) ?? leaders[1];
    const msg = buildFighterCommentary(
      'pace',
      spokenLang,
      s.roundNum,
      getCountrySpokenName(topF.country, spokenLang),
      getCountrySpokenName(rivF.country, spokenLang),
      remaining.length
    );
    s.liveCommentary = msg;
    soundEngine.speakText(msg, false, spokenLang, 'excited');
  }

  // Round Win / K.O. / PERFECT / GREAT check
  if (remaining.length <= 1 || s.roundTimer <= 0) {
    const roundWinner =
      remaining.length === 1
        ? remaining[0]
        : [...s.fighters].sort((a, b) => b.hp - a.hp)[0];
    roundWinner.roundsWon += 1;
    s.roundWinnerSlot = roundWinner.slot;
    s.phase = 'ko';
    s.phaseTimer = 2.5;

    if (remaining.length <= 1) {
      if (roundWinner.hp >= roundWinner.maxHp) {
        s.bannerText = 'PERFECT!';
        s.bannerColor = '#FACC15';
      } else if (roundWinner.hp <= 36) {
        s.bannerText = 'GREAT!';
        s.bannerColor = '#38BDF8';
      } else {
        s.bannerText = 'K.O.!';
        s.bannerColor = '#F43F5E';
      }
    } else {
      s.bannerText = 'TIME OVER!';
      s.bannerColor = '#F43F5E';
    }

    s.hitStopTimer = 0.16;
    s.shakeTimer = 0.35;
    soundEngine.playKO();
    soundEngine.playCrowdCheer();

    const winSpoken = getCountrySpokenName(roundWinner.country, spokenLang);
    const customEv = soundEngine.customCommentary.customEventLine.trim();
    const koLine = customEv
      ? customEv.replace(/\{winner\}|\{leader\}|\{country\}/gi, winSpoken)
      : buildFighterCommentary('ko', spokenLang, s.roundNum, winSpoken, '', 1);
    s.liveCommentary = koLine;
    soundEngine.speakText(koLine, false, spokenLang, 'excited');
  }
}

function drawFighterCanvas(
  ctx: CanvasRenderingContext2D,
  s: FighterSimState,
  theme: FighterStageTheme,
  nowSec: number,
  canvasH: number = CANVAS_H
) {
  const skyOffset = Math.round((canvasH - CANVAS_H) * 0.42);
  drawStageBackdrop(ctx, s, theme, nowSec, skyOffset);

  ctx.save();
  const shakeX = s.shakeTimer > 0 ? (Math.random() - 0.5) * 11 : 0;
  const shakeY = s.shakeTimer > 0 ? (Math.random() - 0.5) * 9 : 0;
  ctx.translate(CANVAS_W / 2 + shakeX, FLOOR_Y + skyOffset + shakeY);
  ctx.scale(s.camZoom, s.camZoom);
  ctx.translate(-s.camX, -FLOOR_Y);

  drawPerspectiveFloor(ctx, s, theme, canvasH);

  // Motion-Blur Swing Trails
  for (const tr of s.trails) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - tr.life / tr.maxLife) * 0.75;
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Floor Dust Puffs
  for (const dp of s.dustPuffs) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, (1 - dp.life / dp.maxLife) * 0.45);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, dp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw ALL Fighters sorted by 2.5D depth — nobody ever hidden or culled out of frame!
  const drawOrder = [...s.fighters].sort((a, b) =>
    a.hp <= 0 ? -1 : b.hp <= 0 ? 1 : a.depthOffsetY - b.depthOffsetY || a.y - b.y
  );
  for (const f of drawOrder) {
    drawMartialArtist(ctx, f, nowSec);
  }

  // Expanding Tekken Shockwave Rings
  for (const rg of s.rings) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - rg.life / rg.maxLife);
    ctx.strokeStyle = rg.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Tekken Starburst & Ember Hit Sparks
  for (const sp of s.sparks) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - sp.life / sp.maxLife);
    ctx.fillStyle = sp.color;
    if (sp.isStarburst) {
      ctx.translate(sp.x, sp.y);
      ctx.rotate(Math.atan2(sp.vy, sp.vx));
      ctx.beginPath();
      ctx.moveTo(sp.r * 2.6, 0);
      ctx.lineTo(-sp.r, sp.r * 0.75);
      ctx.lineTo(-sp.r, -sp.r * 0.75);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Floating Combo / Block / Counter Callouts
  for (const b of s.banners) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - b.life / 1.25);
    ctx.font = 'italic 900 18px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(b.text, b.x, b.y);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, b.x, b.y);
    ctx.restore();
  }

  ctx.restore();

  // Top HUD for 2, 3, 4-12, or 13-64 Battle Royale Fighters
  drawTekkenHud(ctx, s, nowSec);

  // Center Arcade Overlay ("ROUND 1", "FIGHT!", "K.O.!", "GREAT!", "PERFECT!")
  if (s.bannerText && s.phase !== 'matchEnd') {
    ctx.save();
    ctx.font = 'italic 900 72px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#050814';
    ctx.strokeText(s.bannerText, CANVAS_W / 2, canvasH * 0.44);
    const grad = ctx.createLinearGradient(0, canvasH * 0.36, 0, canvasH * 0.52);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.5, s.bannerColor);
    grad.addColorStop(1, '#EA580C');
    ctx.fillStyle = grad;
    ctx.fillText(s.bannerText, CANVAS_W / 2, canvasH * 0.44);
    ctx.restore();
  }
}

function drawStageBackdrop(
  ctx: CanvasRenderingContext2D,
  s: FighterSimState,
  theme: FighterStageTheme,
  nowSec: number,
  skyOffset: number = 0
) {
  const skyBot = FLOOR_Y + skyOffset;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, skyBot);
  if (theme === 'shrine') {
    skyGrad.addColorStop(0, '#070A1E');
    skyGrad.addColorStop(0.55, '#1D1844');
    skyGrad.addColorStop(1, '#411F3E');
  } else if (theme === 'rooftop') {
    skyGrad.addColorStop(0, '#040917');
    skyGrad.addColorStop(0.6, '#0E2447');
    skyGrad.addColorStop(1, '#1E1B4B');
  } else {
    skyGrad.addColorStop(0, '#160B0F');
    skyGrad.addColorStop(0.6, '#321519');
    skyGrad.addColorStop(1, '#4C221D');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, skyBot);

  ctx.save();
  if (skyOffset > 0) ctx.translate(0, skyOffset);

  // Subtle diagonal stadium spotlight beams
  ctx.save();
  ctx.fillStyle =
    theme === 'rooftop' ? 'rgba(56, 189, 248, 0.06)' : 'rgba(251, 191, 36, 0.06)';
  ctx.beginPath();
  ctx.moveTo(220, 0);
  ctx.lineTo(520, FLOOR_Y);
  ctx.lineTo(720, FLOOR_Y);
  ctx.lineTo(390, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1060, 0);
  ctx.lineTo(760, FLOOR_Y);
  ctx.lineTo(560, FLOOR_Y);
  ctx.lineTo(890, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Glowing Moon / Dojo Crest
  ctx.save();
  ctx.fillStyle =
    theme === 'rooftop' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(251, 191, 36, 0.18)';
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, 182, 138, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme === 'rooftop' ? '#7DD3FC' : '#FDE68A';
  ctx.beginPath();
  ctx.arc(CANVAS_W / 2, 182, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Parallax backdrop spanning full 1280px stage width
  const midStage = (s.stageMinX + s.stageMaxX) * 0.5;
  const parRaw = -((s.camX - midStage) * 0.25);
  const tileW = 1280;
  const parShift = ((parRaw % tileW) + tileW) % tileW;

  for (let rep = -1; rep <= 1; rep++) {
    const ox = parShift + rep * tileW;
    if (ox > CANVAS_W + 20 || ox + tileW < -20) continue;

    if (theme === 'shrine') {
      ctx.fillStyle = '#0F0B1A';
      ctx.fillRect(ox + 495, 165, 26, 330);
      ctx.fillRect(ox + 759, 165, 26, 330);
      ctx.fillRect(ox + 430, 156, 420, 24);
      ctx.fillRect(ox + 465, 206, 350, 16);
      [260, 1020].forEach((lx, i) => {
        const sway = Math.sin(nowSec * 1.8 + i) * 4;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + lx, 0);
        ctx.lineTo(ox + lx + sway, 130);
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.ellipse(ox + lx + sway, 150, 15, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.ellipse(ox + lx + sway, 150, 8, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (theme === 'rooftop') {
      const heights = [140, 215, 175, 260, 190, 235, 160, 225, 175, 205];
      heights.forEach((h, idx) => {
        const bx = ox + idx * 128 + 10;
        ctx.fillStyle = '#081226';
        ctx.fillRect(bx, FLOOR_Y - h - 40, 102, h + 40);
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(34, 211, 238, 0.35)' : 'rgba(250, 204, 21, 0.32)';
        for (let wy = FLOOR_Y - h - 10; wy < FLOOR_Y - 60; wy += 26) {
          ctx.fillRect(bx + 18, wy, 18, 12);
          ctx.fillRect(bx + 62, wy, 18, 12);
        }
      });
    } else {
      ctx.fillStyle = '#1E110E';
      [180, 450, 830, 1100].forEach((px) => {
        ctx.fillRect(ox + px - 16, 75, 32, FLOOR_Y - 75);
      });
      ctx.fillStyle = '#7F1D1D';
      ctx.fillRect(ox + 290, 96, 48, 135);
      ctx.fillRect(ox + 942, 96, 48, 135);
    }
  }

  // Cheering Arena Spectators behind Deep Dojo Rail
  ctx.fillStyle = '#090B14';
  ctx.fillRect(0, FLOOR_Y - 140, CANVAS_W, 38);
  for (let i = 0; i < 46; i++) {
    const cx = 18 + i * 28;
    const bounce = Math.abs(Math.sin(nowSec * 5 + i * 0.9)) * 4;
    ctx.fillStyle = i % 3 === 0 ? '#1E293B' : '#111827';
    ctx.beginPath();
    ctx.arc(cx, FLOOR_Y - 122 - bounce, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, FLOOR_Y - 134 - bounce, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const d of s.dust) {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = theme === 'rooftop' ? '#7DD3FC' : '#FDE68A';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPerspectiveFloor(
  ctx: CanvasRenderingContext2D,
  s: FighterSimState,
  theme: FighterStageTheme,
  canvasH: number = CANVAS_H
) {
  const floorLeft = s.stageMinX - 800;
  const floorRight = s.stageMaxX + 800;
  const floorTop = FLOOR_Y - 122;
  const floorBot = FLOOR_Y + (canvasH > CANVAS_H ? 420 : 215);
  const grad = ctx.createLinearGradient(0, floorTop, 0, floorBot);
  if (theme === 'shrine') {
    grad.addColorStop(0, '#2B223F');
    grad.addColorStop(1, '#100C1C');
  } else if (theme === 'rooftop') {
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(1, '#090F1D');
  } else {
    grad.addColorStop(0, '#5B3420');
    grad.addColorStop(1, '#26140A');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(floorLeft, floorTop, floorRight - floorLeft, floorBot - floorTop);

  ctx.strokeStyle =
    theme === 'rooftop' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.6;
  const halfSpan = (CANVAS_W * 0.5) / Math.max(0.16, s.camZoom) + 360;
  const visLeft = Math.floor((s.camX - halfSpan) / 85) * 85;
  const visRight = Math.ceil((s.camX + halfSpan) / 85) * 85;
  for (let gx = visLeft; gx <= visRight; gx += 85) {
    ctx.beginPath();
    ctx.moveTo(s.camX + (gx - s.camX) * 0.58, floorTop);
    ctx.lineTo(gx, floorBot);
    ctx.stroke();
  }
  const hLines =
    canvasH > CANVAS_H
      ? [floorTop + 42, floorTop + 96, floorTop + 154, floorTop + 214, floorTop + 286, floorTop + 364]
      : [floorTop + 42, floorTop + 96, floorTop + 154, floorTop + 214];
  hLines.forEach((hy) => {
    ctx.beginPath();
    ctx.moveTo(floorLeft, hy);
    ctx.lineTo(floorRight, hy);
    ctx.stroke();
  });

  ctx.strokeStyle = theme === 'rooftop' ? '#22D3EE' : '#F59E0B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(floorLeft, floorTop);
  ctx.lineTo(floorRight, floorTop);
  ctx.stroke();

  // Glowing Ring Boundary Pillars at Left & Right Ends of the Fighting Ground
  [s.stageMinX - 24, s.stageMaxX + 24].forEach((edgeX) => {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(edgeX - 8, FLOOR_Y - 220, 16, 300);
    ctx.fillStyle = theme === 'rooftop' ? '#22D3EE' : '#F59E0B';
    ctx.fillRect(edgeX - 3, FLOOR_Y - 215, 6, 290);
  });
}

function drawLimbSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
  outline = '#0B1120'
) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 4;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawMartialArtist(ctx: CanvasRenderingContext2D, f: FighterEntity, nowSec: number) {
  const isKO = f.move === 'knockdown' || f.hp <= 0;
  const p = f.moveDuration > 0 ? Math.min(1, f.moveTimer / f.moveDuration) : 0;
  const airRatio = Math.max(0.3, Math.min(1, 1 - (FLOOR_Y - f.y) / 260));
  const stanceBob = isKO ? 0 : Math.abs(Math.sin(nowSec * 9.5 + f.slot * 2.1)) * 4.5;
  const crouchDrop = f.move === 'lowkick' ? 14 : f.move === 'guard' ? 8 : stanceBob;
  const beltFlutter = Math.sin(nowSec * 14 + f.slot) * (f.move === 'dash' ? 10 : 5);

  // Ground Shadow scales naturally with jump height and sprite scale!
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.52 * airRatio})`;
  ctx.beginPath();
  ctx.ellipse(
    f.x,
    FLOOR_Y + f.depthOffsetY + 9 * f.spriteScale,
    (isKO ? 54 : 34) * airRatio * f.spriteScale,
    9 * airRatio * f.spriteScale,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(f.x, f.y + f.depthOffsetY);
  ctx.scale(f.spriteScale, f.spriteScale);

  // Rage Aura
  if (!isKO && f.hp <= RAGE_THRESHOLD) {
    ctx.save();
    ctx.globalAlpha = 0.24 + Math.sin(nowSec * 15) * 0.12;
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.ellipse(0, -60, 42, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.scale(f.facing, f.squashY);

  // Dynamic Martial Arts Body Tilt per action
  let bodyTilt = 0.08; // Fighting stance forward lean!
  if (isKO) {
    ctx.rotate(-Math.PI * 0.46);
    ctx.translate(22, 16);
    bodyTilt = 0;
  } else if (f.move === 'hitstun') {
    bodyTilt = -0.32;
  } else if (f.move === 'dash') {
    bodyTilt = 0.36;
  } else if (f.move === 'backdash') {
    bodyTilt = -0.22;
  } else if (f.move === 'jumpkick') {
    bodyTilt = -0.34;
  } else if (f.move === 'axekick') {
    bodyTilt = 0.24;
  } else if (f.move === 'spinkick') {
    const spinScale = Math.cos(p * Math.PI * 2);
    ctx.scale(Math.abs(spinScale) < 0.26 ? 0.26 : spinScale, 1);
    bodyTilt = -0.18;
  } else if (f.move === 'victory') {
    bodyTilt = 0;
  }

  // Articulated Hip, Knee & Foot Coordinates
  const hipX = 0;
  const hipY = -44 + crouchDrop;
  const stride =
    f.move === 'dash'
      ? Math.sin(f.stridePhase) * 24
      : f.move === 'walk'
        ? Math.sin(f.stridePhase) * 16
        : 0;

  let backKneeX = -15 - stride * 0.6;
  let backKneeY = -22 + crouchDrop * 0.4;
  let backFootX = -22 - stride;
  let backFootY = -3;

  let frontKneeX = 18 + stride * 0.6;
  let frontKneeY = -24 + crouchDrop * 0.4;
  let frontFootX = 20 + stride;
  let frontFootY = -3;

  const peak = Math.sin(p * Math.PI);
  if (f.move === 'lowkick') {
    frontKneeX = 24 + peak * 24;
    frontKneeY = -26 + peak * 10;
    frontFootX = 28 + peak * 48;
    frontFootY = -6;
  } else if (f.move === 'highkick') {
    frontKneeX = 20 + peak * 22;
    frontKneeY = -46 - peak * 20;
    frontFootX = 24 + peak * 56;
    frontFootY = -52 - peak * 46;
  } else if (f.move === 'spinkick') {
    frontKneeX = 22 + peak * 24;
    frontKneeY = -44 - peak * 14;
    frontFootX = 26 + peak * 60;
    frontFootY = -48 - peak * 40;
  } else if (f.move === 'jumpkick') {
    // Classic Flying Side-Kick Pose in Mid-Air!
    backKneeX = -18;
    backKneeY = -28;
    backFootX = -8;
    backFootY = -12;
    frontKneeX = 28;
    frontKneeY = -44;
    frontFootX = 64;
    frontFootY = -46;
  } else if (f.move === 'axekick') {
    const swing = p * Math.PI;
    frontKneeX = 26;
    frontKneeY = -58 + Math.sin(swing) * 20;
    frontFootX = 46;
    frontFootY = -92 + p * 74;
  } else if (f.move === 'jump') {
    backKneeX = -16;
    backKneeY = -26;
    backFootX = -22;
    backFootY = -8;
    frontKneeX = 18;
    frontKneeY = -32;
    frontFootX = 14;
    frontFootY = -12;
  }

  // Draw Rear Leg (2-segment: Thigh -> Knee -> Shin -> Foot)
  drawLimbSegment(ctx, hipX - 5, hipY, backKneeX, backKneeY, 13, f.primaryColor);
  drawLimbSegment(ctx, backKneeX, backKneeY, backFootX, backFootY, 11, f.primaryColor);
  ctx.fillStyle = f.skinTone;
  ctx.fillRect(backFootX - 6, backFootY - 3, 14, 6);

  // Draw Front Leg (2-segment + shin wrap)
  drawLimbSegment(ctx, hipX + 5, hipY, frontKneeX, frontKneeY, 13, f.primaryColor);
  drawLimbSegment(ctx, frontKneeX, frontKneeY, frontFootX, frontFootY, 11, f.primaryColor);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(frontFootX - 7, frontFootY - 7, 10, 5);
  ctx.fillStyle = f.skinTone;
  ctx.fillRect(frontFootX - 5, frontFootY - 3, 14, 6);

  // Rotate Upper Torso + Head + Arms by dynamic karate lean
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(bodyTilt);

  // Muscular Karate Gi Torso
  ctx.fillStyle = f.primaryColor;
  ctx.strokeStyle = '#0B1120';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-24, -48);
  ctx.lineTo(24, -48);
  ctx.lineTo(18, 0);
  ctx.lineTo(-18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Open V-Neck Chest + Accent Gi Lapels
  ctx.fillStyle = f.skinTone;
  ctx.beginPath();
  ctx.moveTo(-8, -48);
  ctx.lineTo(8, -48);
  ctx.lineTo(1, -22);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = f.accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-9, -48);
  ctx.lineTo(1, -20);
  ctx.lineTo(10, -48);
  ctx.stroke();

  // Black Martial Arts Belt + Dynamic Streaming Tails
  ctx.fillStyle = '#09090B';
  ctx.fillRect(-19, -8, 38, 8);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(-1, -8, 7, 8);
  ctx.strokeStyle = '#09090B';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-12 - beltFlutter * 0.6, 18);
  ctx.moveTo(4, 0);
  ctx.lineTo(10 + beltFlutter * 0.5, 16);
  ctx.stroke();

  // Head + Spiky Hair + Country Headband + Streaming Headband Tails
  ctx.fillStyle = f.skinTone;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(2, -65, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = f.hairColor;
  ctx.beginPath();
  ctx.moveTo(-12, -68);
  ctx.lineTo(-10, -82);
  ctx.lineTo(-2, -77);
  ctx.lineTo(4, -85);
  ctx.lineTo(11, -78);
  ctx.lineTo(17, -80);
  ctx.lineTo(15, -68);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = f.accentColor;
  ctx.fillRect(-13, -71, 30, 5.5);
  ctx.strokeStyle = f.primaryColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-13, -68);
  ctx.lineTo(-28, -64 + beltFlutter * 0.6);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(8, -66, 5, 2.5);

  // Articulated 2-Segment Arms (Shoulder -> Elbow -> Forearm -> Taped Fist)
  const armRun = f.move === 'dash' ? Math.sin(f.stridePhase) * 16 : f.move === 'walk' ? Math.sin(f.stridePhase) * 8 : 0;

  // Rear Guard Arm
  let rElbowX = -14 - armRun * 0.4;
  let rElbowY = -24;
  let rFistX = 8 - armRun * 0.6;
  let rFistY = -40;
  if (f.move === 'guard') {
    rElbowX = 14;
    rElbowY = -36;
    rFistX = 18;
    rFistY = -58;
  } else if (f.move === 'victory') {
    rElbowX = -22;
    rElbowY = -58;
    rFistX = -18;
    rFistY = -82;
  }
  drawLimbSegment(ctx, -14, -40, rElbowX, rElbowY, 9.5, f.skinTone);
  drawLimbSegment(ctx, rElbowX, rElbowY, rFistX, rFistY, 8.5, f.skinTone);
  ctx.fillStyle = f.accentColor;
  ctx.beginPath();
  ctx.arc(rFistX, rFistY, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Lead Striking Arm
  let lElbowX = 16 + armRun * 0.5;
  let lElbowY = -28;
  let lFistX = 30 + armRun * 0.7;
  let lFistY = -44;
  if (f.move === 'jab' || f.move === 'cross' || f.move === 'rage' || f.move === 'throw') {
    const ext = peak * (f.move === 'rage' ? 54 : f.move === 'throw' ? 38 : 44);
    lElbowX = 24 + ext * 0.45;
    lElbowY = -39;
    lFistX = 34 + ext;
    lFistY = -40;
  } else if (f.move === 'uppercut') {
    lElbowX = 24 + peak * 14;
    lElbowY = -38 - peak * 20;
    lFistX = 32 + peak * 24;
    lFistY = -42 - peak * 46;
  } else if (f.move === 'guard') {
    lElbowX = 18;
    lElbowY = -34;
    lFistX = 22;
    lFistY = -54;
  } else if (f.move === 'victory') {
    lElbowX = 22;
    lElbowY = -58;
    lFistX = 18;
    lFistY = -84;
  }
  drawLimbSegment(ctx, 14, -40, lElbowX, lElbowY, 10, f.skinTone);
  drawLimbSegment(ctx, lElbowX, lElbowY, lFistX, lFistY, 9, f.skinTone);
  ctx.fillStyle = f.accentColor;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(lFistX, lFistY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (f.move === 'guard') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(20, -40, 26, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
  }

  ctx.restore(); // end torso rotation
  ctx.restore(); // end facing/squash

  // Crisp Waving Rectangular Country Flag + Clear Country Label Right Above Fighter's Head
  const flagTopY = (isKO ? -64 : -162) + crouchDrop;
  const rectFlag = getRectFlagBitmap(f.country.code);
  const fW = 30;
  const fH = 19;
  const slices = 5;
  const sSrc = rectFlag.width / slices;
  const sDst = fW / slices;

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-fW / 2, flagTopY + fH + 6);
  ctx.lineTo(-fW / 2, flagTopY);
  ctx.stroke();

  for (let sl = 0; sl < slices; sl++) {
    const wy = Math.sin(f.wavePhase + sl * 0.85) * (sl * 0.48);
    ctx.drawImage(
      rectFlag,
      sl * sSrc,
      0,
      sSrc,
      rectFlag.height,
      -fW / 2 + sl * sDst,
      flagTopY + wy,
      sDst + 0.5,
      fH
    );
  }

  ctx.font = '900 12px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(5, 8, 20, 0.98)';
  ctx.lineWidth = 3.5;
  ctx.strokeText(f.country.name, 0, flagTopY - 6);
  ctx.fillStyle = f.slot === 0 ? '#FDE047' : '#F8FAFC';
  ctx.fillText(f.country.name, 0, flagTopY - 6);

  ctx.restore();
}

function drawTekkenHud(ctx: CanvasRenderingContext2D, s: FighterSimState, nowSec: number) {
  const count = s.fighters.length;
  const clockText = String(Math.ceil(s.roundTimer)).padStart(2, '0');

  if (count === 2) {
    drawSingleTekkenBar(ctx, s.fighters[0], 40, 22, 376, true, nowSec);
    drawSingleTekkenBar(ctx, s.fighters[1], CANVAS_W - 40 - 376, 22, 376, false, nowSec);

    ctx.save();
    ctx.fillStyle = '#090F24';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - 34, 14, 68, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 28px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.roundTimer <= 15 ? '#F43F5E' : '#FDE047';
    ctx.fillText(clockText, CANVAS_W / 2, 39);
    ctx.restore();
  } else if (count === 3) {
    const barW = 266;
    const gap = 22;
    const startX = (CANVAS_W - (barW * 3 + gap * 2)) / 2;
    s.fighters.forEach((f, idx) => {
      drawSingleTekkenBar(ctx, f, startX + idx * (barW + gap), 18, barW, true, nowSec);
    });

    ctx.save();
    ctx.fillStyle = 'rgba(9, 15, 36, 0.92)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - 30, 74, 60, 32, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(clockText, CANVAS_W / 2, 91);
    ctx.restore();
  } else if (count <= 12) {
    // 4-12 Battle Royale Fighter Grid HUD + Top Center Timer
    const cols = Math.min(4, count);
    const cardW = 198;
    const gap = 12;
    const startX = (CANVAS_W - (cols * cardW + (cols - 1) * gap)) / 2;
    s.fighters.forEach((f, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (cardW + gap);
      const y = 14 + row * 36;
      const hpPct = Math.max(0, Math.min(1, f.hp / f.maxHp));
      const rectFlag = getRectFlagBitmap(f.country.code);

      ctx.save();
      ctx.fillStyle = 'rgba(9, 15, 36, 0.9)';
      ctx.strokeStyle = f.hp > 0 ? '#334155' : '#450A0A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, 28, 6);
      ctx.fill();
      ctx.stroke();

      ctx.drawImage(rectFlag, x + 5, y + 6, 24, 16);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(x + 34, y + 16, cardW - 42, 7);
      ctx.fillStyle = hpPct > 0.35 ? '#FACC15' : '#F43F5E';
      ctx.fillRect(x + 34, y + 16, (cardW - 42) * hpPct, 7);

      ctx.font = '800 10px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = f.hp > 0 ? '#F8FAFC' : '#64748B';
      ctx.fillText(f.country.name.toUpperCase(), x + 34, y + 12);

      // Round orbs
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        ctx.arc(x + cardW - 10 - r * 11, y + 9, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = r < f.roundsWon ? '#FACC15' : '#1E293B';
        ctx.fill();
      }
      ctx.restore();
    });
  } else {
    // 13-64 Massive Battle Royale HUD: Alive Counter, Focused Duelists, Timer & Arena Radar Strip!
    const alive = s.fighters.filter((f) => f.hp > 0);
    const focus = alive.find((f) => f.slot === s.focusSlot) ?? alive[0];
    const inFocusPair = focus
      ? [
          focus,
          ...alive
            .filter((f) => f.slot !== focus.slot)
            .sort((a, b) => Math.abs(a.x - focus.x) - Math.abs(b.x - focus.x))
            .slice(0, 2),
        ]
      : [];

    ctx.save();
    // Left Alive Badge
    ctx.fillStyle = 'rgba(9, 15, 36, 0.92)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(24, 10, 146, 34, 7);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`ALIVE  ${alive.length} / ${count}`, 97, 27);

    // Center Timer Box
    ctx.fillStyle = '#090F24';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CANVAS_W / 2 - 30, 8, 60, 36, 7);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.fillStyle = s.roundTimer <= 15 ? '#F43F5E' : '#FDE047';
    ctx.fillText(clockText, CANVAS_W / 2, 27);

    // Top 2-3 Focused Duelists Mini Bars on Right
    inFocusPair.slice(0, 3).forEach((df, idx) => {
      const bx = CANVAS_W - 24 - (3 - idx) * 126 + 6;
      const bw = 120;
      const by = 10;
      const hpPct = Math.max(0, Math.min(1, df.hp / df.maxHp));
      const rectFlag = getRectFlagBitmap(df.country.code);
      ctx.fillStyle = 'rgba(9, 15, 36, 0.92)';
      ctx.strokeStyle = idx === 0 ? '#38BDF8' : '#334155';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 34, 6);
      ctx.fill();
      ctx.stroke();

      ctx.drawImage(rectFlag, bx + 5, by + 6, 20, 14);
      ctx.font = '800 10px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(df.country.code, bx + 29, by + 16);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bx + 5, by + 23, bw - 10, 6);
      ctx.fillStyle = hpPct > 0.35 ? '#22C55E' : '#F43F5E';
      ctx.fillRect(bx + 5, by + 23, (bw - 10) * hpPct, 6);
    });

    // Full Ground Radar Minimap Bar with Camera Focus Bracket
    const barX = 24;
    const barY = 50;
    const barW = CANVAS_W - 48;
    const barH = 18;
    ctx.fillStyle = 'rgba(6, 10, 26, 0.88)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();
    ctx.stroke();

    const span = Math.max(1, s.stageMaxX - s.stageMinX);
    for (const f of s.fighters) {
      const rx = barX + 6 + ((f.x - s.stageMinX) / span) * (barW - 12);
      if (f.hp <= 0) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
        ctx.fillRect(rx - 1, barY + barH - 5, 2, 3);
      } else {
        ctx.fillStyle = f.slot === s.focusSlot ? '#FDE047' : f.primaryColor;
        ctx.beginPath();
        ctx.arc(rx, barY + barH / 2, f.slot === s.focusSlot ? 3.8 : 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const visHalf = (CANVAS_W * 0.5) / Math.max(0.16, s.camZoom);
    const camLeft = Math.max(s.stageMinX, s.camX - visHalf);
    const camRight = Math.min(s.stageMaxX, s.camX + visHalf);
    const vx1 = barX + 4 + ((camLeft - s.stageMinX) / span) * (barW - 8);
    const vx2 = barX + 4 + ((camRight - s.stageMinX) / span) * (barW - 8);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(vx1, barY + 1.5, Math.max(14, vx2 - vx1), barH - 3);
    ctx.restore();
  }
}

function drawSingleTekkenBar(
  ctx: CanvasRenderingContext2D,
  f: FighterEntity,
  x: number,
  y: number,
  w: number,
  leftAlign: boolean,
  nowSec: number
) {
  const h = 22;
  const skew = leftAlign ? -10 : 10;
  const hpPct = Math.max(0, Math.min(1, f.hp / f.maxHp));
  const trailPct = Math.max(hpPct, Math.min(1, f.trailHp / f.maxHp));
  const isRage = f.hp > 0 && f.hp <= RAGE_THRESHOLD;

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w - skew, y + h);
  ctx.lineTo(x - skew, y + h);
  ctx.closePath();
  ctx.fillStyle = '#090F24';
  ctx.fill();
  ctx.strokeStyle = isRage && Math.sin(nowSec * 14) > 0 ? '#F43F5E' : '#E2E8F0';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 2 + skew * 0.85, y + 2);
  ctx.lineTo(x + w - 2 + skew * 0.85, y + 2);
  ctx.lineTo(x + w - 2 - skew * 0.85, y + h - 2);
  ctx.lineTo(x + 2 - skew * 0.85, y + h - 2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#DC2626';
  const trailW = (w - 4) * trailPct;
  ctx.fillRect(leftAlign ? x + w - 2 - trailW : x + 2, y + 2, trailW, h - 4);

  const hpGrad = ctx.createLinearGradient(x, y, x + w, y);
  if (isRage) {
    hpGrad.addColorStop(0, '#EF4444');
    hpGrad.addColorStop(1, '#FACC15');
  } else if (leftAlign) {
    hpGrad.addColorStop(0, '#22C55E');
    hpGrad.addColorStop(0.55, '#FACC15');
    hpGrad.addColorStop(1, '#FDE047');
  } else {
    hpGrad.addColorStop(0, '#FDE047');
    hpGrad.addColorStop(0.45, '#FACC15');
    hpGrad.addColorStop(1, '#22C55E');
  }
  ctx.fillStyle = hpGrad;
  const hpW = (w - 4) * hpPct;
  ctx.fillRect(leftAlign ? x + w - 2 - hpW : x + 2, y + 2, hpW, h - 4);
  ctx.restore();

  const rectFlag = getRectFlagBitmap(f.country.code);
  const flagX = leftAlign ? x : x + w - 28;
  ctx.drawImage(rectFlag, flagX, y + h + 7, 28, 18);

  ctx.font = '800 13px "Outfit", sans-serif';
  ctx.textAlign = leftAlign ? 'left' : 'right';
  ctx.strokeStyle = '#050814';
  ctx.lineWidth = 3;
  const labelX = leftAlign ? x + 34 : x + w - 34;
  ctx.strokeText(f.country.name.toUpperCase(), labelX, y + h + 20);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText(f.country.name.toUpperCase(), labelX, y + h + 20);

  for (let r = 0; r < 2; r++) {
    const ox = leftAlign ? x + w - 10 - r * 18 : x + 10 + r * 18;
    const oy = y + h + 16;
    ctx.beginPath();
    ctx.arc(ox, oy, 6, 0, Math.PI * 2);
    ctx.fillStyle = r < f.roundsWon ? '#FACC15' : '#1E293B';
    ctx.fill();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}
