import { CountryDef } from '../data/countries';

export type ArenaMode = 'vortex' | 'gate';

export interface FlagEntity {
  id: string;
  country: CountryDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hasShield: boolean;
  shieldPulse: number;
  eliminated: boolean;
  eliminatedAt?: number;
  rank?: number;
  knockouts: number;
  lastHitBy?: string;
}

export interface EliminatedRecord {
  country: CountryDef;
  placement: number; // e.g. 50 = first out, 2 = runner-up
  eliminatedAt: number;
  eliminatedBy?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ShieldOrb {
  x: number;
  y: number;
  r: number;
  pulse: number;
}

export interface ArenaEvents {
  onBounce?: (intensity: number) => void;
  onShieldPickup?: () => void;
  onShieldBreak?: () => void;
  onEliminate?: (record: EliminatedRecord, remainingCount: number) => void;
  onWinner?: (winner: FlagEntity, elapsed: number) => void;
}

export const ARENA_RADIUS = 244;
export const ARENA_SIDES = 12;
export const ARENA_APOTHEM = ARENA_RADIUS * Math.cos(Math.PI / ARENA_SIDES);
export const CENTER_WHEEL_RADIUS = 46;
export const BAFFLE_COUNT = 6;
export const BAFFLE_LENGTH = 54;
export const BAFFLE_RADIUS = 5;
export const BAFFLE_TILT = 0.28;
export const GATE_FACET_INDEX = 1; // Facet #1 opens as Plasma Escape Breach in Gate mode
export const GATE_HALF_ANGLE = (Math.PI * 2) / ARENA_SIDES / 2;

export interface EliminatingFlagAnim {
  country: CountryDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  record: EliminatedRecord;
}

export interface ArenaState {
  flags: FlagEntity[];
  eliminatingFlags: EliminatingFlagAnim[];
  eliminated: EliminatedRecord[];
  particles: Particle[];
  shockwaves: Shockwave[];
  callouts: FloatingCallout[];
  shieldOrb: ShieldOrb | null;
  ringAngle: number;
  centerAngle: number;
  elapsed: number;
  shieldSpawnTimer: number;
  mode: ArenaMode;
  winner: FlagEntity | null;
  totalCountries: number;
}

function getFlagRadiusForCount(count: number): number {
  if (count <= 3) return 30;
  if (count <= 6) return 26;
  if (count <= 16) return 22;
  if (count <= 25) return 20;
  if (count <= 36) return 18.5;
  if (count <= 50) return 17;
  return 15.2;
}

export function createArenaState(roster: CountryDef[], mode: ArenaMode): ArenaState {
  const count = roster.length;
  const flagR = getFlagRadiusForCount(count);
  const flags: FlagEntity[] = [];

  // Place flags in concentric rings inside the 12-sided reactor annulus so none overlap at start
  const minR = CENTER_WHEEL_RADIUS + flagR + 24;
  const maxR = ARENA_APOTHEM - flagR - 18;

  // Pick 3 random indices to start with a green shield
  const shieldIndices = new Set<number>();
  const shieldTarget = Math.min(3, Math.max(1, Math.floor(count / 12)));
  while (shieldIndices.size < shieldTarget && shieldIndices.size < count) {
    shieldIndices.add(Math.floor(Math.random() * count));
  }

  // Spiral phyllotaxis placement inside annulus
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const radius = Math.sqrt(minR * minR + t * (maxR * maxR - minR * minR));
    const angle = i * goldenAngle + Math.random() * 0.25;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const speed = 130 + Math.random() * 140;
    const vAngle = Math.random() * Math.PI * 2;

    flags.push({
      id: roster[i].code,
      country: roster[i],
      x,
      y,
      vx: Math.cos(vAngle) * speed,
      vy: Math.sin(vAngle) * speed,
      r: flagR,
      hasShield: shieldIndices.has(i),
      shieldPulse: Math.random() * Math.PI * 2,
      eliminated: false,
      knockouts: 0,
    });
  }

  // Quick relaxation pass so initial circles never overlap
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        const a = flags[i];
        const b = flags[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = a.r + b.r + 2;
        if (dist < minDist) {
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      // Clamp to annulus
      const f = flags[i];
      const d = Math.hypot(f.x, f.y) || 0.001;
      if (d < minR) {
        f.x = (f.x / d) * minR;
        f.y = (f.y / d) * minR;
      } else if (d > maxR) {
        f.x = (f.x / d) * maxR;
        f.y = (f.y / d) * maxR;
      }
    }
  }

  return {
    flags,
    eliminatingFlags: [],
    eliminated: [],
    particles: [],
    shockwaves: [],
    callouts: [],
    shieldOrb: null,
    ringAngle: 0.15,
    centerAngle: 0,
    elapsed: 0,
    shieldSpawnTimer: 3.2,
    mode,
    winner: null,
    totalCountries: count,
  };
}

function normalizeAngle(a: number): number {
  let res = a % (Math.PI * 2);
  if (res < 0) res += Math.PI * 2;
  return res;
}

function spawnBurst(
  state: ArenaState,
  x: number,
  y: number,
  colors: string[],
  count: number,
  speedScale = 1
) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 190) * speedScale;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 3.5,
      color: colors[i % colors.length],
      alpha: 1,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.4,
    });
  }
}

export function stepArena(state: ArenaState, dtRaw: number, events: ArenaEvents) {
  if (state.winner) {
    // Still animate celebratory particles when winner exists
    if (Math.random() < dtRaw * 2.2) {
      const a = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 140;
      const palette = [
        '#FBBF24',
        '#22D3EE',
        ...(state.winner.country.colors.filter(Boolean) as string[]),
      ];
      spawnBurst(state, Math.cos(a) * dist, Math.sin(a) * dist, palette, 14, 0.9);
    }
    updateEffects(state, dtRaw);
    state.ringAngle += 0.35 * dtRaw;
    state.centerAngle -= 0.9 * dtRaw;
    return;
  }

  const dt = Math.min(dtRaw, 0.033);
  state.elapsed += dt;

  const activeFlags = state.flags.filter((f) => !f.eliminated);
  const remaining = activeFlags.length;

  // Sudden death acceleration as fewer flags remain
  const suddenDeathBoost = remaining <= 5 ? 1.38 : remaining <= 12 ? 1.15 : 1.0;
  const ringOmega = 0.78 * suddenDeathBoost;
  const centerOmega = -1.75 * suddenDeathBoost;

  // Shield orb spawning
  const shieldedCount = activeFlags.filter((f) => f.hasShield).length;
  if (!state.shieldOrb && shieldedCount < 3 && remaining > 3) {
    state.shieldSpawnTimer -= dt;
    if (state.shieldSpawnTimer <= 0) {
      const orbAngle = Math.random() * Math.PI * 2;
      const orbDist = CENTER_WHEEL_RADIUS + 48 + Math.random() * (ARENA_RADIUS - CENTER_WHEEL_RADIUS - 110);
      state.shieldOrb = {
        x: Math.cos(orbAngle) * orbDist,
        y: Math.sin(orbAngle) * orbDist,
        r: 12,
        pulse: 0,
      };
      state.shieldSpawnTimer = 4.2 + Math.random() * 2.5;
    }
  }
  if (state.shieldOrb) {
    state.shieldOrb.pulse += dt * 5;
  }

  const substeps = 4;
  const subDt = dt / substeps;
  const gravity = 250;
  const airDamping = Math.pow(0.994, subDt * 60);

  for (let step = 0; step < substeps; step++) {
    state.ringAngle += ringOmega * subDt;
    state.centerAngle += centerOmega * subDt;

    const sectorStep = (Math.PI * 2) / ARENA_SIDES;
    const cosNegRing = Math.cos(-state.ringAngle);
    const sinNegRing = Math.sin(-state.ringAngle);

    for (let i = 0; i < state.flags.length; i++) {
      const f = state.flags[i];
      if (f.eliminated) continue;

      f.shieldPulse += subDt * 4.5;
      f.vy += gravity * subDt;
      f.vx *= airDamping;
      f.vy *= airDamping;

      // Subtle kinetic boost if nearly stalled at bottom
      const speedSq = f.vx * f.vx + f.vy * f.vy;
      if (speedSq < 3500 && f.y > 60) {
        f.vx += (Math.random() - 0.5) * 40;
        f.vy -= 55 * subDt;
      }

      // Clamp max velocity to keep collisions clean
      const speed = Math.sqrt(speedSq);
      if (speed > 620) {
        const s = 620 / speed;
        f.vx *= s;
        f.vy *= s;
      }

      f.x += f.vx * subDt;
      f.y += f.vy * subDt;

      // Shield orb pickup check
      if (state.shieldOrb && !f.hasShield) {
        const odx = f.x - state.shieldOrb.x;
        const ody = f.y - state.shieldOrb.y;
        const od = Math.hypot(odx, ody);
        if (od < f.r + state.shieldOrb.r) {
          f.hasShield = true;
          spawnBurst(state, state.shieldOrb.x, state.shieldOrb.y, ['#22C55E', '#4ADE80', '#BBF7D0'], 14, 0.85);
          state.shockwaves.push({
            x: state.shieldOrb.x,
            y: state.shieldOrb.y,
            r: 10,
            maxR: 48,
            color: '#4ADE80',
            alpha: 0.9,
          });
          state.shieldOrb = null;
          events.onShieldPickup?.();
        }
      }

      // 1. Collide with 6 canted Vortexia turbine deflector blades
      for (let b = 0; b < BAFFLE_COUNT; b++) {
        const bAngle = state.ringAngle + (b * 2 * Math.PI * 2) / ARENA_SIDES;
        const tipAngle = bAngle + BAFFLE_TILT;

        const x1 = Math.cos(bAngle) * ARENA_RADIUS;
        const y1 = Math.sin(bAngle) * ARENA_RADIUS;
        const x2 = x1 - Math.cos(tipAngle) * BAFFLE_LENGTH;
        const y2 = y1 - Math.sin(tipAngle) * BAFFLE_LENGTH;

        const segDx = x2 - x1;
        const segDy = y2 - y1;
        const segLenSq = segDx * segDx + segDy * segDy;
        const t = Math.max(0, Math.min(1, ((f.x - x1) * segDx + (f.y - y1) * segDy) / segLenSq));
        const closestX = x1 + t * segDx;
        const closestY = y1 + t * segDy;

        const dx = f.x - closestX;
        const dy = f.y - closestY;
        const dist = Math.hypot(dx, dy);
        const minDist = f.r + BAFFLE_RADIUS;

        if (dist < minDist) {
          const nx = dist > 0.0001 ? dx / dist : -Math.sin(tipAngle);
          const ny = dist > 0.0001 ? dy / dist : Math.cos(tipAngle);
          const overlap = minDist - dist;
          f.x += nx * overlap;
          f.y += ny * overlap;

          // Surface velocity from rotating deflector blade
          const surfVx = -ringOmega * closestY;
          const surfVy = ringOmega * closestX;

          const relVx = f.vx - surfVx;
          const relVy = f.vy - surfVy;
          const vn = relVx * nx + relVy * ny;

          if (vn < 0) {
            const restitution = 0.93;
            const j = -(1 + restitution) * vn;
            f.vx += j * nx;
            f.vy += j * ny;
            f.vx += -ringOmega * closestY * 0.09;
            f.vy += ringOmega * closestX * 0.09;
            if (Math.abs(vn) > 75) {
              events.onBounce?.(Math.min(1, Math.abs(vn) / 380));
            }
          }
        }
      }

      // 2. 12-Sided Polygonal Reactor Wall Collision (or Plasma Gate Exit)
      const lx = f.x * cosNegRing - f.y * sinNegRing;
      const ly = f.x * sinNegRing + f.y * cosNegRing;
      const localAngle = normalizeAngle(Math.atan2(ly, lx));
      const facetIdx = Math.floor(localAngle / sectorStep) % ARENA_SIDES;
      const midFacetLocal = (facetIdx + 0.5) * sectorStep;
      const proj = lx * Math.cos(midFacetLocal) + ly * Math.sin(midFacetLocal);

      if (state.mode === 'gate' && facetIdx === GATE_FACET_INDEX) {
        if (proj > ARENA_APOTHEM + f.r * 0.55) {
          eliminateFlag(state, f, events);
          continue;
        }
      } else {
        const maxAllowed = ARENA_APOTHEM - f.r;
        if (proj > maxAllowed) {
          const outAngle = state.ringAngle + midFacetLocal;
          const nx = -Math.cos(outAngle);
          const ny = -Math.sin(outAngle);
          const pen = proj - maxAllowed;
          f.x += nx * pen;
          f.y += ny * pen;

          const wallVx = -ringOmega * f.y;
          const wallVy = ringOmega * f.x;
          const relVx = f.vx - wallVx;
          const relVy = f.vy - wallVy;
          const vn = relVx * nx + relVy * ny;

          if (vn < 0) {
            const restitution = 0.89;
            f.vx -= (1 + restitution) * vn * nx;
            f.vy -= (1 + restitution) * vn * ny;
            const tx = -ny;
            const ty = nx;
            const vt = relVx * tx + relVy * ty;
            f.vx -= vt * 0.07 * tx;
            f.vy -= vt * 0.07 * ty;
            if (Math.abs(vn) > 95) {
              events.onBounce?.(Math.min(0.7, Math.abs(vn) / 420));
            }
          }
        }
      }

      // 3. Center Wheel collision / Vortex Elimination
      const cDist = Math.hypot(f.x, f.y) || 0.001;
      const cMin = CENTER_WHEEL_RADIUS + f.r;
      if (cDist < cMin) {
        const nx = f.x / cDist;
        const ny = f.y / cDist;

        // 1.1s initial grace period so nobody dies before bouncing
        if (state.mode === 'vortex' && state.elapsed > 1.1) {
          if (f.hasShield) {
            // Shield absorbs the vortex hit!
            f.hasShield = false;
            f.x = nx * (cMin + 4);
            f.y = ny * (cMin + 4);
            f.vx = nx * 340 + (Math.random() - 0.5) * 90;
            f.vy = ny * 340 - 80;
            spawnBurst(state, f.x, f.y, ['#22C55E', '#4ADE80', '#FFFFFF'], 18, 1.1);
            state.shockwaves.push({
              x: f.x,
              y: f.y,
              r: f.r,
              maxR: 60,
              color: '#4ADE80',
              alpha: 0.95,
            });
            state.callouts.push({
              x: f.x,
              y: f.y - 16,
              text: `${f.country.code} SHIELD SAVED`,
              color: '#4ADE80',
              life: 0,
              maxLife: 1.0,
            });
            events.onShieldBreak?.();
          } else {
            eliminateFlag(state, f, events);
            continue;
          }
        } else {
          // Solid bumper bounce (Gate mode or initial grace period)
          f.x = nx * cMin;
          f.y = ny * cMin;
          const vn = f.vx * nx + f.vy * ny;
          if (vn < 0) {
            const bumperBounce = state.mode === 'gate' ? 1.18 : 1.05;
            f.vx -= (1 + bumperBounce) * vn * nx;
            f.vy -= (1 + bumperBounce) * vn * ny;
            // Add tangential spin kick from the spinning center wheel
            f.vx += -ny * centerOmega * 35;
            f.vy += nx * centerOmega * 35;
          }
        }
      }
    }

    // 4. Flag-to-Flag elastic collisions
    for (let i = 0; i < state.flags.length; i++) {
      const a = state.flags[i];
      if (a.eliminated) continue;
      for (let j = i + 1; j < state.flags.length; j++) {
        const b = state.flags[j];
        if (b.eliminated) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minDist = a.r + b.r;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const restitution = 0.93;
            const jImpulse = (-(1 + restitution) * velAlongNormal) / 2;
            const ix = jImpulse * nx;
            const iy = jImpulse * ny;
            a.vx -= ix;
            a.vy -= iy;
            b.vx += ix;
            b.vy += iy;
            a.lastHitBy = b.country.name;
            b.lastHitBy = a.country.name;

            if (Math.abs(velAlongNormal) > 90) {
              events.onBounce?.(Math.min(0.65, Math.abs(velAlongNormal) / 420));
            }
          }
        }
      }
    }
  }

  updateEffects(state, dt);

  // Check victory
  const survivors = state.flags.filter((f) => !f.eliminated);
  if (survivors.length === 1 && !state.winner) {
    const champ = survivors[0];
    champ.rank = 1;
    state.winner = champ;
    spawnBurst(state, champ.x, champ.y, ['#FBBF24', '#22D3EE', ...champ.country.colors.filter(Boolean) as string[]], 42, 1.4);
    state.shockwaves.push({
      x: champ.x,
      y: champ.y,
      r: champ.r,
      maxR: 130,
      color: '#FBBF24',
      alpha: 1,
    });
    events.onWinner?.(champ, state.elapsed);
  }
}

function eliminateFlag(state: ArenaState, flag: FlagEntity, events: ArenaEvents) {
  if (flag.eliminated) return;
  flag.eliminated = true;
  flag.eliminatedAt = state.elapsed;

  const remainingBefore = state.flags.filter((f) => !f.eliminated).length;
  const placement = remainingBefore + 1;
  flag.rank = placement;

  if (flag.lastHitBy) {
    const attacker = state.flags.find((f) => f.country.name === flag.lastHitBy && !f.eliminated);
    if (attacker) attacker.knockouts += 1;
  }

  const palette = flag.country.colors.filter(Boolean) as string[];
  spawnBurst(state, flag.x, flag.y, palette, 22, 1.1);
  state.shockwaves.push({
    x: flag.x,
    y: flag.y,
    r: flag.r,
    maxR: 54,
    color: palette[0] || '#22D3EE',
    alpha: 0.9,
  });

  state.callouts.push({
    x: flag.x * 0.72,
    y: flag.y * 0.72 - 12,
    text: `${flag.country.name.toUpperCase()} OUT`,
    color: '#F87171',
    life: 0,
    maxLife: 1.15,
  });

  const record: EliminatedRecord = {
    country: flag.country,
    placement,
    eliminatedAt: state.elapsed,
    eliminatedBy: flag.lastHitBy,
  };
  state.eliminatingFlags.push({
    country: flag.country,
    x: flag.x,
    y: flag.y,
    vx: flag.vx * 0.22,
    vy: flag.vy * 0.22,
    r: flag.r,
    life: 0,
    maxLife: 0.36,
    record,
  });
  events.onEliminate?.(record, remainingBefore);
}

function updateEffects(state: ArenaState, dt: number) {
  for (let i = state.eliminatingFlags.length - 1; i >= 0; i--) {
    const anim = state.eliminatingFlags[i];
    anim.life += dt;
    anim.x += anim.vx * dt;
    anim.y += anim.vy * dt;
    anim.vx *= 0.9;
    anim.vy *= 0.9;
    if (anim.life >= anim.maxLife) {
      state.eliminatingFlags.splice(i, 1);
      state.eliminated.push(anim.record);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.alpha = 1 - p.life / p.maxLife;
  }

  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const s = state.shockwaves[i];
    s.r += (s.maxR - s.r) * Math.min(1, dt * 8);
    s.alpha -= dt * 2.2;
    if (s.alpha <= 0) {
      state.shockwaves.splice(i, 1);
    }
  }

  for (let i = state.callouts.length - 1; i >= 0; i--) {
    const c = state.callouts[i];
    c.life += dt;
    c.y -= dt * 24;
    if (c.life >= c.maxLife) {
      state.callouts.splice(i, 1);
    }
  }
}
