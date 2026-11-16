import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Menu, Search, Trophy, Volume2 } from 'lucide-react';
import { COUNTRIES, CountryDef } from '../data/countries';
import {
  buildRaceCommentary,
  CommentaryLanguage,
  getCountrySpokenName,
  getCountdownSpeech,
  resolveSpokenLanguage,
} from '../data/raceCommentary';
import { getRectFlagBitmap } from '../utils/flagRenderer';
import { soundEngine } from '../utils/sound';
import { FlagBadge } from './FlagBadge';
import { HeaderStatBox } from './HeaderStatBox';
import { VictoryConfetti } from './VictoryConfetti';

type BiomeType = 'city' | 'forest' | 'rail';

interface TrackSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  curvature: number;
  dist: number;
  biome: BiomeType;
  zoneName: string;
}

interface Spectator {
  row: number;
  col: number;
  shirt: string;
  flagColor: string;
  phase: number;
  hasFlag: boolean;
}

interface Grandstand {
  x: number;
  y: number;
  angle: number;
  width: number;
  depth: number;
  lapDistCenter: number;
  spectators: Spectator[];
}

interface SceneryProp {
  x: number;
  y: number;
  angle: number;
  kind: 'building' | 'tree' | 'lamp';
  w: number;
  h: number;
  color: string;
  accent: string;
}

interface RailBridge {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  angle: number;
  lapDist: number;
  trainSpeed: number;
  trainPhase: number;
  trainColor: string;
}

type PitState = 'none' | 'entering' | 'pitting' | 'exiting';

interface RaceCar {
  id: string;
  country: CountryDef;
  totalDist: number;
  lane: number;
  laneTarget: number;
  speed: number;
  targetSpeed: number;
  kmh: number;
  surgeTimer: number;
  overtakes: number;
  lastRank: number;
  rankDelta: number;
  rankMoveTimer: number;
  wavePhase: number;
  tireAccent: string;
  tireWear: number;
  pitState: PitState;
  pitTimer: number;
  pitProgressTarget: number;
  willPit: boolean;
  pitBoxDist: number;
  hasPitted: boolean;
  pitStopsDone: number;
  finishedRank: number | null;
}

interface SpeedStreak {
  x: number;
  y: number;
  len: number;
  alpha: number;
}

interface ExhaustSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SpatialGrid {
  cellSize: number;
  standCells: Map<string, Grandstand[]>;
  propCells: Map<string, SceneryProp[]>;
}

interface RaceSimState {
  cars: RaceCar[];
  grandstands: Grandstand[];
  props: SceneryProp[];
  railBridges: RailBridge[];
  grid: SpatialGrid;
  sparks: ExhaustSpark[];
  streaks: SpeedStreak[];
  samples: TrackSample[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  lapLength: number;
  totalLaps: number;
  totalRaceDist: number;
  trackHalfWidth: number;
  pitEntryDist: number;
  pitExitDist: number;
  pitLaneOffset: number;
  pitBayWidth: number;
  elapsed: number;
  countdownTimer: number;
  lastCountdownStep: number;
  raceStarted: boolean;
  crowdExcitement: number;
  winner: RaceCar | null;
  finishOrder: RaceCar[];
  finishPhaseTimer: number;
  fireworkCooldown: number;
  allFinishedAt: number | null;
  showWinnerModal: boolean;
  announcedHalfway: boolean;
  announcedFinalLap: boolean;
  lastLeaderId: string | null;
  overtakeCooldown: number;
  commentaryTimer: number;
  liveCommentary: string;
  winReason: string;
  camX: number;
  camY: number;
  camZoom: number;
}

export interface RaceConfig {
  carCount: number;
  durationSec: number;
  duelA: string;
  duelB: string;
  cameraView: 'action' | 'full';
  customCodes: string[];
  useCustomRoster: boolean;
  commLang: CommentaryLanguage;
  preferredWinnerCode: string;
}

interface CountryCarRaceProps {
  config: RaceConfig;
  isPlaying: boolean;
  speedMultiplier: number;
  autoNextCycle: boolean;
  restartSignal: number;
  customModalOpen: boolean;
  isPortrait916?: boolean;
  onCloseCustomModal: () => void;
  onUpdateConfig: (patch: Partial<RaceConfig>) => void;
  onOpenMenu: () => void;
  onRecordWin?: (country: CountryDef) => void;
}

const CANVAS_W = 960;
const CANVAS_H = 540;
const PIP_W = 320;
const PIP_H = 180;
const BASE_CRUISE_SPEED = 940;

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function sortRaceCars(cars: RaceCar[]): RaceCar[] {
  return [...cars].sort((a, b) => {
    if (a.finishedRank !== null && b.finishedRank !== null) {
      return a.finishedRank - b.finishedRank;
    }
    if (a.finishedRank !== null) return -1;
    if (b.finishedRank !== null) return 1;
    return b.totalDist - a.totalDist;
  });
}

function spawnFinishFireworks(
  s: RaceSimState,
  originX: number,
  originY: number,
  palette: string[],
  burstCount: number
) {
  const colors = [...palette.filter(Boolean), '#FACC15', '#34D399', '#38BDF8', '#F43F5E'];
  for (let i = 0; i < burstCount; i++) {
    const ang = (i / burstCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const spd = 160 + Math.random() * 440;
    s.sparks.push({
      x: originX,
      y: originY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 3.8 + Math.random() * 4.4,
      color: colors[i % colors.length],
      life: 0,
      maxLife: 0.65 + Math.random() * 0.55,
    });
  }
}

function getBiomeForFraction(
  frac: number,
  durationMin: number
): { biome: BiomeType; zoneName: string } {
  // 1-2 minute tracks take place inside one sweeping Metro City!
  if (durationMin <= 2.2) {
    if (frac < 0.25) return { biome: 'city', zoneName: 'Capital Stadium' };
    if (frac < 0.52) return { biome: 'city', zoneName: 'Downtown Towers' };
    if (frac < 0.78) return { biome: 'city', zoneName: 'Harbor Boulevard' };
    return { biome: 'city', zoneName: 'Metro Finish' };
  }

  // 3-15 minute tracks cross multiple cities, deep forests, and railway underpasses!
  if (durationMin <= 5.5) {
    if (frac < 0.16) return { biome: 'city', zoneName: 'Capital City' };
    if (frac < 0.34) return { biome: 'forest', zoneName: 'Emerald Pine Forest' };
    if (frac < 0.38) return { biome: 'rail', zoneName: 'North Rail Underpass' };
    if (frac < 0.56) return { biome: 'city', zoneName: 'Northport City' };
    if (frac < 0.73) return { biome: 'forest', zoneName: 'Cedar Valley Woods' };
    if (frac < 0.77) return { biome: 'rail', zoneName: 'West Rail Underpass' };
    if (frac < 0.91) return { biome: 'city', zoneName: 'Riverdale City' };
    return { biome: 'city', zoneName: 'Capital Finish' };
  }

  // 6-15 minute Grand Country Tour across 5+ cities, deep forests, and 3 railway crossings
  const sector = Math.floor(frac * 12);
  switch (sector) {
    case 0:
      return { biome: 'city', zoneName: 'Capital City' };
    case 1:
      return { biome: 'forest', zoneName: 'Whispering Pines' };
    case 2:
      return { biome: 'city', zoneName: 'Silverport City' };
    case 3:
      return { biome: 'rail', zoneName: 'Central Rail Bridge' };
    case 4:
      return { biome: 'forest', zoneName: 'Highland Forest' };
    case 5:
      return { biome: 'city', zoneName: 'Grand Bay City' };
    case 6:
      return { biome: 'forest', zoneName: 'Oakridge Woods' };
    case 7:
      return { biome: 'rail', zoneName: 'Express Rail Crossing' };
    case 8:
      return { biome: 'city', zoneName: 'Skyline Metro' };
    case 9:
      return { biome: 'forest', zoneName: 'Redwood Canyon' };
    case 10:
      return { biome: 'rail', zoneName: 'South Rail Underpass' };
    default:
      return { biome: 'city', zoneName: 'Capital Finish' };
  }
}

// Guaranteed non-overlapping, time-proportional Grand Country Circuit (1 min -> 15 min)
function buildTimedCountryCircuit(
  durationSec: number,
  carCount = 2
): {
  samples: TrackSample[];
  lapLength: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
} {
  const durationMin = Math.max(1, Math.min(15, durationSec / 60));
  const fieldScale = 1 + Math.max(0, carCount - 4) * 0.018;
  const targetLength = durationSec * BASE_CRUISE_SPEED * fieldScale;
  const N = Math.min(3800, Math.max(960, Math.round(durationMin * 250 * Math.sqrt(fieldScale))));

  const freqA = Math.min(16, 4 + Math.round(durationMin));
  const freqB = Math.min(24, 7 + Math.round(durationMin * 1.4));

  const raw: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * Math.PI * 2;
    // Smooth start/finish straight flattening near theta=0 / 2PI
    const straightBlend = Math.exp(-Math.pow(Math.sin(theta * 0.5) * 3.8, 2));
    const mod =
      0.16 * Math.cos(3 * theta) +
      0.11 * Math.sin(freqA * theta) +
      0.07 * Math.cos(freqB * theta);
    const r = 1000 * (1 + mod * (1 - 0.72 * straightBlend));
    const x = r * Math.cos(theta) * 1.32;
    const y = r * Math.sin(theta) * 0.92;
    raw.push({ x, y });
  }

  let rawLen = 0;
  for (let i = 1; i <= N; i++) {
    const a = raw[i - 1];
    const b = raw[i % N];
    rawLen += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const scale = targetLength / (rawLen || 1);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const scaled = raw.map((p) => {
    const sx = p.x * scale;
    const sy = p.y * scale;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
    return { x: sx, y: sy };
  });

  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i <= N; i++) {
    const a = scaled[i - 1];
    const b = scaled[i % N];
    total += Math.hypot(b.x - a.x, b.y - a.y);
    cum.push(total);
  }

  const samples: TrackSample[] = [];
  for (let i = 0; i < N; i++) {
    const prev = scaled[(i - 1 + N) % N];
    const curr = scaled[i];
    const next = scaled[(i + 1) % N];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;

    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    const dAng = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));

    const frac = cum[i] / total;
    const { biome, zoneName } = getBiomeForFraction(frac, durationMin);

    samples.push({
      x: curr.x,
      y: curr.y,
      tx,
      ty,
      nx,
      ny,
      curvature: dAng,
      dist: cum[i],
      biome,
      zoneName,
    });
  }

  return {
    samples,
    lapLength: total,
    bounds: { minX, maxX, minY, maxY },
  };
}

function sampleCircuitAt(samples: TrackSample[], lapLength: number, distInput: number): TrackSample {
  let d = distInput % lapLength;
  if (d < 0) d += lapLength;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].dist <= d) lo = mid;
    else hi = mid - 1;
  }
  const s0 = samples[lo];
  const s1 = samples[(lo + 1) % samples.length];
  const segLen = (lo === samples.length - 1 ? lapLength : s1.dist) - s0.dist || 1;
  const f = Math.max(0, Math.min(1, (d - s0.dist) / segLen));

  const tx = s0.tx + (s1.tx - s0.tx) * f;
  const ty = s0.ty + (s1.ty - s0.ty) * f;
  const tLen = Math.hypot(tx, ty) || 1;
  const utx = tx / tLen;
  const uty = ty / tLen;

  return {
    x: s0.x + (s1.x - s0.x) * f,
    y: s0.y + (s1.y - s0.y) * f,
    tx: utx,
    ty: uty,
    nx: -uty,
    ny: utx,
    curvature: s0.curvature + (s1.curvature - s0.curvature) * f,
    dist: d,
    biome: s0.biome,
    zoneName: s0.zoneName,
  };
}

function getCarPalette(c: CountryDef): { body: string; accent: string } {
  const candidates = c.colors.filter(Boolean) as string[];
  let body = candidates[0] || '#38BDF8';
  for (const hex of candidates) {
    const l = hex.toLowerCase();
    if (l !== '#ffffff' && l !== '#f4f5f8' && l !== '#111111' && l !== '#141414') {
      body = hex;
      break;
    }
  }
  const accent = candidates.find((h) => h !== body) || '#F8FAFC';
  return { body, accent };
}

function buildWorldEnvironment(
  samples: TrackSample[],
  lapLength: number,
  trackHalfWidth: number,
  roster: CountryDef[]
): {
  grandstands: Grandstand[];
  props: SceneryProp[];
  railBridges: RailBridge[];
  grid: SpatialGrid;
} {
  const flagPool: string[] = [];
  roster.forEach((c) => {
    c.colors.forEach((col) => {
      if (col) flagPool.push(col);
    });
  });
  if (flagPool.length === 0) flagPool.push('#EF4444', '#22C55E', '#38BDF8', '#FACC15');

  const shirtPalette = ['#F8FAFC', '#EF4444', '#22C55E', '#38BDF8', '#FACC15', '#FB923C', '#E879F9'];
  const buildingPalette = ['#1E293B', '#172554', '#312E81', '#1F2937', '#27272A', '#0F172A'];
  const buildingAccent = ['#FACC15', '#38BDF8', '#FB7185', '#34D399', '#A78BFA'];
  const treePalette = ['#14532D', '#166534', '#15803D', '#065F46', '#1E4620'];

  const grandstands: Grandstand[] = [];
  const props: SceneryProp[] = [];
  const railBridges: RailBridge[] = [];

  const cellSize = 1100;
  const standCells = new Map<string, Grandstand[]>();
  const propCells = new Map<string, SceneryProp[]>();

  const pushStand = (g: Grandstand) => {
    grandstands.push(g);
    const key = cellKey(Math.floor(g.x / cellSize), Math.floor(g.y / cellSize));
    const arr = standCells.get(key);
    if (arr) arr.push(g);
    else standCells.set(key, [g]);
  };

  const pushProp = (p: SceneryProp) => {
    props.push(p);
    const key = cellKey(Math.floor(p.x / cellSize), Math.floor(p.y / cellSize));
    const arr = propCells.get(key);
    if (arr) arr.push(p);
    else propCells.set(key, [p]);
  };

  // Covered Grandstands every ~720 world units along city sectors & outer straights
  const standStep = 720;
  const numStandSlots = Math.floor(lapLength / standStep);
  const standOffset = trackHalfWidth + 148;

  for (let i = 0; i < numStandSlots; i++) {
    const d = i * standStep;
    const frac = d / lapLength;
    const pt = sampleCircuitAt(samples, lapLength, d);
    if (pt.biome === 'rail') continue;

    // Place outer covered stands through cities & around scenic corners, and inner stands outside Pit Lane
    const sides: Array<1 | -1> = pt.biome === 'city' ? [1, -1] : [1];
    for (const side of sides) {
      if (side === -1 && (frac > 0.88 || frac < 0.09)) continue;
      if (pt.biome === 'forest' && i % 3 !== 0) continue; // Keep forest mostly lush trees with periodic fan zones

      const sx = pt.x + pt.nx * (side * standOffset);
      const sy = pt.y + pt.ny * (side * standOffset);
      const angle = Math.atan2(pt.ty, pt.tx) + (side < 0 ? Math.PI : 0);
      const w = 480;
      const dStand = 116;

      const rows = 4;
      const cols = Math.floor(w / 26);
      const spectators: Spectator[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          spectators.push({
            row: r,
            col: c,
            shirt: shirtPalette[(r * 7 + c * 3 + i) % shirtPalette.length],
            flagColor: flagPool[(r * 5 + c + i) % flagPool.length],
            phase: ((i * 13 + r * 5 + c) % 31) * 0.2,
            hasFlag: (r + c) % 2 === 0,
          });
        }
      }

      pushStand({
        x: sx,
        y: sy,
        angle,
        width: w,
        depth: dStand,
        lapDistCenter: d,
        spectators,
      });
    }
  }

  // City Skyscrapers + Streetlamps vs Dense Forest Canopies along the entire route!
  const propStep = 230;
  const numPropSlots = Math.floor(lapLength / propStep);
  for (let i = 0; i < numPropSlots; i++) {
    const d = i * propStep + 80;
    const frac = d / lapLength;
    const pt = sampleCircuitAt(samples, lapLength, d);
    const angle = Math.atan2(pt.ty, pt.tx);

    if (pt.biome === 'city') {
      // Streetlights right along the highway curb
      for (const side of [1, -1] as const) {
        if (side === -1 && (frac > 0.89 || frac < 0.08)) continue;
        pushProp({
          x: pt.x + pt.nx * side * (trackHalfWidth + 46),
          y: pt.y + pt.ny * side * (trackHalfWidth + 46),
          angle,
          kind: 'lamp',
          w: 10,
          h: 10,
          color: '#E2E8F0',
          accent: '#FDE68A',
        });

        // City Towers / Buildings further back behind grandstands
        if (i % 2 === 0) {
          const distOut = trackHalfWidth + 330 + ((i * 37) % 160);
          pushProp({
            x: pt.x + pt.nx * side * distOut,
            y: pt.y + pt.ny * side * distOut,
            angle,
            kind: 'building',
            w: 130 + ((i * 23) % 90),
            h: 105 + ((i * 41) % 85),
            color: buildingPalette[(i + (side > 0 ? 1 : 2)) % buildingPalette.length],
            accent: buildingAccent[(i * 3 + (side > 0 ? 0 : 1)) % buildingAccent.length],
          });
        }
      }
    } else if (pt.biome === 'forest') {
      // Thick lush multi-row forest flanking BOTH sides of the forest highway!
      for (const side of [1, -1] as const) {
        for (let row = 0; row < 3; row++) {
          const distOut = trackHalfWidth + 95 + row * 125 + ((i * 19 + row * 43) % 65);
          const jitterAlong = ((i * 29 + row * 17) % 80) - 40;
          pushProp({
            x: pt.x + pt.nx * side * distOut + pt.tx * jitterAlong,
            y: pt.y + pt.ny * side * distOut + pt.ty * jitterAlong,
            angle: 0,
            kind: 'tree',
            w: 44 + ((i + row) % 3) * 16,
            h: 44 + ((i + row) % 3) * 16,
            color: treePalette[(i + row) % treePalette.length],
            accent: '#4ADE80',
          });
        }
      }
    }
  }

  // Detect each 'rail' biome segment and place an overhead Railway Bridge with moving Express Train!
  let inRail = false;
  let railStartIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    const isRail = samples[i].biome === 'rail';
    if (isRail && !inRail) {
      inRail = true;
      railStartIdx = i;
    } else if (!isRail && inRail) {
      inRail = false;
      const midIdx = Math.floor((railStartIdx + i) / 2);
      const midPt = samples[midIdx];
      railBridges.push({
        x: midPt.x,
        y: midPt.y,
        tx: midPt.tx,
        ty: midPt.ty,
        nx: midPt.nx,
        ny: midPt.ny,
        angle: Math.atan2(midPt.ny, midPt.nx),
        lapDist: midPt.dist,
        trainSpeed: 420 + (railBridges.length % 2) * 90,
        trainPhase: railBridges.length * 1.8,
        trainColor: railBridges.length % 2 === 0 ? '#DC2626' : '#2563EB',
      });
    }
  }

  return {
    grandstands,
    props,
    railBridges,
    grid: { cellSize, standCells, propCells },
  };
}

function createRaceState(roster: CountryDef[], durationSec: number): RaceSimState {
  const count = roster.length;
  const totalLaps = 1;
  const { samples, lapLength, bounds } = buildTimedCountryCircuit(durationSec, count);
  const totalRaceDist = lapLength;
  const baseCruise = totalRaceDist / durationSec;
  const trackHalfWidth =
    count <= 6 ? 160 : count <= 16 ? 190 : count <= 32 ? 228 : count <= 50 ? 260 : 292;
  const tireOptions = ['#EF4444', '#FACC15', '#F8FAFC'];

  // Pit Lane & Individual Flagged Workshops right near Finish/Start boulevard
  const pitEntryDist = lapLength * 0.89;
  const pitExitDist = lapLength * 0.055;
  const pitLaneOffset = -(trackHalfWidth + 132);

  const maxWorkshopSpan = Math.min(lapLength * 0.09, Math.max(1200, count * 210));
  const baySpacing = Math.min(240, maxWorkshopSpan / Math.max(2, count));
  const pitBayWidth = Math.max(58, Math.min(175, baySpacing * 0.78));
  const totalUsedSpan = baySpacing * Math.max(1, count - 1);
  const centerWrapDist = lapLength * 0.965;
  const firstBayDist = (centerWrapDist - totalUsedSpan * 0.5 + lapLength) % lapLength;

  // On longer races (>= 3 min), cars take optional staggered pit stops cleanly
  const allowPits = durationSec >= 150;
  const shuffledOrder = roster.map((_, i) => i).sort(() => Math.random() - 0.5);
  const pitDecisionByIdx = new Map<number, { willPit: boolean; pitProgressTarget: number }>();
  shuffledOrder.forEach((origIdx) => {
    pitDecisionByIdx.set(origIdx, {
      willPit: allowPits && Math.random() < 0.55,
      pitProgressTarget: 0.87,
    });
  });

  const cars: RaceCar[] = roster.map((country, idx) => {
    const perRow = count <= 2 ? 2 : count <= 16 ? 4 : 6;
    const col = idx % perRow;
    const colsInRow = Math.min(perRow, count - Math.floor(idx / perRow) * perRow);
    const row = Math.floor(idx / perRow);
    const spread = trackHalfWidth * 1.44;
    const lane = colsInRow <= 1 ? 0 : -spread / 2 + (col / (colsInRow - 1)) * spread;
    const pitDecision = pitDecisionByIdx.get(idx) ?? { willPit: false, pitProgressTarget: 0.87 };
    const pitBoxDist = count === 1 ? centerWrapDist : (firstBayDist + idx * baySpacing) % lapLength;

    return {
      id: country.code,
      country,
      totalDist: -row * 72 - 36,
      lane,
      laneTarget: lane,
      speed: 0,
      targetSpeed: baseCruise,
      kmh: 0,
      surgeTimer: 0.7 + Math.random() * 1.5,
      overtakes: 0,
      lastRank: idx + 1,
      rankDelta: 0,
      rankMoveTimer: 0,
      wavePhase: Math.random() * Math.PI * 2,
      tireAccent: tireOptions[idx % tireOptions.length],
      tireWear: 100,
      pitState: 'none',
      pitTimer: 0,
      pitProgressTarget: pitDecision.pitProgressTarget,
      willPit: pitDecision.willPit,
      pitBoxDist,
      hasPitted: false,
      pitStopsDone: 0,
      finishedRank: null,
    };
  });

  const env = buildWorldEnvironment(samples, lapLength, trackHalfWidth, roster);

  // Frame ALL starting grid cars inside the opening viewport
  let gMinX = Infinity;
  let gMaxX = -Infinity;
  let gMinY = Infinity;
  let gMaxY = -Infinity;
  for (const car of cars) {
    const pt = sampleCircuitAt(samples, lapLength, car.totalDist);
    const cx = pt.x + pt.nx * car.lane;
    const cy = pt.y + pt.ny * car.lane;
    if (cx < gMinX) gMinX = cx;
    if (cx > gMaxX) gMaxX = cx;
    if (cy < gMinY) gMinY = cy;
    if (cy > gMaxY) gMaxY = cy;
  }
  const initCamX = Number.isFinite(gMinX) ? (gMinX + gMaxX) * 0.5 : samples[0].x;
  const initCamY = Number.isFinite(gMinY) ? (gMinY + gMaxY) * 0.5 : samples[0].y;
  const initZoom = Number.isFinite(gMinX)
    ? Math.max(
        0.16,
        Math.min(
          0.62,
          Math.min(CANVAS_W / Math.max(820, gMaxX - gMinX + 440), CANVAS_H / Math.max(480, gMaxY - gMinY + 340))
        )
      )
    : 0.54;

  return {
    cars,
    grandstands: env.grandstands,
    props: env.props,
    railBridges: env.railBridges,
    grid: env.grid,
    sparks: [],
    streaks: [],
    samples,
    bounds,
    lapLength,
    totalLaps,
    totalRaceDist,
    trackHalfWidth,
    pitEntryDist,
    pitExitDist,
    pitLaneOffset,
    pitBayWidth,
    elapsed: 0,
    countdownTimer: 3.5,
    lastCountdownStep: 4,
    raceStarted: false,
    crowdExcitement: 0.35,
    winner: null,
    finishOrder: [],
    finishPhaseTimer: 0,
    fireworkCooldown: 0,
    allFinishedAt: null,
    showWinnerModal: false,
    announcedHalfway: false,
    announcedFinalLap: false,
    lastLeaderId: roster[0]?.code ?? null,
    overtakeCooldown: 0,
    commentaryTimer: 4.5,
    liveCommentary: 'Drivers lined up on the clean Grand Prix grid! Packed stadium stands ready for lights out!',
    winReason: '',
    camX: initCamX,
    camY: initCamY,
    camZoom: initZoom,
  };
}

export const CountryCarRace: React.FC<CountryCarRaceProps> = ({
  config,
  isPlaying,
  speedMultiplier,
  autoNextCycle,
  restartSignal,
  customModalOpen,
  isPortrait916 = false,
  onCloseCustomModal,
  onUpdateConfig,
  onOpenMenu,
  onRecordWin,
}) => {
  const {
    carCount,
    durationSec,
    duelA,
    duelB,
    cameraView,
    customCodes,
    useCustomRoster,
    commLang,
    preferredWinnerCode,
  } = config;

  const [raceCycle, setRaceCycle] = useState<number>(1);
  const [watchedCode, setWatchedCode] = useState<string | null>(null);
  const [pipMode, setPipMode] = useState<'chase' | 'radar'>('chase');
  const [draftCustomCodes, setDraftCustomCodes] = useState<string[]>(customCodes);
  const [modalQuery, setModalQuery] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(soundEngine.getIsSpeaking());
  const [, setHudTick] = useState<number>(0);

  useEffect(() => {
    if (customModalOpen) {
      setDraftCustomCodes(customCodes);
      setModalQuery('');
    }
  }, [customModalOpen, customCodes]);

  const activeRoster = useMemo(() => {
    if (carCount === 2 && !useCustomRoster) {
      const cA = COUNTRIES.find((c) => c.code === duelA) ?? COUNTRIES[0];
      const cB = COUNTRIES.find((c) => c.code === duelB) ?? COUNTRIES[1];
      return [cA, cB];
    }
    if (useCustomRoster && customCodes.length >= 2) {
      return COUNTRIES.filter((c) => customCodes.includes(c.code));
    }
    return COUNTRIES.slice(0, carCount);
  }, [carCount, duelA, duelB, useCustomRoster, customCodes]);

  const effectiveFavoriteWinner = useMemo(() => {
    if (!preferredWinnerCode) return '';
    return activeRoster.some((c) => c.code === preferredWinnerCode) ? preferredWinnerCode : '';
  }, [preferredWinnerCode, activeRoster]);

  const raceRef = useRef<RaceSimState>(createRaceState(activeRoster, durationSec));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speedMultiplier);
  const watchedRef = useRef(watchedCode);
  const pipModeRef = useRef(pipMode);
  const cameraViewRef = useRef(cameraView);
  const durationRef = useRef(durationSec);
  const langRef = useRef(commLang);
  const favoriteWinnerRef = useRef<string>(effectiveFavoriteWinner);
  const isPortrait916Ref = useRef(isPortrait916);
  const onRecordWinRef = useRef(onRecordWin);

  useEffect(() => {
    isPortrait916Ref.current = isPortrait916;
  }, [isPortrait916]);

  useEffect(() => {
    onRecordWinRef.current = onRecordWin;
  }, [onRecordWin]);

  useEffect(() => {
    favoriteWinnerRef.current = effectiveFavoriteWinner;
  }, [effectiveFavoriteWinner]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    watchedRef.current = watchedCode;
  }, [watchedCode]);

  useEffect(() => {
    pipModeRef.current = pipMode;
  }, [pipMode]);

  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  useEffect(() => {
    durationRef.current = durationSec;
  }, [durationSec]);

  useEffect(() => {
    langRef.current = commLang;
    soundEngine.setCommentaryLang(commLang);
    const s = raceRef.current;
    const spokenLang = resolveSpokenLanguage(
      commLang,
      s.cars.map((c) => c.id)
    );
    ([3, 2, 1, 0] as const).forEach((step) => {
      const c = getCountdownSpeech(step, spokenLang);
      soundEngine.prewarmPhrase(c.text, spokenLang, 'countdown');
    });

    if (s.raceStarted && !s.winner && soundEngine.voiceEnabled) {
      const sorted = [...s.cars].sort((a, b) => b.totalDist - a.totalDist);
      const lead = sorted[0];
      const riv = sorted[1];
      if (lead) {
        const pct = Math.max(0, Math.min(100, Math.round((lead.totalDist / s.totalRaceDist) * 100)));
        const msg = buildRaceCommentary(
          'pace',
          spokenLang,
          getCountrySpokenName(lead.country, spokenLang),
          riv ? getCountrySpokenName(riv.country, spokenLang) : '',
          lead.kmh,
          pct
        );
        s.liveCommentary = msg;
        s.commentaryTimer = 6.0;
        soundEngine.speakText(msg, true, spokenLang, 'excited');
        setHudTick((t) => t + 1);
      }
    }
  }, [commLang, activeRoster]);

  useEffect(() => {
    const unsub = soundEngine.subscribeSpeaking(setIsSpeaking);
    return () => {
      unsub();
      soundEngine.stopCarAudio();
      soundEngine.stopAllSpeech();
    };
  }, []);

  const startFreshRace = useCallback(
    (incrementCycle: boolean) => {
      soundEngine.stopAllSpeech();
      raceRef.current = createRaceState(activeRoster, durationSec);
      if (incrementCycle) {
        setRaceCycle((c) => c + 1);
      }
      setHudTick((t) => t + 1);
    },
    [activeRoster, durationSec]
  );

  useEffect(() => {
    startFreshRace(false);
  }, [startFreshRace, restartSignal]);

  const winnerModalVisible = Boolean(raceRef.current.winner && raceRef.current.showWinnerModal);
  useEffect(() => {
    if (!winnerModalVisible || !autoNextCycle) return;
    const timer = window.setTimeout(() => {
      startFreshRace(true);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [winnerModalVisible, autoNextCycle, startFreshRace]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let syncAcc = 0;

    const frame = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = raceRef.current;
      if (isPlayingRef.current) {
        const dt = rawDt * speedRef.current;
        const hadWinner = Boolean(s.winner);
        const hadModal = s.showWinnerModal;
        const prevStep = s.lastCountdownStep;
        const activeCanvasH = isPortrait916Ref.current ? 820 : CANVAS_H;
        stepFormulaRace(
          s,
          dt,
          durationRef.current,
          langRef.current,
          favoriteWinnerRef.current || null,
          activeCanvasH
        );

        if (s.lastCountdownStep !== prevStep || (!hadModal && s.showWinnerModal)) {
          setHudTick((t) => t + 1);
        }

        if (!hadWinner && s.winner) {
          soundEngine.stopCarAudio();
          onRecordWinRef.current?.(s.winner.country);
          soundEngine.playVictory();
          soundEngine.playCrowdCheer();
          s.crowdExcitement = 1.0;

          const spokenLang = resolveSpokenLanguage(
            langRef.current,
            s.cars.map((c) => c.id)
          );
          const winName = getCountrySpokenName(s.winner.country, spokenLang);
          const runnerUp = s.cars
            .filter((c) => c.id !== s.winner!.id)
            .sort((a, b) => b.totalDist - a.totalDist)[0];
          const secondName = runnerUp ? getCountrySpokenName(runnerUp.country, spokenLang) : '';
          const customWin = soundEngine.customCommentary.customVictoryLine.trim();
          const winMsg = customWin
            ? customWin
                .replace(/\{winner\}|\{leader\}|\{country\}/gi, winName)
                .replace(/\{rival\}/gi, secondName || winName)
            : buildRaceCommentary('victory', spokenLang, winName, secondName, s.winner.kmh, 100);

          s.liveCommentary = winMsg;
          soundEngine.speakText(winMsg, false, spokenLang, 'victory');
          setHudTick((t) => t + 1);
        } else if (!s.winner) {
          const baseCruise = s.totalRaceDist / Math.max(1, durationRef.current);
          if (!s.raceStarted) {
            soundEngine.updateCarAudio(true, 0.14, 0.12);
          } else {
            let maxRatio = 0.2;
            let sumRatio = 0;
            for (const c of s.cars) {
              const r = c.speed / (baseCruise || 1);
              if (r > maxRatio) maxRatio = r;
              sumRatio += r;
            }
            const avgRatio = sumRatio / Math.max(1, s.cars.length);
            soundEngine.updateCarAudio(true, maxRatio, avgRatio);
          }
        }

        syncAcc += rawDt;
        if (syncAcc > 0.14) {
          syncAcc = 0;
          setHudTick((t) => t + 1);
        }
      } else {
        soundEngine.stopCarAudio();
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const activeCanvasH = isPortrait916Ref.current ? 820 : CANVAS_H;
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
          drawFormulaCanvas(ctx, s, watchedRef.current, cameraViewRef.current, activeCanvasH);
          ctx.restore();
        }
      }

      const pipCanvas = pipCanvasRef.current;
      if (pipCanvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pw = Math.round(PIP_W * dpr);
        const ph = Math.round(PIP_H * dpr);
        if (pipCanvas.width !== pw || pipCanvas.height !== ph) {
          pipCanvas.width = pw;
          pipCanvas.height = ph;
        }
        const pctx = pipCanvas.getContext('2d');
        if (pctx) {
          pctx.save();
          pctx.scale(dpr, dpr);
          drawFormulaMiniCam(pctx, s, watchedRef.current, pipModeRef.current);
          pctx.restore();
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const s = raceRef.current;
  const sortedCars = sortRaceCars(s.cars);
  const leader = sortedCars[0];
  const leaderZone = leader
    ? sampleCircuitAt(s.samples, s.lapLength, Math.max(0, leader.totalDist)).zoneName
    : 'Capital City';
  const leaderPct = leader
    ? Math.max(0, Math.min(100, Math.round((leader.totalDist / s.totalRaceDist) * 100)))
    : 0;

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  const countdownDisplay =
    !s.raceStarted && s.countdownTimer > 0
      ? s.countdownTimer > 2.5
        ? '3'
        : s.countdownTimer > 1.6
          ? '2'
          : s.countdownTimer > 0.7
            ? '1'
            : 'GO!'
      : null;

  const racingLeft = s.cars.filter((c) => !c.finishedRank).length;
  const focusCar =
    (watchedCode ? s.cars.find((c) => c.id === watchedCode) : undefined) ?? sortedCars[0];
  const focusRank = focusCar ? sortedCars.findIndex((c) => c.id === focusCar.id) + 1 : 1;
  const runnerUp = sortedCars[1];

  return (
    <div className="vortexia-shell bg-[#060918] text-slate-100">
      {/* Pro Header: Brand + Colorful Total/Left Countries Box + 3-Lines Menu */}
      <header className="border-b border-slate-800 bg-[#0A1024] px-3 py-1.5 sm:px-6 sm:py-2.5 shrink-0">
        <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] sm:text-lg lg:text-xl font-black uppercase tracking-tight leading-none truncate">
              <span className="text-white">VORTEXIA GLOBAL </span>
              <span className="text-amber-400">BATTLE</span>
            </h1>
            <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-[#8C96C8] uppercase tabular-nums truncate">
              <span>Race {raceCycle}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-300 truncate">{leaderZone}</span>
              {leader && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-cyan-300 shrink-0">{leader.kmh} km/h</span>
                </>
              )}
              <span className="vortexia-portrait-only text-slate-300 shrink-0">
                · {formatClock(s.elapsed)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <HeaderStatBox
              totalCount={s.cars.length}
              totalLabel="Countries"
              leftCount={racingLeft}
              leftLabel="Left"
              extraText={`${formatClock(s.elapsed)} / ${formatClock(durationSec)}`}
            />
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-[#0F1633] text-amber-300 hover:border-amber-400 hover:text-white shrink-0"
              aria-label="Open controls menu"
              title="All Race Options, Timer (1-15m), Countries, Voice & Camera"
            >
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Stage: Desktop 2-Col [Track | Side Mini-Screen + Live Standings] / 9:16 Locked Stack */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 min-h-0 px-2.5 py-2 sm:px-5 sm:py-3 vortexia-split-grid">
        {/* Track Column */}
        <div className="flex flex-col gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          {/* Compact 1-Line Live Commentary Ticker */}
          <div className="rounded-xl border border-[#1B2344] bg-[#090E23] px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Volume2
                className={`h-3.5 w-3.5 shrink-0 ${
                  isSpeaking ? 'text-emerald-400' : 'text-amber-400/70'
                }`}
              />
              <p className="font-semibold text-amber-200 truncate">{s.liveCommentary}</p>
            </div>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-cyan-300 tabular-nums shrink-0">
              <Flag className="h-3 w-3 text-amber-400" />
              <span>{leaderPct}%</span>
            </span>
          </div>

          {/* Main Adaptive Race Track Canvas (16:9 on Desktop, Tall 960:820 in 9:16 Mode) */}
          <div className="vortexia-main-canvas-box w-full">
            <div
              className="vortexia-canvas-frame relative rounded-xl border border-slate-700/80 bg-[#0B1D16] overflow-hidden shadow-2xl"
              style={{ aspectRatio: isPortrait916 ? '960 / 820' : '16 / 9' }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain block select-none"
              />

              {/* 3-2-1-GO Starting Grid Lights */}
              {countdownDisplay && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#060918]/35">
                  <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0A0F20]/95 px-3 py-1.5 sm:px-4 sm:py-2.5 shadow-xl">
                    {[1, 2, 3, 4, 5].map((idx) => {
                      const isGo = countdownDisplay === 'GO!';
                      const activeRed =
                        !isGo &&
                        ((countdownDisplay === '3' && idx <= 3) ||
                          (countdownDisplay === '2' && idx <= 4) ||
                          (countdownDisplay === '1' && idx <= 5));
                      return (
                        <div
                          key={idx}
                          className={`h-3.5 w-3.5 sm:h-5 sm:w-5 rounded-full border transition-colors ${
                            isGo
                              ? 'border-emerald-300 bg-emerald-400 shadow-[0_0_14px_#34D399]'
                              : activeRed
                                ? 'border-rose-300 bg-rose-500 shadow-[0_0_14px_#F43F5E]'
                                : 'border-slate-700 bg-slate-900'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div
                    className={`font-black tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] ${
                      countdownDisplay === 'GO!'
                        ? 'text-4xl sm:text-7xl text-emerald-400'
                        : 'text-5xl sm:text-8xl text-amber-400'
                    }`}
                  >
                    {countdownDisplay}
                  </div>
                </div>
              )}

              {/* Live On-Track Checkered Finish Line Crossing Celebration (Non-blocking!) */}
              {s.winner && !s.showWinnerModal && (
                <>
                  <VictoryConfetti
                    colors={s.winner.country.colors.filter(Boolean) as string[]}
                    className="z-10"
                  />
                  <div className="absolute inset-x-2 top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/70 bg-[#060918]/88 px-2.5 py-1.5 shadow-xl backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                      <FlagBadge
                        code={s.winner.country.code}
                        name={s.winner.country.name}
                        size={22}
                        className="ring-2 ring-amber-400/80 shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-black text-amber-300 truncate">
                        #1 {s.winner.country.name} WINS!
                      </span>
                      <span className="hidden sm:inline text-[11px] font-bold text-emerald-300">
                        · Finish Crossing: {s.finishOrder.length}/{s.cars.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="sm:hidden font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
                        {s.finishOrder.length}/{s.cars.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          s.showWinnerModal = true;
                          setHudTick((t) => t + 1);
                        }}
                        className="rounded-md bg-amber-400 px-2.5 py-1 text-[10px] sm:text-xs font-extrabold text-slate-950 hover:bg-amber-300"
                      >
                        Podium
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Winner Celebration Modal (Shown after all cars cross the checkered finish line) */}
              {s.winner && s.showWinnerModal && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060918]/82 p-2.5 sm:p-4 backdrop-blur-[2px] overflow-hidden">
                  <VictoryConfetti
                    colors={s.winner.country.colors.filter(Boolean) as string[]}
                    className="z-20"
                  />
                  <div className="relative z-10 w-full max-w-md max-h-[95%] overflow-y-auto rounded-xl border border-amber-400/60 bg-[#0A1027]/95 p-3.5 sm:p-5 text-center shadow-2xl">
                    <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-amber-400">
                      VORTEXIA GLOBAL BATTLE · Race {raceCycle}
                    </p>
                    <div className="my-2 flex items-center justify-center gap-2.5 sm:gap-3">
                      <FlagBadge
                        code={s.winner.country.code}
                        name={s.winner.country.name}
                        size={46}
                        className="ring-3 ring-amber-400/80 shrink-0"
                      />
                      <div className="text-left min-w-0">
                        <h3 className="text-lg sm:text-2xl font-extrabold text-white leading-tight truncate">
                          {s.winner.country.name} Wins!
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-300 tabular-nums">
                          {formatClock(s.elapsed)} · {s.winner.kmh} km/h · {s.finishOrder.length}/
                          {s.cars.length} Finished
                        </p>
                      </div>
                    </div>

                    <p className="rounded-lg border border-slate-800 bg-[#060918] px-2.5 py-1.5 text-[11px] sm:text-xs text-cyan-200">
                      {s.winReason}
                    </p>

                    <div className="mt-2.5 max-h-24 sm:max-h-36 overflow-y-auto space-y-1 text-left pr-1">
                      {sortedCars.slice(0, 8).map((car, idx) => {
                        const pct = Math.min(100, Math.round((car.totalDist / s.totalRaceDist) * 100));
                        return (
                          <div
                            key={car.id}
                            className="flex items-center justify-between rounded-md border border-slate-800/80 bg-[#070C20] px-2 py-1 text-[11px]"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`font-mono font-bold tabular-nums w-6 ${
                                  idx === 0
                                    ? 'text-amber-300'
                                    : idx === 1
                                      ? 'text-slate-200'
                                      : idx === 2
                                        ? 'text-orange-300'
                                        : 'text-slate-400'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <FlagBadge code={car.country.code} name={car.country.name} size={16} />
                              <span className="font-semibold text-white truncate">
                                {car.country.name}
                              </span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                              {idx === 0
                                ? 'WINNER'
                                : car.finishedRank
                                  ? `FINISHED #${car.finishedRank}`
                                  : `${pct}% · ${car.overtakes} ovt`}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => startFreshRace(true)}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap"
                      >
                        Next Race
                      </button>
                      <button
                        type="button"
                        onClick={() => startFreshRace(false)}
                        className="min-h-[36px] sm:min-h-[40px] rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:border-slate-400 whitespace-nowrap"
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Side Panel: Live Mini-Screen Focus Cam + Live Rank Movement Line (Desktop Sidebar / 9:16 Bottom) */}
        <aside
          className="vortexia-aside-panel rounded-xl border border-[#1B2344] bg-[#090E23] p-2.5 sm:p-3 gap-2"
          aria-label="Live race mini camera and live positions standings"
        >
          {/* Side Mini-Screen Row (Full-width in Desktop Sidebar, Compact Split in 9:16 Portrait) */}
          <div className="vortexia-pip-row shrink-0">
            <div className="vortexia-pip-box flex flex-col rounded-lg border border-slate-700/80 bg-[#060918] overflow-hidden shrink-0">
              <div className="flex items-center justify-between gap-1 bg-[#0B122B] px-2 py-1 border-b border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 truncate">
                  {watchedCode
                    ? `Focus #${focusRank}`
                    : s.winner && !s.showWinnerModal && pipMode === 'chase'
                      ? 'Finish Cam · Live'
                      : 'Mini Cam · Live'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {watchedCode && (
                    <button
                      type="button"
                      onClick={() => setWatchedCode(null)}
                      className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-300 hover:text-white"
                    >
                      Auto
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPipMode((m) => (m === 'chase' ? 'radar' : 'chase'))}
                    className="rounded border border-cyan-400/40 bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200 hover:bg-cyan-500/25"
                  >
                    {pipMode === 'chase' ? 'Radar' : 'Chase'}
                  </button>
                </div>
              </div>
              <div className="relative w-full aspect-video bg-[#0B1D16]">
                <canvas
                  ref={pipCanvasRef}
                  className="w-full h-full object-contain block select-none"
                />
              </div>
            </div>

            {/* Quick Duel Telemetry Card next to Mini-Screen on 9:16 Portrait */}
            <div className="vortexia-portrait-only flex-1 min-w-0 flex-col justify-between rounded-lg border border-slate-800 bg-[#060918] p-2">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Lead Battle
              </div>
              {focusCar && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <FlagBadge code={focusCar.country.code} name={focusCar.country.name} size={20} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold text-amber-300 truncate">
                      #{focusRank} {focusCar.country.name}
                    </div>
                    <div className="font-mono text-[10px] font-bold text-cyan-300 tabular-nums">
                      {focusCar.kmh} km/h · {focusCar.overtakes} ovt
                    </div>
                  </div>
                </div>
              )}
              {runnerUp && (
                <div className="flex items-center justify-between gap-1 border-t border-slate-800/80 pt-1 text-[10px]">
                  <span className="flex items-center gap-1 min-w-0 text-slate-300">
                    <span className="font-mono font-bold text-slate-400">#2</span>
                    <FlagBadge code={runnerUp.country.code} name={runnerUp.country.name} size={14} />
                    <span className="truncate font-semibold">{runnerUp.country.code}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-400 tabular-nums shrink-0">
                    {runnerUp.kmh} km/h
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live Rank-Movement Tower Header */}
          <div className="flex items-center justify-between border-y border-slate-800 py-1.5 shrink-0">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-400">
              Live Standings
            </span>
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300 tabular-nums">
              ▲ Up / ▼ Down
            </span>
          </div>

          {/* Live Scrollable List (#1, #2, #3... moving UP / DOWN in real time) */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
            {sortedCars.map((car, idx) => {
              const rank = idx + 1;
              const pct = Math.max(0, Math.min(100, Math.round((car.totalDist / s.totalRaceDist) * 100)));
              const isWatched = watchedCode === car.id;
              const movingUp = car.rankDelta > 0 && car.rankMoveTimer > 0;
              const movingDown = car.rankDelta < 0 && car.rankMoveTimer > 0;
              const isLeader = rank === 1;
              const barColor =
                car.pitState === 'pitting'
                  ? 'bg-emerald-400'
                  : isLeader
                    ? 'bg-amber-400'
                    : movingUp
                      ? 'bg-emerald-400'
                      : 'bg-cyan-400';

              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => {
                    setWatchedCode(isWatched ? null : car.id);
                    onUpdateConfig({ cameraView: 'action' });
                  }}
                  className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1 text-left transition-colors ${
                    isWatched
                      ? 'border-cyan-400 bg-cyan-500/15'
                      : car.pitState === 'pitting'
                        ? 'border-emerald-400/70 bg-emerald-500/12'
                        : movingUp
                          ? 'border-emerald-400/60 bg-emerald-500/10'
                          : movingDown
                            ? 'border-rose-500/45 bg-rose-500/10'
                            : isLeader
                              ? 'border-amber-400/60 bg-amber-400/10'
                              : 'border-slate-800 bg-[#060918] hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`w-6 font-mono text-[11px] font-black tabular-nums shrink-0 ${
                      rank === 1
                        ? 'text-amber-300'
                        : rank === 2
                          ? 'text-slate-200'
                          : rank === 3
                            ? 'text-orange-300'
                            : 'text-slate-400'
                    }`}
                  >
                    #{rank}
                  </span>
                  <FlagBadge code={car.country.code} name={car.country.name} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 text-[11px] leading-tight">
                      <span className="font-bold text-white truncate">{car.country.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {movingUp ? (
                          <span className="rounded bg-emerald-500/20 px-1 py-0.5 font-mono text-[9px] font-black text-emerald-300 tabular-nums">
                            ▲ +{car.rankDelta}
                          </span>
                        ) : movingDown ? (
                          <span className="rounded bg-rose-500/20 px-1 py-0.5 font-mono text-[9px] font-black text-rose-300 tabular-nums">
                            ▼ {car.rankDelta}
                          </span>
                        ) : null}
                        <span
                          className={`font-mono text-[10px] font-bold tabular-nums ${
                            car.pitState === 'pitting'
                              ? 'text-emerald-300'
                              : car.finishedRank
                                ? 'text-amber-300'
                                : 'text-cyan-300'
                          }`}
                        >
                          {car.pitState === 'pitting'
                            ? 'PIT!'
                            : car.finishedRank
                              ? 'FIN'
                              : `${car.kmh}`}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </main>

      {/* Custom Country Picker Modal */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-[#0B1026] p-5 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Select Race Countries ({draftCustomCodes.length} Selected)
              </h3>
              <button
                type="button"
                onClick={onCloseCustomModal}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="my-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftCustomCodes(COUNTRIES.map((c) => c.code))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:border-slate-500"
              >
                All ({COUNTRIES.length})
              </button>
              <button
                type="button"
                onClick={() => setDraftCustomCodes(COUNTRIES.slice(0, 8).map((c) => c.code))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                8 Cars
              </button>
              <button
                type="button"
                onClick={() => setDraftCustomCodes(COUNTRIES.slice(0, 5).map((c) => c.code))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                5 Cars
              </button>
              <button
                type="button"
                onClick={() => setDraftCustomCodes(COUNTRIES.slice(0, 4).map((c) => c.code))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                4 Cars
              </button>
              <button
                type="button"
                onClick={() => setDraftCustomCodes(draftCustomCodes.slice(0, 2))}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-400"
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
                const checked = draftCustomCodes.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setDraftCustomCodes((prev) => {
                        if (prev.includes(c.code)) {
                          if (prev.length <= 2) return prev;
                          return prev.filter((x) => x !== c.code);
                        }
                        return [...prev, c.code];
                      });
                    }}
                    className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-2.5 py-1 text-left text-xs font-medium ${
                      checked
                        ? 'border-amber-400 bg-amber-400/15 text-amber-200'
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
                  onUpdateConfig({
                    customCodes: draftCustomCodes,
                    useCustomRoster: true,
                  });
                  onCloseCustomModal();
                }}
                className="min-h-[40px] rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Race With {draftCustomCodes.length} Cars
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function stepFormulaRace(
  s: RaceSimState,
  dt: number,
  durationSec: number,
  langSetting: CommentaryLanguage,
  favoriteWinnerCode: string | null = null,
  canvasH: number = CANVAS_H
) {
  const baseCruise = s.totalRaceDist / durationSec;
  const spokenLang = resolveSpokenLanguage(
    langSetting,
    s.cars.map((c) => c.id)
  );

  // 1. 3 - 2 - 1 - GO! Starting Grid Countdown
  if (!s.raceStarted) {
    s.countdownTimer -= dt;
    const stepNow =
      s.countdownTimer > 2.5
        ? 3
        : s.countdownTimer > 1.6
          ? 2
          : s.countdownTimer > 0.7
            ? 1
            : 0;

    if (stepNow < s.lastCountdownStep) {
      s.lastCountdownStep = stepNow;
      const call = getCountdownSpeech(stepNow as 3 | 2 | 1 | 0, spokenLang);
      soundEngine.playCountdownBeep(stepNow === 0);
      const customIntro = soundEngine.customCommentary.customIntroLine.trim();
      const spokenText = stepNow === 0 && customIntro ? customIntro : call.text;
      if (stepNow === 0) {
        s.liveCommentary = spokenText;
        soundEngine.playCrowdCheer();
        s.crowdExcitement = 0.85;
      }
      soundEngine.speakText(spokenText, stepNow === 0, spokenLang, 'countdown');
    }

    if (s.countdownTimer <= 0) {
      s.raceStarted = true;
      for (const car of s.cars) {
        car.speed = baseCruise * 0.45;
      }
    }
    return;
  }

  if (s.showWinnerModal) {
    s.crowdExcitement = 1.0;
    updateEffects(s, dt);
    return;
  }

  s.elapsed += dt;
  if (s.winner) {
    s.finishPhaseTimer += dt;
    s.crowdExcitement = 1.0;
    s.fireworkCooldown -= dt;
    if (s.fireworkCooldown <= 0) {
      s.fireworkCooldown = 0.22;
      const finPt = s.samples[0];
      const lateral = (Math.random() * 2 - 1) * (s.trackHalfWidth + 110);
      const forward = (Math.random() - 0.3) * 260;
      spawnFinishFireworks(
        s,
        finPt.x + finPt.nx * lateral + finPt.tx * forward,
        finPt.y + finPt.ny * lateral + finPt.ty * forward,
        s.winner.country.colors.filter(Boolean) as string[],
        18
      );
    }
  } else {
    if (s.overtakeCooldown > 0) s.overtakeCooldown = Math.max(0, s.overtakeCooldown - dt);
    s.crowdExcitement = Math.max(0.32, s.crowdExcitement - dt * 0.18);
  }

  const startupRamp = Math.min(1, 0.55 + s.elapsed * 0.35);
  const currentSorted = sortRaceCars(s.cars);
  const packLeader = currentSorted[0];
  const packLeaderDist = packLeader?.totalDist ?? 0;
  const nonTargetLeader = favoriteWinnerCode
    ? currentSorted.find((c) => c.id !== favoriteWinnerCode) ?? packLeader
    : packLeader;
  const nonTargetLeaderDist = nonTargetLeader?.totalDist ?? packLeaderDist;
  const leaderPctRatio = Math.max(0, Math.min(1, packLeaderDist / s.totalRaceDist));

  const wrapRel = (d: number) => (d - s.pitEntryDist + s.lapLength) % s.lapLength;
  const pitExitRel = wrapRel(s.pitExitDist);

  for (const car of s.cars) {
    car.wavePhase += dt * (14 + car.speed * 0.018);

    // Victory Parade Coast for cars that already crossed the Finish Line
    if (car.finishedRank !== null) {
      const paradeStopDist =
        s.totalRaceDist + 230 + Math.max(0, 64 - car.finishedRank) * 8;
      const distLeftInParade = paradeStopDist - car.totalDist;
      const desiredParade =
        distLeftInParade > 12
          ? Math.min(baseCruise * 0.88, Math.max(baseCruise * 0.26, distLeftInParade * 1.15))
          : 0;
      car.speed += (desiredParade - car.speed) * Math.min(1, dt * 4.5);
      car.totalDist += car.speed * dt;
      car.kmh = car.speed < 25 ? 0 : Math.max(40, Math.round((car.speed / baseCruise) * 240));

      const sample = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);
      if (car.finishedRank <= 3 && Math.random() < dt * 8) {
        const pal = car.country.colors.filter(Boolean) as string[];
        s.sparks.push({
          x: sample.x + sample.nx * car.lane - sample.tx * 24,
          y: sample.y + sample.ny * car.lane - sample.ty * 24,
          vx: -sample.tx * 95 + (Math.random() - 0.5) * 60,
          vy: -sample.ty * 95 + (Math.random() - 0.5) * 60,
          r: 3.4,
          color: pal[0] || '#FACC15',
          life: 0,
          maxLife: 0.45,
        });
      }
      continue;
    }

    const progressFrac = Math.max(0, car.totalDist) / s.totalRaceDist;
    const currLapD = ((car.totalDist % s.lapLength) + s.lapLength) % s.lapLength;
    const entryRel = wrapRel(currLapD);

    if (s.winner) {
      car.willPit = false;
      if (car.pitState === 'entering') car.pitState = 'exiting';
      if (car.pitState === 'pitting') car.pitTimer = Math.min(car.pitTimer, 0.1);
    }

    if (car.pitState === 'none') {
      car.tireWear = Math.max(25, car.tireWear - dt * 0.45);
    }

    if (
      !s.winner &&
      car.willPit &&
      !car.hasPitted &&
      car.pitState === 'none' &&
      progressFrac >= car.pitProgressTarget &&
      entryRel < 320
    ) {
      car.pitState = 'entering';
    }

    if (car.pitState === 'entering') {
      car.laneTarget = s.pitLaneOffset;
      car.lane += (car.laneTarget - car.lane) * Math.min(1, dt * 5.2);
      car.speed += (baseCruise * 0.65 - car.speed) * Math.min(1, dt * 4.8);
      car.totalDist += car.speed * dt;
      car.kmh = Math.max(90, Math.round((car.speed / baseCruise) * 290));

      const newLapD = ((car.totalDist % s.lapLength) + s.lapLength) % s.lapLength;
      const carRel = wrapRel(newLapD);
      const boxRel = wrapRel(car.pitBoxDist);

      if (carRel >= boxRel - 18) {
        car.pitState = 'pitting';
        car.pitTimer = 0.65;
        car.speed = 0;
        car.kmh = 0;
        soundEngine.playPitGun();
      }
      continue;
    }

    if (car.pitState === 'pitting') {
      car.pitTimer -= dt;
      car.speed = 0;
      car.kmh = 0;
      car.lane += (s.pitLaneOffset - car.lane) * Math.min(1, dt * 8);

      if (car.pitTimer <= 0) {
        const nextCompounds: Record<string, string> = {
          '#EF4444': '#FACC15',
          '#FACC15': '#F8FAFC',
          '#F8FAFC': '#EF4444',
        };
        car.tireAccent = nextCompounds[car.tireAccent] || '#FACC15';
        car.tireWear = 100;
        car.hasPitted = true;
        car.pitStopsDone += 1;
        car.pitState = 'exiting';
        soundEngine.playPitGun();
      }
      continue;
    }

    if (car.pitState === 'exiting') {
      car.laneTarget = -s.trackHalfWidth * 0.45;
      car.lane += (car.laneTarget - car.lane) * Math.min(1, dt * 4.2);
      car.speed += (baseCruise * (s.winner ? 2.1 : 1.28) - car.speed) * Math.min(1, dt * 5.5);
      car.totalDist += car.speed * dt;
      car.kmh = Math.round(310 + (car.speed / baseCruise - 0.8) * 145);

      const newLapD = ((car.totalDist % s.lapLength) + s.lapLength) % s.lapLength;
      const carRel = wrapRel(newLapD);
      if (s.winner || (carRel >= pitExitRel && carRel < s.lapLength * 0.55)) {
        car.pitState = 'none';
      }
      continue;
    }

    // Pure, natural high-speed highway & circuit racing on clean road!
    car.surgeTimer -= dt;
    if (car.surgeTimer <= 0) {
      car.surgeTimer = 0.85 + Math.random() * 1.4;
      car.targetSpeed = baseCruise * (0.93 + Math.random() * 0.18);
      car.laneTarget = (Math.random() * 2 - 1) * (s.trackHalfWidth - 30);
    }

    const sample = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);
    const cornerGrip = Math.max(0.86, 1 - sample.curvature * 0.65);
    const tireGripFactor = 0.95 + (car.tireWear / 100) * 0.07;

    const gapBehind = Math.max(0, packLeaderDist - car.totalDist);
    const p2Dist = currentSorted[1]?.totalDist ?? packLeaderDist;
    const leadGap = Math.max(0, packLeaderDist - p2Dist);
    let slipstreamMult =
      car.id === packLeader?.id
        ? leadGap > 340
          ? 0.955
          : 0.995
        : gapBehind > 700
          ? 1.24 + Math.min(0.24, (gapBehind - 700) / 1600)
          : gapBehind > 260
            ? 1.13
            : 1.035;

    if (favoriteWinnerCode && !s.winner) {
      const isFav = car.id === favoriteWinnerCode;
      if (isFav) {
        const gapToRival = nonTargetLeaderDist - car.totalDist;
        if (leaderPctRatio < 0.72) {
          if (gapToRival > 220) slipstreamMult *= 1.06;
          else if (gapToRival < -160) slipstreamMult *= 0.96;
        } else if (leaderPctRatio < 0.90) {
          if (gapToRival > 95) slipstreamMult *= 1.075;
          else if (gapToRival < 35) slipstreamMult *= 0.965;
        } else if (gapToRival > -110) {
          slipstreamMult *= gapToRival > 80 ? 1.12 : 1.08;
        }
      } else if (leaderPctRatio >= 0.91 && car.totalDist > packLeaderDist - 220) {
        slipstreamMult *= 0.97;
      }
    }

    let desired = car.targetSpeed * cornerGrip * tireGripFactor * slipstreamMult * startupRamp;
    if (s.winner) {
      // Checkered Flag Final Sprint: every remaining car charges smoothly across the Finish Line!
      const distToFinish = Math.max(0, s.totalRaceDist - car.totalDist);
      const targetClearWindow = Math.max(0.45, 3.4 - s.finishPhaseTimer);
      const neededSpeed = distToFinish / targetClearWindow;
      desired = Math.max(desired * 1.4, Math.min(baseCruise * 5.2, neededSpeed * 1.15 + baseCruise * 0.6));
    }

    car.speed += (desired - car.speed) * Math.min(1, dt * (s.winner ? 6.5 : 4.2));
    car.totalDist += car.speed * dt;
    car.kmh = Math.max(160, Math.round(284 + (car.speed / baseCruise - 0.85) * 145));

    const laneDiff = car.laneTarget - car.lane;
    car.lane += laneDiff * Math.min(1, dt * 3.4);
    car.lane = Math.max(-s.trackHalfWidth + 24, Math.min(s.trackHalfWidth - 24, car.lane));

    // Subtle warm exhaust heat puffs only (no blue electric flames)
    const worldX = sample.x + sample.nx * car.lane;
    const worldY = sample.y + sample.ny * car.lane;
    if (Math.random() < dt * 7) {
      s.sparks.push({
        x: worldX - sample.tx * 28,
        y: worldY - sample.ty * 28,
        vx: -sample.tx * 120 + (Math.random() - 0.5) * 32,
        vy: -sample.ty * 120 + (Math.random() - 0.5) * 32,
        r: 2.1,
        color: '#F97316',
        life: 0,
        maxLife: 0.2,
      });
    }

    if (car.totalDist >= s.totalRaceDist && car.finishedRank === null) {
      car.finishedRank = s.finishOrder.length + 1;
      s.finishOrder.push(car);
      const finPt = s.samples[0];
      const pal = car.country.colors.filter(Boolean) as string[];
      if (!s.winner) {
        s.winner = car;
        s.winReason = `${car.country.name} captured P1 across ${sample.zoneName} with ${car.overtakes} clean overtakes!`;
        spawnFinishFireworks(
          s,
          finPt.x + finPt.nx * car.lane,
          finPt.y + finPt.ny * car.lane,
          pal,
          36
        );
        spawnFinishFireworks(
          s,
          finPt.x + finPt.nx * (s.trackHalfWidth + 55),
          finPt.y + finPt.ny * (s.trackHalfWidth + 55),
          pal,
          22
        );
        spawnFinishFireworks(
          s,
          finPt.x - finPt.nx * (s.trackHalfWidth + 55),
          finPt.y - finPt.ny * (s.trackHalfWidth + 55),
          pal,
          22
        );
      } else {
        spawnFinishFireworks(
          s,
          finPt.x + finPt.nx * car.lane,
          finPt.y + finPt.ny * car.lane,
          pal,
          10
        );
      }
    }
  }

  if (s.winner) {
    if (s.finishOrder.length >= s.cars.length && s.allFinishedAt === null) {
      s.allFinishedAt = s.finishPhaseTimer;
    }
    if (
      (s.allFinishedAt !== null && s.finishPhaseTimer - s.allFinishedAt >= 1.55) ||
      s.finishPhaseTimer >= 6.4
    ) {
      const remaining = s.cars
        .filter((c) => c.finishedRank === null)
        .sort((a, b) => b.totalDist - a.totalDist);
      for (const rem of remaining) {
        rem.totalDist = Math.max(rem.totalDist, s.totalRaceDist + 10);
        rem.finishedRank = s.finishOrder.length + 1;
        s.finishOrder.push(rem);
      }
      s.showWinnerModal = true;
    }
  }

  // Wind speed streaks
  if (Math.random() < dt * 20 && s.streaks.length < 22) {
    s.streaks.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * canvasH,
      len: 32 + Math.random() * 58,
      alpha: 0.18 + Math.random() * 0.16,
    });
  }

  // Clean wheel-to-wheel separation
  for (let i = 0; i < s.cars.length; i++) {
    for (let j = i + 1; j < s.cars.length; j++) {
      const a = s.cars[i];
      const b = s.cars[j];
      if (a.pitState !== 'none' || b.pitState !== 'none') continue;
      const ds = b.totalDist - a.totalDist;
      const dl = b.lane - a.lane;
      if (Math.abs(ds) < 48 && Math.abs(dl) < 26) {
        const push = dl >= 0 ? 24 : -24;
        a.lane -= push * dt * 2.8;
        b.lane += push * dt * 2.8;
      }
    }
  }

  const sorted = sortRaceCars(s.cars);
  sorted.forEach((car, idx) => {
    const newRank = idx + 1;
    if (newRank !== car.lastRank) {
      car.rankDelta = car.lastRank - newRank;
      car.rankMoveTimer = 2.8;
      if (newRank < car.lastRank) {
        car.overtakes += 1;
      }
      car.lastRank = newRank;
    } else if (car.rankMoveTimer > 0) {
      car.rankMoveTimer = Math.max(0, car.rankMoveTimer - dt);
      if (car.rankMoveTimer <= 0) car.rankDelta = 0;
    }
  });

  const leader = sorted[0];
  const runnerUp = sorted[1];

  // Dynamic Broadcast Camera: during finish crossing, frame Finish Line + Approaching/Crossing Cars!
  if (s.cars.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    if (s.winner && !s.showWinnerModal) {
      const finBack = sampleCircuitAt(s.samples, s.lapLength, s.lapLength - 380);
      const finLine = s.samples[0];
      const finRunoff = sampleCircuitAt(s.samples, s.lapLength, 320);
      for (const anchor of [finBack, finLine, finRunoff]) {
        for (const side of [-1, 1]) {
          const ax = anchor.x + anchor.nx * (s.trackHalfWidth + 60) * side;
          const ay = anchor.y + anchor.ny * (s.trackHalfWidth + 60) * side;
          if (ax < minX) minX = ax;
          if (ax > maxX) maxX = ax;
          if (ay < minY) minY = ay;
          if (ay > maxY) maxY = ay;
        }
      }
      for (const c of s.cars) {
        if (
          (c.finishedRank !== null && c.finishedRank <= 6) ||
          (c.finishedRank === null && s.totalRaceDist - c.totalDist <= 1650)
        ) {
          const pt = sampleCircuitAt(s.samples, s.lapLength, c.totalDist);
          const wx = pt.x + pt.nx * c.lane;
          const wy = pt.y + pt.ny * c.lane;
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (wy < minY) minY = wy;
          if (wy > maxY) maxY = wy;
        }
      }
    } else {
      for (const c of s.cars) {
        const pt = sampleCircuitAt(s.samples, s.lapLength, c.totalDist);
        const wx = pt.x + pt.nx * c.lane;
        const wy = pt.y + pt.ny * c.lane;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }
      if (leader) {
        const aheadPt = sampleCircuitAt(s.samples, s.lapLength, leader.totalDist + 110);
        minX = Math.min(minX, aheadPt.x);
        maxX = Math.max(maxX, aheadPt.x);
        minY = Math.min(minY, aheadPt.y);
        maxY = Math.max(maxY, aheadPt.y);
      }
    }

    const midX = (minX + maxX) * 0.5;
    const midY = (minY + maxY) * 0.5;
    const spanX = Math.max(820, maxX - minX + 460);
    const spanY = Math.max(480, maxY - minY + 360);
    const fitZoom = Math.min(CANVAS_W / spanX, canvasH / spanY);
    const targetZoom = Math.max(s.winner ? 0.22 : 0.11, Math.min(0.68, fitZoom));

    s.camX += (midX - s.camX) * Math.min(1, dt * 5.2);
    s.camY += (midY - s.camY) * Math.min(1, dt * 5.2);
    s.camZoom += (targetZoom - s.camZoom) * Math.min(1, dt * 4.2);
  }

  // Natural Female Broadcast Commentary + Car Zoom Pass-By Audio
  if (leader && !s.winner) {
    const pct = Math.max(0, Math.min(100, Math.round((leader.totalDist / s.totalRaceDist) * 100)));
    const leaderSample = sampleCircuitAt(s.samples, s.lapLength, leader.totalDist);
    s.commentaryTimer -= dt;
    const L = getCountrySpokenName(leader.country, spokenLang);
    const R = runnerUp ? getCountrySpokenName(runnerUp.country, spokenLang) : L;

    // Periodic high-speed "ZOOOM" pass-by or slow-rolling coast audio
    if (leader.speed > baseCruise * 1.07 && Math.random() < dt * 0.45) {
      soundEngine.playCarZoomWhoosh(leader.speed / baseCruise, false);
    } else if (leader.pitState === 'entering' && Math.random() < dt * 0.5) {
      soundEngine.playCarZoomWhoosh(0.45, true);
    }

    const pittingTopCar = sorted.slice(0, 4).find((c) => c.pitState === 'pitting');

    if (!s.announcedHalfway && pct >= 48) {
      s.announcedHalfway = true;
      s.commentaryTimer = 6.2;
      const msg = buildRaceCommentary('halfway', spokenLang, L, R, leader.kmh, pct, leaderSample.zoneName);
      s.liveCommentary = msg;
      soundEngine.speakText(msg, false, spokenLang, 'excited');
    } else if (!s.announcedFinalLap && pct >= 82) {
      s.announcedFinalLap = true;
      s.commentaryTimer = 6.5;
      s.crowdExcitement = 0.92;
      soundEngine.playCrowdCheer();
      const msg = buildRaceCommentary('finallap', spokenLang, L, R, leader.kmh, pct, leaderSample.zoneName);
      s.liveCommentary = msg;
      soundEngine.speakText(msg, false, spokenLang, 'excited');
    } else if (
      leader.id !== s.lastLeaderId &&
      s.elapsed > 3.2 &&
      s.overtakeCooldown <= 0 &&
      s.commentaryTimer <= 3.2
    ) {
      s.lastLeaderId = leader.id;
      s.overtakeCooldown = 5.5;
      s.commentaryTimer = 5.8;
      s.crowdExcitement = 0.88;
      soundEngine.playCrowdCheer();
      soundEngine.playCarZoomWhoosh(Math.max(1.05, leader.speed / baseCruise), false);
      const customEv = soundEngine.customCommentary.customEventLine.trim();
      const msg = customEv
        ? customEv.replace(/\{leader\}|\{country\}|\{winner\}/gi, L).replace(/\{rival\}/gi, R)
        : buildRaceCommentary('overtake', spokenLang, L, R, leader.kmh, pct, leaderSample.zoneName);
      s.liveCommentary = msg;
      soundEngine.speakText(msg, false, spokenLang, 'excited');
    } else if (pittingTopCar && s.commentaryTimer <= 1.2) {
      s.commentaryTimer = 6.0;
      const pitSpoken = getCountrySpokenName(pittingTopCar.country, spokenLang);
      const msg = buildRaceCommentary('pitstop', spokenLang, pitSpoken, L, pittingTopCar.kmh, pct, leaderSample.zoneName);
      s.liveCommentary = msg;
      soundEngine.speakText(msg, false, spokenLang, 'excited');
    } else if (s.commentaryTimer <= 0) {
      s.commentaryTimer = 6.8 + Math.random() * 2.0;
      s.lastLeaderId = leader.id;
      const msg = buildRaceCommentary('pace', spokenLang, L, R, leader.kmh, pct, leaderSample.zoneName);
      s.liveCommentary = msg;
      soundEngine.speakText(msg, false, spokenLang, 'excited');
    }
  }

  updateEffects(s, dt);
}

function updateEffects(s: RaceSimState, dt: number) {
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
  for (let i = s.streaks.length - 1; i >= 0; i--) {
    s.streaks[i].alpha -= dt * 0.9;
    if (s.streaks[i].alpha <= 0) s.streaks.splice(i, 1);
  }
}

function drawFormulaCanvas(
  ctx: CanvasRenderingContext2D,
  s: RaceSimState,
  watchedCode: string | null,
  cameraView: 'action' | 'full',
  canvasH: number = CANVAS_H
) {
  const nowSec = performance.now() * 0.001;

  // Determine active biome for terrain backdrop
  const lead = sortRaceCars(s.cars)[0];
  const leadSample = lead
    ? sampleCircuitAt(s.samples, s.lapLength, Math.max(0, lead.totalDist))
    : s.samples[0];

  ctx.fillStyle = leadSample.biome === 'forest' ? '#072415' : '#0B1D1B';
  ctx.fillRect(0, 0, CANVAS_W, canvasH);

  let camX = s.camX;
  let camY = s.camY;
  let zoom = s.camZoom || 0.56;

  ctx.save();
  if (cameraView === 'full') {
    const wSpan = Math.max(2000, s.bounds.maxX - s.bounds.minX + 1600);
    const hSpan = Math.max(1200, s.bounds.maxY - s.bounds.minY + 1400);
    const fullZoom = Math.min(CANVAS_W / wSpan, canvasH / hSpan);
    const cx = (s.bounds.minX + s.bounds.maxX) * 0.5;
    const cy = (s.bounds.minY + s.bounds.maxY) * 0.5;
    ctx.translate(CANVAS_W / 2, canvasH / 2);
    ctx.scale(fullZoom, fullZoom);
    ctx.translate(-cx, -cy);
  } else {
    const targetCar = watchedCode ? s.cars.find((c) => c.id === watchedCode) : undefined;
    if (targetCar) {
      const aheadPt = sampleCircuitAt(s.samples, s.lapLength, targetCar.totalDist + 140);
      const behindPt = sampleCircuitAt(s.samples, s.lapLength, targetCar.totalDist - 120);
      camX = (aheadPt.x + behindPt.x) * 0.5 + aheadPt.nx * targetCar.lane * 0.45;
      camY = (aheadPt.y + behindPt.y) * 0.5 + aheadPt.ny * targetCar.lane * 0.45;
      zoom = 0.6;
    }
    ctx.translate(CANVAS_W / 2, canvasH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Spatial cull window for crisp 60 FPS even on 15-minute tracks
  const viewHalfW = cameraView === 'full' ? 1e9 : (CANVAS_W / zoom) * 0.72;
  const viewHalfH = cameraView === 'full' ? 1e9 : (canvasH / zoom) * 0.72;

  const traceLoop = () => {
    const step = cameraView === 'full' ? Math.max(1, Math.floor(s.samples.length / 400)) : 1;
    ctx.beginPath();
    if (cameraView === 'full') {
      for (let i = 0; i < s.samples.length; i += step) {
        const pt = s.samples[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
    } else {
      // Draw only visible track segments smoothly
      let started = false;
      for (let i = 0; i < s.samples.length; i++) {
        const pt = s.samples[i];
        const near =
          Math.abs(pt.x - camX) <= viewHalfW + 600 && Math.abs(pt.y - camY) <= viewHalfH + 600;
        if (near) {
          if (!started) {
            const prev = s.samples[(i - 1 + s.samples.length) % s.samples.length];
            ctx.moveTo(prev.x, prev.y);
            started = true;
          }
          ctx.lineTo(pt.x, pt.y);
        } else {
          started = false;
        }
      }
    }
  };

  // 1. Clean Highway Shoulder & Barriers
  traceLoop();
  ctx.strokeStyle = '#26303D';
  ctx.lineWidth = s.trackHalfWidth * 2 + 54;
  ctx.stroke();

  traceLoop();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = s.trackHalfWidth * 2 + 24;
  ctx.stroke();

  // Continuous White Track Limits
  traceLoop();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = s.trackHalfWidth * 2 + 10;
  ctx.stroke();

  // Pure Smooth Clean Tarmac Road (Zero hurdles, zero puddles, zero electric pads!)
  traceLoop();
  ctx.strokeStyle = '#171C26';
  ctx.lineWidth = s.trackHalfWidth * 2;
  ctx.stroke();

  // Subtle Dark Racing Groove
  traceLoop();
  ctx.strokeStyle = 'rgba(7, 9, 14, 0.5)';
  ctx.lineWidth = s.trackHalfWidth * 0.9;
  ctx.stroke();

  // Clean Highway Dashed Centerline
  traceLoop();
  ctx.save();
  ctx.setLineDash([44, 68]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Corner Red & White Kerbs (only when zoomed in)
  if (cameraView === 'action') {
    for (let i = 0; i < s.samples.length; i += 2) {
      const pt = s.samples[i];
      if (
        pt.curvature > 0.015 &&
        Math.abs(pt.x - camX) <= viewHalfW &&
        Math.abs(pt.y - camY) <= viewHalfH
      ) {
        const next = s.samples[(i + 2) % s.samples.length];
        const kerbColor = Math.floor(i / 2) % 2 === 0 ? '#DC2626' : '#F8FAFC';
        ctx.save();
        ctx.strokeStyle = kerbColor;
        ctx.lineWidth = 10;
        for (const side of [-1, 1]) {
          const offset = side * (s.trackHalfWidth + 4);
          ctx.beginPath();
          ctx.moveTo(pt.x + pt.nx * offset, pt.y + pt.ny * offset);
          ctx.lineTo(next.x + next.nx * offset, next.y + next.ny * offset);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // Pit Lane & Flagged Team Workshops (only drawn if near camera)
  const startPt = s.samples[0];
  if (
    cameraView === 'action' &&
    Math.abs(startPt.x - camX) <= viewHalfW + 1600 &&
    Math.abs(startPt.y - camY) <= viewHalfH + 1600
  ) {
    drawPitWorkshop(ctx, s, nowSec);
  }

  // Spatially-Culled Roadside Cities, Forests & Covered Stadium Grandstands
  if (cameraView === 'action') {
    const cs = s.grid.cellSize;
    const minCx = Math.floor((camX - viewHalfW - 450) / cs);
    const maxCx = Math.floor((camX + viewHalfW + 450) / cs);
    const minCy = Math.floor((camY - viewHalfH - 450) / cs);
    const maxCy = Math.floor((camY + viewHalfH + 450) / cs);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const k = cellKey(cx, cy);
        const propsInCell = s.grid.propCells.get(k);
        if (propsInCell) {
          drawSceneryProps(ctx, propsInCell);
        }
        const standsInCell = s.grid.standCells.get(k);
        if (standsInCell) {
          drawGrandstandsList(ctx, standsInCell, s.crowdExcitement, nowSec);
        }
      }
    }
  }

  // Starting Grid, Road Approach Chevrons & Grand Checkered Finish Line
  if (
    cameraView === 'full' ||
    (Math.abs(startPt.x - camX) <= viewHalfW + 1050 &&
      Math.abs(startPt.y - camY) <= viewHalfH + 1050)
  ) {
    if (cameraView === 'action') {
      const gridSlots = Math.min(16, s.cars.length);
      for (let g = 0; g < gridSlots; g++) {
        const perRow = s.cars.length <= 2 ? 2 : 4;
        const row = Math.floor(g / perRow);
        const col = g % perRow;
        const colsInRow = Math.min(perRow, gridSlots - row * perRow);
        const spread = s.trackHalfWidth * 1.24;
        const lane = colsInRow <= 1 ? 0 : -spread / 2 + (col / (colsInRow - 1)) * spread;
        const gDist = s.lapLength - row * 72 - 36;
        const gp = sampleCircuitAt(s.samples, s.lapLength, gDist);
        ctx.save();
        ctx.translate(gp.x + gp.nx * lane, gp.y + gp.ny * lane);
        ctx.rotate(Math.atan2(gp.ty, gp.tx));
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.62)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(22, -16);
        ctx.lineTo(36, -16);
        ctx.lineTo(36, 16);
        ctx.lineTo(22, 16);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(startPt.x, startPt.y);
    ctx.rotate(Math.atan2(startPt.ty, startPt.tx));

    // Approach "FINISH" road markings & glowing gold arrows
    ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
    for (const ax of [-195, -135, -75]) {
      ctx.beginPath();
      ctx.moveTo(ax - 18, -s.trackHalfWidth * 0.45);
      ctx.lineTo(ax + 12, 0);
      ctx.lineTo(ax - 18, s.trackHalfWidth * 0.45);
      ctx.lineTo(ax - 32, s.trackHalfWidth * 0.45);
      ctx.lineTo(ax - 2, 0);
      ctx.lineTo(ax - 32, -s.trackHalfWidth * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    // Victory post-finish carpet strip
    const carpetGrad = ctx.createLinearGradient(28, 0, 290, 0);
    carpetGrad.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
    carpetGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = carpetGrad;
    ctx.fillRect(28, -s.trackHalfWidth * 0.85, 260, s.trackHalfWidth * 1.7);

    // Painted vertical "FINISH" text on tarmac
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.font = `900 ${Math.round(s.trackHalfWidth * 0.34)}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillText('FINISH', 0, -95);
    ctx.restore();

    // Thick 4-column high-contrast Checkered Finish Line across full track width
    const cols = 4;
    const cellW = 14;
    const rows = Math.max(12, Math.round((s.trackHalfWidth * 2) / 18));
    const cellH = (s.trackHalfWidth * 2) / rows;
    const startX = -(cols * cellW) / 2;
    ctx.fillStyle = '#090D16';
    ctx.fillRect(startX - 4, -s.trackHalfWidth - 6, cols * cellW + 8, s.trackHalfWidth * 2 + 12);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? '#FFFFFF' : '#0B0F19';
        ctx.fillRect(startX + c * cellW, -s.trackHalfWidth + r * cellH, cellW + 0.4, cellH + 0.5);
      }
    }

    // Gold laser trigger edge on Finish Line
    ctx.fillStyle = s.winner ? '#34D399' : '#FACC15';
    ctx.fillRect(-3, -s.trackHalfWidth - 8, 6, s.trackHalfWidth * 2 + 16);
    ctx.restore();
  }

  // Warm Exhaust Particles (kept under cars)
  for (const sp of s.sparks) {
    if (sp.r >= 3.2) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - sp.life / sp.maxLife);
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const ranked = sortRaceCars(s.cars);
  const rankMap = new Map<string, number>();
  ranked.forEach((c, idx) => rankMap.set(c.id, idx + 1));

  // Open-Wheel Formula 1 Cars + Flagpoles (Every racer drawn in frame!)
  const fullScale = Math.max(5.5, (s.bounds.maxX - s.bounds.minX) * 0.00075);
  const carScale =
    cameraView === 'full' ? fullScale : Math.max(1.28, Math.min(2.6, 0.72 / Math.max(0.14, zoom)));
  for (const car of s.cars) {
    const pt = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);

    const jitter = !s.raceStarted ? Math.sin(performance.now() * 0.05 + car.wavePhase) * 0.7 : 0;
    const cx = pt.x + pt.nx * (car.lane + jitter);
    const cy = pt.y + pt.ny * (car.lane + jitter);
    const heading = Math.atan2(pt.ty, pt.tx);
    const { body: bodyColor, accent: accentColor } = getCarPalette(car.country);
    const rank = rankMap.get(car.id) ?? 1;
    const isLeader = rank === 1;
    const isWatched = car.id === watchedCode;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(carScale, carScale);

    ctx.save();
    ctx.rotate(heading);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(-32, -16, 68, 32, 6);
    ctx.fill();

    // Open-Wheel Tires
    const drawTire = (tx: number, ty: number, w: number, h: number) => {
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.roundRect(tx - w / 2, ty - h / 2, w, h, 2);
      ctx.fill();
      ctx.strokeStyle = car.tireAccent;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(tx - w / 2 + 2, ty - h / 2 + 1.5, w - 4, h - 3);
    };
    drawTire(18, -14, 12, 7);
    drawTire(18, 14, 12, 7);
    drawTire(-20, -15, 14, 8.5);
    drawTire(-20, 15, 14, 8.5);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, -12);
    ctx.lineTo(18, 12);
    ctx.moveTo(-20, -12);
    ctx.lineTo(-20, 12);
    ctx.stroke();

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(28, -16, 7, 32);
    ctx.fillStyle = accentColor;
    ctx.fillRect(33, -16, 2.5, 32);

    // Tapered F1 Monocoque
    const bodyGrad = ctx.createLinearGradient(0, -11, 0, 11);
    bodyGrad.addColorStop(0, bodyColor);
    bodyGrad.addColorStop(0.55, bodyColor);
    bodyGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = isWatched ? '#22D3EE' : isLeader ? '#FACC15' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = isLeader || isWatched ? 1.8 : 1;

    ctx.beginPath();
    ctx.moveTo(-26, -7);
    ctx.lineTo(-10, -11);
    ctx.lineTo(6, -10);
    ctx.lineTo(12, -4.5);
    ctx.lineTo(32, -2.5);
    ctx.lineTo(32, 2.5);
    ctx.lineTo(12, 4.5);
    ctx.lineTo(6, 10);
    ctx.lineTo(-10, 11);
    ctx.lineTo(-26, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#090D16';
    ctx.fillRect(2, -9.5, 5, 3);
    ctx.fillRect(2, 6.5, 5, 3);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-20, -1.6, 48, 3.2);

    ctx.fillStyle = '#0B0F19';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 7.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(-4, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-1, 0, 5.2, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.stroke();

    ctx.fillStyle = '#0B0F19';
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.fillRect(-32, -14, 7, 28);
    ctx.strokeRect(-32, -14, 7, 28);

    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-33, -2, 2, 4);
    ctx.restore();

    // Flagpole + Waving Rectangular Flag
    const poleX = -2;
    const poleY = -3;
    const poleTopY = poleY - 34;

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(poleX, poleY);
    ctx.lineTo(poleX, poleTopY);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(poleX, poleTopY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const rectFlag = getRectFlagBitmap(car.country.code);
    const flagW = 28;
    const flagH = 18;
    const slices = 5;
    const sSrc = rectFlag.width / slices;
    const sDst = flagW / slices;
    for (let sl = 0; sl < slices; sl++) {
      const waveY = Math.sin(car.wavePhase + sl * 0.9) * (sl * 0.55);
      ctx.drawImage(
        rectFlag,
        rectFlag.width - (sl + 1) * sSrc,
        0,
        sSrc,
        rectFlag.height,
        poleX - (sl + 1) * sDst,
        poleTopY + 2 + waveY,
        sDst + 0.6,
        flagH
      );
    }

    ctx.font = '800 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    const statusText =
      car.pitState === 'pitting'
        ? 'PIT: NEW TIRES'
        : `#${rank} ${s.cars.length <= 12 ? car.country.name : car.country.code}`;
    ctx.strokeStyle = 'rgba(6, 9, 24, 0.96)';
    ctx.lineWidth = 3.2;
    ctx.strokeText(statusText, poleX - 8, poleTopY - 7);
    ctx.fillStyle =
      car.pitState === 'pitting' ? '#34D399' : isLeader ? '#FDE047' : '#F8FAFC';
    ctx.fillText(statusText, poleX - 8, poleTopY - 7);

    ctx.restore();
  }

  // Elevated Railway Track Overpasses & Moving Trains OVER the Highway (Cars drive underneath!)
  if (cameraView === 'action') {
    for (const rb of s.railBridges) {
      if (Math.abs(rb.x - camX) <= viewHalfW + 800 && Math.abs(rb.y - camY) <= viewHalfH + 800) {
        drawRailwayOverpass(ctx, rb, s.trackHalfWidth, nowSec);
      }
    }
  }

  // Grand Overhead Checkered Finish Line Gantry / Arch (Drawn OVER cars so racers speed underneath!)
  if (
    cameraView === 'full' ||
    (Math.abs(startPt.x - camX) <= viewHalfW + 1050 &&
      Math.abs(startPt.y - camY) <= viewHalfH + 1050)
  ) {
    drawFinishGantry(ctx, startPt, s, nowSec);
  }

  // Celebratory Finish-Line Fireworks Bursts (Rendered in foreground above track & gantry)
  for (const sp of s.sparks) {
    if (sp.r < 3.2) continue;
    ctx.save();
    const alpha = Math.max(0, 1 - sp.life / sp.maxLife);
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r * 1.9, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.34;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Subtle Speed Wind Streaks
  if (s.raceStarted && cameraView === 'action') {
    for (const st of s.streaks) {
      ctx.save();
      ctx.strokeStyle = `rgba(226, 232, 240, ${st.alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.len, st.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (cameraView === 'action') {
    drawCircuitMinimap(ctx, s, canvasH);
  }
}

function drawFinishGantry(
  ctx: CanvasRenderingContext2D,
  startPt: TrackSample,
  s: RaceSimState,
  nowSec: number
) {
  const halfSpan = s.trackHalfWidth + 24;
  ctx.save();
  ctx.translate(startPt.x, startPt.y);
  ctx.rotate(Math.atan2(startPt.ty, startPt.tx));

  // Gantry shadow on track
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.fillRect(-10, -halfSpan, 34, halfSpan * 2);

  // Heavy side steel support towers
  for (const side of [-1, 1]) {
    const py = side * halfSpan;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.fillRect(-20, py - 18, 40, 36);
    ctx.strokeRect(-20, py - 18, 40, 36);
  }

  // Overhead Checkered Bridge Truss spanning full track
  ctx.fillStyle = '#0B122B';
  ctx.strokeStyle = s.winner ? '#34D399' : '#FACC15';
  ctx.lineWidth = 3;
  ctx.fillRect(-18, -halfSpan, 36, halfSpan * 2);
  ctx.strokeRect(-18, -halfSpan, 36, halfSpan * 2);

  // Illuminated Scoreboard Banner inside gantry
  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.font = '900 18px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bannerLabel = s.winner
    ? `WINNER: ${s.winner.country.code}  ·  ${s.finishOrder.length}/${s.cars.length}`
    : 'VORTEXIA FINISH LINE';
  ctx.fillStyle = s.winner ? '#34D399' : '#FDE047';
  ctx.fillText(bannerLabel, 0, 0);
  ctx.restore();

  // Animated Waving Checkered Flags on gantry crown & both towers
  const flagPositions = [-halfSpan, -halfSpan * 0.45, halfSpan * 0.45, halfSpan];
  for (let fp = 0; fp < flagPositions.length; fp++) {
    const fy = flagPositions[fp];
    const wave = Math.sin(nowSec * (s.winner ? 14 : 6) + fp * 1.3) * 4;
    ctx.save();
    ctx.translate(0, fy);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-2, -2, 4, 26);
    // Checkered 3x2 flag fluttering from gantry
    const cw = 9;
    const ch = 7;
    for (let cx = 0; cx < 3; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        ctx.fillStyle = (cx + cy) % 2 === 0 ? '#FFFFFF' : '#090D16';
        ctx.fillRect(2 + cx * cw, -8 + cy * ch + wave * (cx * 0.35), cw, ch);
      }
    }
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(2, -8 + wave * 0.35, cw * 3, ch * 2);
    ctx.restore();
  }

  // Celebratory Finish Crossing Shockwave & Floodlights
  if (s.winner) {
    if (s.finishPhaseTimer < 1.8) {
      const p = s.finishPhaseTimer / 1.8;
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.globalAlpha = (1 - p) * 0.78;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 50 + p * (halfSpan * 1.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    const pulse = 0.16 + 0.1 * Math.sin(nowSec * 12);
    const beamGrad = ctx.createLinearGradient(0, 0, 260, 0);
    beamGrad.addColorStop(0, `rgba(52, 211, 153, ${pulse})`);
    beamGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, -halfSpan * 0.9, 260, halfSpan * 1.8);
    ctx.restore();
  }

  ctx.restore();
}

function drawSceneryProps(ctx: CanvasRenderingContext2D, props: SceneryProp[]) {
  for (const p of props) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'building') {
      ctx.rotate(p.angle);
      // City Skyscraper Footprint + Roof Shadow + Lit Windows
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(-p.w / 2 + 12, -p.h / 2 + 14, p.w, p.h);

      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);

      // Rooftop Helipad / Penthouse Trim
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(-p.w * 0.36, -p.h * 0.36, p.w * 0.72, p.h * 0.72);
      ctx.fillStyle = p.accent;
      ctx.fillRect(-p.w / 2 + 6, -p.h / 2 + 6, p.w - 12, 5);
      for (let wx = -p.w / 2 + 16; wx < p.w / 2 - 14; wx += 22) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
        ctx.fillRect(wx, p.h / 2 - 12, 10, 5);
      }
    } else if (p.kind === 'tree') {
      // Multi-layer Forest Pine/Oak Tree Canopy
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.arc(7, 8, p.w * 0.56, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.w * 0.56, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(-p.w * 0.14, -p.w * 0.14, p.w * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Highway Streetlamp Glow
      ctx.fillStyle = 'rgba(253, 230, 138, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRailwayOverpass(
  ctx: CanvasRenderingContext2D,
  rb: RailBridge,
  trackHalfWidth: number,
  nowSec: number
) {
  const span = trackHalfWidth * 2 + 950;
  ctx.save();
  ctx.translate(rb.x, rb.y);
  ctx.rotate(rb.angle);

  // Underpass Shadow across the highway below
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(-span / 2, -48, span, 112);

  // Concrete Bridge Abutments outside the road limits
  ctx.fillStyle = '#334155';
  ctx.fillRect(-span / 2, -52, span / 2 - trackHalfWidth - 26, 104);
  ctx.fillRect(trackHalfWidth + 26, -52, span / 2 - trackHalfWidth - 26, 104);

  // Elevated Steel Railway Bridge Deck
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3;
  ctx.fillRect(-span / 2, -36, span, 72);
  ctx.strokeRect(-span / 2, -36, span, 72);

  // Wooden Railroad Ties & Twin Steel Rails
  ctx.fillStyle = '#78350F';
  for (let tx = -span / 2 + 12; tx < span / 2; tx += 22) {
    ctx.fillRect(tx, -24, 9, 48);
  }
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(-span / 2, -16, span, 4);
  ctx.fillRect(-span / 2, 12, span, 4);

  // Steel Girder Side Trusses
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(-span / 2, -36, span, 6);
  ctx.strokeRect(-span / 2, 30, span, 6);

  // Animated Moving Train crossing overhead across the railway bridge!
  const cycleSpan = span + 700;
  const trainX = ((nowSec * rb.trainSpeed + rb.trainPhase * 280) % cycleSpan) - cycleSpan / 2;
  const carCount = 4;
  const carW = 110;
  const carGap = 10;

  for (let c = 0; c < carCount; c++) {
    const cx = trainX - c * (carW + carGap);
    ctx.fillStyle = c === 0 ? rb.trainColor : '#E2E8F0';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - carW / 2, -20, carW, 40, c === 0 ? 10 : 4);
    ctx.fill();
    ctx.stroke();

    // Train roof stripe & passenger windows
    ctx.fillStyle = c === 0 ? '#FACC15' : rb.trainColor;
    ctx.fillRect(cx - carW / 2 + 8, -5, carW - 16, 10);
    if (c === 0) {
      // Locomotive Front Headlight Beam
      const beam = ctx.createLinearGradient(cx + carW / 2, 0, cx + carW / 2 + 150, 0);
      beam.addColorStop(0, 'rgba(254, 240, 138, 0.72)');
      beam.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(cx + carW / 2, -10);
      ctx.lineTo(cx + carW / 2 + 150, -34);
      ctx.lineTo(cx + carW / 2 + 150, 34);
      ctx.lineTo(cx + carW / 2, 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawPitWorkshop(ctx: CanvasRenderingContext2D, s: RaceSimState, nowSec: number) {
  const { samples, lapLength, pitEntryDist, pitExitDist, pitLaneOffset, pitBayWidth } = s;

  const pitPts: Array<{ x: number; y: number }> = [];
  const totalSpan = lapLength - pitEntryDist + pitExitDist;
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const d = (pitEntryDist + (i / steps) * totalSpan) % lapLength;
    const pt = sampleCircuitAt(samples, lapLength, d);
    const edgeT = i < 6 ? i / 6 : i > steps - 6 ? (steps - i) / 6 : 1;
    const off = pitLaneOffset * (0.68 + 0.32 * edgeT);
    pitPts.push({ x: pt.x + pt.nx * off, y: pt.y + pt.ny * off });
  }

  ctx.save();
  ctx.beginPath();
  pitPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 76;
  ctx.stroke();

  ctx.beginPath();
  pitPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 62;
  ctx.stroke();

  ctx.beginPath();
  pitPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.setLineDash([20, 18]);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const bayW = pitBayWidth;
  const compact = bayW < 105;

  for (const car of s.cars) {
    const boxPt = sampleCircuitAt(samples, lapLength, car.pitBoxDist);
    const wx = boxPt.x + boxPt.nx * (pitLaneOffset - 84);
    const wy = boxPt.y + boxPt.ny * (pitLaneOffset - 84);
    const { body: teamBody, accent: teamAccent } = getCarPalette(car.country);
    const isCarPitting = car.pitState === 'pitting';
    const isCarEntering = car.pitState === 'entering';

    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(Math.atan2(boxPt.ty, boxPt.tx));

    ctx.strokeStyle = isCarPitting ? '#34D399' : isCarEntering ? '#FACC15' : teamBody;
    ctx.lineWidth = isCarPitting ? 3 : 2;
    ctx.strokeRect(-bayW * 0.42, 62, bayW * 0.84, 42);

    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = isCarPitting ? '#34D399' : isCarEntering ? '#FACC15' : '#475569';
    ctx.lineWidth = isCarPitting ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(-bayW / 2, -56, bayW, 96, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = teamBody;
    ctx.fillRect(-bayW / 2 + 2, -54, bayW - 4, 14);
    ctx.fillStyle = teamAccent;
    ctx.fillRect(-bayW / 2 + 2, -41, bayW - 4, 3);

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-bayW * 0.42, -32, bayW * 0.84, 58);

    const rectFlag = getRectFlagBitmap(car.country.code);
    const fW = compact ? 26 : 38;
    const fH = compact ? 17 : 24;
    ctx.fillStyle = '#090D16';
    ctx.fillRect(-fW / 2 - 2, -84, fW + 4, fH + 4);
    ctx.drawImage(rectFlag, -fW / 2, -82, fW, fH);
    ctx.strokeStyle = isCarPitting ? '#34D399' : '#E2E8F0';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-fW / 2 - 2, -84, fW + 4, fH + 4);

    ctx.fillStyle = isCarPitting ? '#34D399' : '#F8FAFC';
    ctx.font = compact ? '800 9px "Outfit", sans-serif' : '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(compact ? car.country.code : `${car.country.code} GARAGE`, 0, -44);

    const crewOut = isCarPitting ? 46 + Math.sin(nowSec * 16) * 5 : isCarEntering ? 22 : 4;
    const mechSpread = compact ? 10 : 18;
    for (let m = -1; m <= 1; m += 2) {
      ctx.fillStyle = teamBody;
      ctx.beginPath();
      ctx.arc(m * mechSpread, 14 + crewOut, compact ? 4.5 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(m * mechSpread, 14 + crewOut, compact ? 2.2 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawGrandstandsList(
  ctx: CanvasRenderingContext2D,
  stands: Grandstand[],
  ex: number,
  nowSec: number
) {
  for (const g of stands) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);

    // Safety Catch-Fence Mesh
    const fenceY = -g.depth / 2 - 14;
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-g.width / 2, fenceY);
    ctx.lineTo(g.width / 2, fenceY);
    ctx.stroke();

    // Concrete Base & Bleachers
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-g.width / 2, -g.depth / 2, g.width, g.depth, 10);
    ctx.fill();
    ctx.stroke();

    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#1E293B' : '#172033';
      ctx.fillRect(-g.width / 2 + 8, -g.depth / 2 + 8 + r * 25, g.width - 16, 19);
    }

    const bounceAmp = 2 + ex * 6;
    for (const sp of g.spectators) {
      const sx = -g.width / 2 + 18 + sp.col * 26;
      const jump = Math.abs(Math.sin(nowSec * (4 + ex * 7) + sp.phase)) * bounceAmp;
      const sy = -g.depth / 2 + 18 + sp.row * 25 - jump;

      ctx.fillStyle = sp.shirt;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(sx, sy - 4, 2.7, 0, Math.PI * 2);
      ctx.fill();

      if (sp.hasFlag) {
        const waveAngle = Math.sin(nowSec * (5 + ex * 8) + sp.phase) * (0.35 + ex * 0.55);
        ctx.save();
        ctx.translate(sx + 4, sy - 3);
        ctx.rotate(waveAngle);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -12);
        ctx.stroke();
        ctx.fillStyle = sp.flagColor;
        ctx.fillRect(0, -12, 9, 6);
        ctx.restore();
      }
    }

    // Overhead Covered Stadium Shade Roof
    const shadeGrad = ctx.createLinearGradient(0, -g.depth / 2, 0, g.depth / 2);
    shadeGrad.addColorStop(0, 'rgba(30, 41, 59, 0.34)');
    shadeGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.52)');
    shadeGrad.addColorStop(1, 'rgba(226, 232, 240, 0.28)');
    ctx.fillStyle = shadeGrad;
    ctx.beginPath();
    ctx.roundRect(-g.width / 2 - 4, -g.depth / 2 + 10, g.width + 8, g.depth * 0.88, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-g.width / 2 - 4, -g.depth / 2 + 10, g.width + 8, g.depth * 0.88);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
    ctx.lineWidth = 1.6;
    for (let tx = -g.width / 2 + 44; tx < g.width / 2; tx += 74) {
      ctx.beginPath();
      ctx.moveTo(tx, -g.depth / 2 + 10);
      ctx.lineTo(tx, g.depth / 2 + 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
    for (let lx = -g.width / 2 + 36; lx <= g.width / 2 - 36; lx += 120) {
      ctx.beginPath();
      ctx.arc(lx, g.depth / 2 - 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawCircuitMinimap(
  ctx: CanvasRenderingContext2D,
  s: RaceSimState,
  canvasH: number = CANVAS_H
) {
  const boxW = 165;
  const boxH = 104;
  const bx = CANVAS_W - boxW - 14;
  const by = canvasH - boxH - 14;

  const wSpan = Math.max(1000, s.bounds.maxX - s.bounds.minX);
  const hSpan = Math.max(800, s.bounds.maxY - s.bounds.minY);
  const scale = Math.min((boxW - 22) / wSpan, (boxH - 22) / hSpan);
  const cx = (s.bounds.minX + s.bounds.maxX) * 0.5;
  const cy = (s.bounds.minY + s.bounds.maxY) * 0.5;

  ctx.save();
  ctx.fillStyle = 'rgba(6, 9, 24, 0.84)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.translate(bx + boxW / 2, by + boxH / 2);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  const step = Math.max(1, Math.floor(s.samples.length / 180));
  ctx.beginPath();
  for (let i = 0; i < s.samples.length; i += step) {
    const pt = s.samples[i];
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 3.2 / scale;
  ctx.stroke();

  const sorted = sortRaceCars(s.cars);
  const leaderId = sorted[0]?.id;

  // Finish Line marker on HUD minimap
  const mStart = s.samples[0];
  ctx.save();
  ctx.translate(mStart.x, mStart.y);
  ctx.rotate(Math.atan2(mStart.ty, mStart.tx));
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(-4 / scale, -10 / scale, 8 / scale, 20 / scale);
  ctx.restore();

  for (const car of s.cars) {
    const pt = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);
    const { body } = getCarPalette(car.country);
    const isLeader = car.id === leaderId;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, (isLeader ? 5.2 : 3.6) / scale, 0, Math.PI * 2);
    ctx.fillStyle = isLeader ? '#FACC15' : body;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2 / scale;
    ctx.stroke();
  }

  ctx.restore();
}

function drawFormulaMiniCam(
  ctx: CanvasRenderingContext2D,
  s: RaceSimState,
  watchedCode: string | null,
  pipMode: 'chase' | 'radar'
) {
  const nowSec = performance.now() * 0.001;
  const sorted = sortRaceCars(s.cars);
  const focusCar =
    (watchedCode ? s.cars.find((c) => c.id === watchedCode) : undefined) ?? sorted[0];
  const isFinishLineCam = Boolean(s.winner && !s.showWinnerModal && !watchedCode && pipMode === 'chase');

  ctx.fillStyle = '#071713';
  ctx.fillRect(0, 0, PIP_W, PIP_H);

  if (pipMode === 'radar') {
    const wSpan = Math.max(1200, s.bounds.maxX - s.bounds.minX + 520);
    const hSpan = Math.max(820, s.bounds.maxY - s.bounds.minY + 460);
    const scale = Math.min((PIP_W - 28) / wSpan, (PIP_H - 28) / hSpan);
    const cx = (s.bounds.minX + s.bounds.maxX) * 0.5;
    const cy = (s.bounds.minY + s.bounds.maxY) * 0.5;

    ctx.save();
    ctx.translate(PIP_W / 2, PIP_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const step = Math.max(1, Math.floor(s.samples.length / 220));
    ctx.beginPath();
    for (let i = 0; i < s.samples.length; i += step) {
      const pt = s.samples[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 7 / scale;
    ctx.stroke();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3 / scale;
    ctx.stroke();

    // Checkered Finish Marker in Radar
    const fPt = s.samples[0];
    ctx.save();
    ctx.translate(fPt.x, fPt.y);
    ctx.rotate(Math.atan2(fPt.ty, fPt.tx));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-3 / scale, -9 / scale, 6 / scale, 18 / scale);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-1.5 / scale, -9 / scale, 3 / scale, 18 / scale);
    ctx.restore();

    for (const car of s.cars) {
      const pt = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);
      const { body } = getCarPalette(car.country);
      const isFocus = focusCar && car.id === focusCar.id;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (isFocus ? 6.2 : 3.6) / scale, 0, Math.PI * 2);
      ctx.fillStyle = isFocus ? '#FACC15' : body;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2 / scale;
      ctx.stroke();
    }
    ctx.restore();
  } else if (focusCar) {
    const startPt = s.samples[0];
    const focusSample = isFinishLineCam
      ? startPt
      : sampleCircuitAt(s.samples, s.lapLength, focusCar.totalDist + 45);
    const camX = isFinishLineCam
      ? startPt.x
      : focusSample.x + focusSample.nx * focusCar.lane * 0.5;
    const camY = isFinishLineCam
      ? startPt.y
      : focusSample.y + focusSample.ny * focusCar.lane * 0.5;
    const zoom = isFinishLineCam ? 0.24 : 0.25;
    const viewHalfW = (PIP_W / zoom) * 0.65;
    const viewHalfH = (PIP_H / zoom) * 0.65;

    ctx.save();
    ctx.translate(PIP_W / 2, PIP_H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const traceLocal = () => {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < s.samples.length; i++) {
        const pt = s.samples[i];
        if (Math.abs(pt.x - camX) <= viewHalfW + 300 && Math.abs(pt.y - camY) <= viewHalfH + 300) {
          if (!started) {
            const prev = s.samples[(i - 1 + s.samples.length) % s.samples.length];
            ctx.moveTo(prev.x, prev.y);
            started = true;
          }
          ctx.lineTo(pt.x, pt.y);
        } else {
          started = false;
        }
      }
    };

    traceLocal();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = s.trackHalfWidth * 2 + 24;
    ctx.stroke();

    traceLocal();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = s.trackHalfWidth * 2 + 8;
    ctx.stroke();

    traceLocal();
    ctx.strokeStyle = '#171C26';
    ctx.lineWidth = s.trackHalfWidth * 2;
    ctx.stroke();

    traceLocal();
    ctx.save();
    ctx.setLineDash([40, 62]);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Draw Checkered Finish Line on Mini Cam whenever in view
    if (
      Math.abs(startPt.x - camX) <= viewHalfW + 300 &&
      Math.abs(startPt.y - camY) <= viewHalfH + 300
    ) {
      ctx.save();
      ctx.translate(startPt.x, startPt.y);
      ctx.rotate(Math.atan2(startPt.ty, startPt.tx));
      const rows = 12;
      const cellH = (s.trackHalfWidth * 2) / rows;
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < rows; r++) {
          ctx.fillStyle = (c + r) % 2 === 0 ? '#FFFFFF' : '#090D16';
          ctx.fillRect(-18 + c * 12, -s.trackHalfWidth + r * cellH, 12, cellH + 0.5);
        }
      }
      ctx.fillStyle = s.winner ? '#34D399' : '#FACC15';
      ctx.fillRect(-2, -s.trackHalfWidth - 6, 4, s.trackHalfWidth * 2 + 12);
      ctx.restore();
    }

    for (const car of s.cars) {
      const pt = sampleCircuitAt(s.samples, s.lapLength, car.totalDist);
      const wx = pt.x + pt.nx * car.lane;
      const wy = pt.y + pt.ny * car.lane;
      if (Math.abs(wx - camX) > viewHalfW + 120 || Math.abs(wy - camY) > viewHalfH + 120) {
        continue;
      }
      const { body, accent } = getCarPalette(car.country);
      const heading = Math.atan2(pt.ty, pt.tx);
      const isFocus = car.id === focusCar.id;
      const carScale = 1.9;

      ctx.save();
      ctx.translate(wx, wy);
      ctx.scale(carScale, carScale);

      ctx.save();
      ctx.rotate(heading);
      ctx.fillStyle = body;
      ctx.strokeStyle = isFocus ? '#FACC15' : '#FFFFFF';
      ctx.lineWidth = isFocus ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(-24, -10, 52, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-16, -2, 36, 4);
      ctx.restore();

      const rectFlag = getRectFlagBitmap(car.country.code);
      const wave = Math.sin(nowSec * 9 + car.wavePhase) * 1.4;
      ctx.drawImage(rectFlag, -13, -34 + wave, 26, 17);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-13, -34 + wave, 26, 17);

      ctx.font = '800 10px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(6, 9, 24, 0.96)';
      ctx.lineWidth = 3;
      ctx.strokeText(car.country.code, 0, -40);
      ctx.fillStyle = isFocus ? '#FDE047' : '#F8FAFC';
      ctx.fillText(car.country.code, 0, -40);
      ctx.restore();
    }

    ctx.restore();
  }

  // Broadcast Mini-Screen Bottom Overlay Bar
  if (focusCar) {
    const rank = sorted.findIndex((c) => c.id === focusCar.id) + 1;
    const pct = Math.max(0, Math.min(100, Math.round((focusCar.totalDist / s.totalRaceDist) * 100)));
    ctx.fillStyle = 'rgba(6, 9, 24, 0.78)';
    ctx.fillRect(0, PIP_H - 24, PIP_W, 24);
    ctx.font = '800 11px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(`#${rank} ${focusCar.country.name}`, 8, PIP_H - 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#67E8F9';
    ctx.fillText(`${focusCar.kmh} km/h · ${pct}%`, PIP_W - 8, PIP_H - 8);
  }
}

