import React, { useState } from 'react';
import { Check, Search, Shuffle, Trophy, X } from 'lucide-react';
import { COUNTRIES, CountryDef } from '../data/countries';
import { FlagBadge } from './FlagBadge';

interface RosterModalProps {
  isOpen: boolean;
  selectedCodes: string[];
  championCode: string | null;
  onClose: () => void;
  onApplySelectedCodes: (codes: string[]) => void;
  onSelectChampion: (code: string | null) => void;
  onShuffleCount: (count: number) => void;
}

const COUNT_OPTIONS = [2, 4, 5, 12, 24, 36, 50, COUNTRIES.length];

export const RosterModal: React.FC<RosterModalProps> = ({
  isOpen,
  selectedCodes,
  championCode,
  onClose,
  onApplySelectedCodes,
  onSelectChampion,
  onShuffleCount,
}) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'roster' | 'champion'>('roster');

  if (!isOpen) return null;

  const filteredAll = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.code.toLowerCase().includes(query.toLowerCase())
  );

  const activeRoster = COUNTRIES.filter((c) => selectedCodes.includes(c.code));
  const filteredChampion = activeRoster.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.code.toLowerCase().includes(query.toLowerCase())
  );

  const toggleCountry = (code: string) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length <= 2) return; // Minimum 2 countries needed for a battle
      onApplySelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      onApplySelectedCodes([...selectedCodes, code]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-modal-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-700/80 bg-[#0B1026] text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="roster-modal-title" className="text-lg font-bold tracking-tight text-white">
              Arena Countries ({selectedCodes.length} Selected)
            </h2>
            <p className="text-xs text-slate-400">
              Select 2, 4, 5, or any exact countries to battle in the spinning ring
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
            aria-label="Close roster modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher: Custom Roster vs Pick Champion */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-2.5">
          <button
            type="button"
            onClick={() => setTab('roster')}
            className={`min-h-[36px] rounded-lg px-3.5 text-xs font-bold transition-colors ${
              tab === 'roster'
                ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Select Countries ({selectedCodes.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('champion')}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition-colors ${
              tab === 'champion'
                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Track Champion</span>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {tab === 'roster' ? (
            <>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Countries in Ring ({selectedCodes.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={2}
                      max={COUNTRIES.length}
                      defaultValue={selectedCodes.length}
                      key={selectedCodes.length}
                      onBlur={(e) => {
                        const n = Math.max(2, Math.min(COUNTRIES.length, Number(e.target.value) || 2));
                        onApplySelectedCodes(COUNTRIES.slice(0, n).map((c) => c.code));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const n = Math.max(2, Math.min(COUNTRIES.length, Number((e.target as HTMLInputElement).value) || 2));
                          onApplySelectedCodes(COUNTRIES.slice(0, n).map((c) => c.code));
                        }
                      }}
                      aria-label="Exact number of countries"
                      title="Type any number of players (2-64)"
                      className="w-14 rounded-md border border-slate-700 bg-[#060918] px-2 py-1 text-center font-mono text-xs font-bold text-white"
                    />
                    <button
                      type="button"
                      onClick={() => onApplySelectedCodes(COUNTRIES.map((c) => c.code))}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
                    >
                      All ({COUNTRIES.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => onShuffleCount(selectedCodes.length)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
                    >
                      <Shuffle className="h-3 w-3" />
                      <span>Random {selectedCodes.length}</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {COUNT_OPTIONS.map((count) => {
                    const active = selectedCodes.length === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onApplySelectedCodes(COUNTRIES.slice(0, count).map((c) => c.code))}
                        className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold tabular-nums transition-colors ${
                          active
                            ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                            : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        {count === 2 ? '2 (1v1)' : count}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="relative mb-2.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search any country to add or remove..."
                    className="w-full rounded-lg border border-slate-700/80 bg-[#060918] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Click any country to toggle it in or out of the arena (min 2)</span>
                  <button
                    type="button"
                    onClick={() => onApplySelectedCodes(selectedCodes.slice(0, 2))}
                    className="font-semibold text-amber-300 hover:text-amber-200"
                  >
                    Trim to 2
                  </button>
                </div>

                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {filteredAll.map((country: CountryDef) => {
                    const checked = selectedCodes.includes(country.code);
                    return (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => toggleCountry(country.code)}
                        className={`flex min-h-[42px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                          checked
                            ? 'border-cyan-400/80 bg-cyan-400/15 text-white'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FlagBadge code={country.code} name={country.name} size={20} />
                          <span className="truncate">{country.name}</span>
                        </span>
                        {checked && <Check className="h-3.5 w-3.5 text-cyan-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">
                  Highlight Your Champion in Arena
                </span>
                {championCode && (
                  <button
                    type="button"
                    onClick={() => onSelectChampion(null)}
                    className="text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search active arena countries..."
                  className="w-full rounded-lg border border-slate-700/80 bg-[#060918] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid max-h-60 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                {filteredChampion.map((country) => {
                  const selected = championCode === country.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => onSelectChampion(selected ? null : country.code)}
                      className={`flex min-h-[42px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                          : 'border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <FlagBadge code={country.code} name={country.name} size={20} />
                      <span className="truncate">{country.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-800 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap shrink-0"
          >
            Start With {selectedCodes.length} Countries
          </button>
        </div>
      </div>
    </div>
  );
};
