import { CountryDef } from '../data/countries';

export type WinSource = 'arena' | 'carrace' | 'warmap' | 'fighter';

export interface HallOfFameEntry {
  code: string;
  name: string;
  wins: number;
  arenaWins: number;
  raceWins: number;
  warWins: number;
  fighterWins: number;
  lastWinAt: number;
}

const STORAGE_KEY = 'flags_war_hall_of_fame_v1';

export function sortHallOfFame(entries: HallOfFameEntry[]): HallOfFameEntry[] {
  return [...entries].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.lastWinAt - a.lastWinAt;
  });
}

export function getTopHallOfFame(entries: HallOfFameEntry[], limit = 5): HallOfFameEntry[] {
  return sortHallOfFame(entries).slice(0, limit);
}

export function loadHallOfFame(): HallOfFameEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned: HallOfFameEntry[] = parsed
      .filter((x) => x && typeof x.code === 'string' && typeof x.wins === 'number' && x.wins > 0)
      .map((x) => ({
        code: x.code,
        name: typeof x.name === 'string' ? x.name : x.code,
        wins: x.wins,
        arenaWins: typeof x.arenaWins === 'number' ? x.arenaWins : 0,
        raceWins: typeof x.raceWins === 'number' ? x.raceWins : 0,
        warWins: typeof x.warWins === 'number' ? x.warWins : 0,
        fighterWins: typeof x.fighterWins === 'number' ? x.fighterWins : 0,
        lastWinAt: typeof x.lastWinAt === 'number' ? x.lastWinAt : Date.now(),
      }));
    return sortHallOfFame(cleaned);
  } catch {
    return [];
  }
}

export function saveHallOfFame(entries: HallOfFameEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortHallOfFame(entries)));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordWinInStore(
  current: HallOfFameEntry[],
  country: CountryDef,
  source: WinSource
): HallOfFameEntry[] {
  const now = Date.now();
  const map = new Map<string, HallOfFameEntry>();
  for (const item of current) {
    map.set(item.code, { ...item });
  }

  const existing = map.get(country.code) ?? {
    code: country.code,
    name: country.name,
    wins: 0,
    arenaWins: 0,
    raceWins: 0,
    warWins: 0,
    fighterWins: 0,
    lastWinAt: now,
  };

  existing.name = country.name;
  existing.wins += 1;
  if (source === 'arena') existing.arenaWins += 1;
  else if (source === 'carrace') existing.raceWins += 1;
  else if (source === 'warmap') existing.warWins += 1;
  else if (source === 'fighter') existing.fighterWins += 1;
  existing.lastWinAt = now;

  map.set(country.code, existing);
  const next = sortHallOfFame(Array.from(map.values()));
  saveHallOfFame(next);

  fetch('/api/hall-of-fame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: country.code, name: country.name, source }),
  }).catch(() => {});

  return next;
}

export async function syncHallOfFameFromServer(
  localEntries: HallOfFameEntry[]
): Promise<HallOfFameEntry[]> {
  try {
    const res = await fetch('/api/hall-of-fame');
    if (!res.ok) return localEntries;
    const data = (await res.json()) as { entries?: HallOfFameEntry[] };
    if (!Array.isArray(data.entries)) return localEntries;

    const merged = new Map<string, HallOfFameEntry>();
    for (const item of localEntries) {
      merged.set(item.code, { ...item });
    }
    for (const remote of data.entries) {
      if (!remote || typeof remote.code !== 'string' || remote.wins <= 0) continue;
      const prev = merged.get(remote.code);
      if (!prev) {
        merged.set(remote.code, {
          ...remote,
          fighterWins: typeof remote.fighterWins === 'number' ? remote.fighterWins : 0,
        });
      } else {
        const arenaWins = Math.max(prev.arenaWins, remote.arenaWins || 0);
        const raceWins = Math.max(prev.raceWins, remote.raceWins || 0);
        const warWins = Math.max(prev.warWins, remote.warWins || 0);
        const fighterWins = Math.max(prev.fighterWins || 0, remote.fighterWins || 0);
        merged.set(remote.code, {
          code: remote.code,
          name: remote.name || prev.name,
          wins: Math.max(prev.wins, remote.wins, arenaWins + raceWins + warWins + fighterWins),
          arenaWins,
          raceWins,
          warWins,
          fighterWins,
          lastWinAt: Math.max(prev.lastWinAt, remote.lastWinAt || 0),
        });
      }
    }

    const sorted = sortHallOfFame(Array.from(merged.values()));
    saveHallOfFame(sorted);
    return sorted;
  } catch {
    return localEntries;
  }
}

export function clearHallOfFameStore(): HallOfFameEntry[] {
  saveHallOfFame([]);
  fetch('/api/hall-of-fame', { method: 'DELETE' }).catch(() => {});
  return [];
}
