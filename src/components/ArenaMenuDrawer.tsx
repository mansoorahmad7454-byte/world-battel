import React, { useEffect } from 'react';
import {
  ArrowLeftRight,
  Award,
  Camera,
  Car,
  Crown,
  Languages,
  Map as MapIcon,
  Mic,
  MicOff,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { COUNTRIES, CountryDef } from '../data/countries';
import { COMMENTARY_LANGUAGES, CommentaryLanguage } from '../data/raceCommentary';
import { ArenaMode } from '../engine/arenaPhysics';
import { getTopHallOfFame, HallOfFameEntry } from '../utils/hallOfFame';
import { RaceConfig } from './CountryCarRace';
import { FighterCameraMode, FighterConfig, FighterStageTheme } from './CountryFighter';
import { WarConfig } from './CountryWarMap';
import { FlagBadge } from './FlagBadge';

export type AppView = 'arena' | 'carrace' | 'fighter' | 'warmap';
export type ScreenLayoutMode = 'auto' | 'desktop' | 'portrait916';

export interface CycleWinnerRecord {
  cycle: number;
  country: CountryDef;
  durationSec: number;
  knockouts: number;
  mode: ArenaMode;
}

interface ArenaMenuDrawerProps {
  isOpen: boolean;
  appView: AppView;
  layoutMode: ScreenLayoutMode;
  isPlaying: boolean;
  hasWinner: boolean;
  speedMultiplier: number;
  mode: ArenaMode;
  arenaCount: number;
  musicOn: boolean;
  soundOn: boolean;
  voiceOn: boolean;
  carAudioOn: boolean;
  commLang: CommentaryLanguage;
  autoNextCycle: boolean;
  cycleHistory: CycleWinnerRecord[];
  hallOfFame: HallOfFameEntry[];
  raceConfig: RaceConfig;
  fighterConfig: FighterConfig;
  fighterCamMode: FighterCameraMode;
  warConfig: WarConfig;
  onClose: () => void;
  onChangeLayoutMode: (mode: ScreenLayoutMode) => void;
  onSwitchView: (view: AppView) => void;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeSpeed: (spd: number) => void;
  onChangeMode: (mode: ArenaMode) => void;
  onShuffleArenaCount: (count: number) => void;
  onToggleMusic: () => void;
  onToggleSound: () => void;
  onToggleVoice: () => void;
  onToggleCarAudio: () => void;
  onToggleFighterCamMode: () => void;
  onChangeCommLang: (lang: CommentaryLanguage) => void;
  onOpenCommentaryModal: () => void;
  onToggleAutoCycle: (val: boolean) => void;
  onOpenRoster: () => void;
  onOpenRaceCustomModal: () => void;
  onOpenFighterCustomModal: () => void;
  onUpdateRaceConfig: (patch: Partial<RaceConfig>) => void;
  onUpdateFighterConfig: (patch: Partial<FighterConfig>) => void;
  onUpdateWarConfig: (patch: Partial<WarConfig>) => void;
  onResetHallOfFame: () => void;
}

const RACE_COUNT_PRESETS = [2, 4, 5, 8, 16, 32, 50, COUNTRIES.length];
const RACE_DURATION_PRESETS = [
  { label: '1m', sec: 60 },
  { label: '2m', sec: 120 },
  { label: '3m', sec: 180 },
  { label: '4m', sec: 240 },
  { label: '5m', sec: 300 },
  { label: '10m', sec: 600 },
  { label: '15m', sec: 900 },
];

export const ArenaMenuDrawer: React.FC<ArenaMenuDrawerProps> = ({
  isOpen,
  appView,
  layoutMode,
  isPlaying,
  hasWinner,
  speedMultiplier,
  mode,
  arenaCount,
  musicOn,
  soundOn,
  voiceOn,
  carAudioOn,
  commLang,
  autoNextCycle,
  cycleHistory,
  hallOfFame,
  raceConfig,
  fighterConfig,
  fighterCamMode,
  warConfig,
  onClose,
  onChangeLayoutMode,
  onSwitchView,
  onTogglePlay,
  onRestart,
  onChangeSpeed,
  onChangeMode,
  onShuffleArenaCount,
  onToggleMusic,
  onToggleSound,
  onToggleVoice,
  onToggleCarAudio,
  onToggleFighterCamMode,
  onChangeCommLang,
  onOpenCommentaryModal,
  onToggleAutoCycle,
  onOpenRoster,
  onOpenRaceCustomModal,
  onOpenFighterCustomModal,
  onUpdateRaceConfig,
  onUpdateFighterConfig,
  onUpdateWarConfig,
  onResetHallOfFame,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const raceRosterPreview =
    raceConfig.carCount === 2 && !raceConfig.useCustomRoster
      ? COUNTRIES.filter((c) => c.code === raceConfig.duelA || c.code === raceConfig.duelB)
      : raceConfig.useCustomRoster && raceConfig.customCodes.length >= 2
        ? COUNTRIES.filter((c) => raceConfig.customCodes.includes(c.code))
        : COUNTRIES.slice(0, raceConfig.carCount);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full overflow-y-auto border-l border-slate-800 bg-[#0A0F24] p-5 text-slate-100 shadow-2xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Game controls and settings"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <h2 className="text-sm font-black uppercase tracking-wide text-white">
            VORTEXIA <span className="text-amber-400">GLOBAL BATTLE</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close controls menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Screen Ratio Switcher (Auto / Desktop / 9:16 Vertical Full-Screen) */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Screen Ratio
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'auto', label: 'Auto' },
                { id: 'desktop', label: 'Desktop' },
                { id: 'portrait916', label: '9:16 Full' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeLayoutMode(opt.id)}
                className={`min-h-[36px] rounded-lg border px-2 text-xs font-bold transition-colors ${
                  layoutMode === opt.id
                    ? 'border-amber-400 bg-amber-400 text-slate-950'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Game Mode Switcher */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Select Mode
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                onSwitchView('arena');
                onClose();
              }}
              className={`flex min-h-[42px] items-center justify-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                appView === 'arena'
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Spinning Ring Battle</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSwitchView('carrace');
                onClose();
              }}
              className={`flex min-h-[42px] items-center justify-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                appView === 'carrace'
                  ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Car className="h-4 w-4 shrink-0" />
              <span>Grand Prix Highway (1–15 Min)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSwitchView('fighter');
                onClose();
              }}
              className={`flex min-h-[42px] items-center justify-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                appView === 'fighter'
                  ? 'border-rose-400 bg-rose-500/15 text-rose-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              <Swords className="h-4 w-4 shrink-0" />
              <span>Tekken 3 Martial Clash</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSwitchView('warmap');
                onClose();
              }}
              className={`flex min-h-[42px] items-center justify-start gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                appView === 'warmap'
                  ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              <MapIcon className="h-4 w-4 shrink-0" />
              <span>1v1 Tactical War Map</span>
            </button>
          </div>
        </div>

        {/* Playback & Speed */}
        <div className="border-t border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Playback &amp; Speed
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={hasWinner && appView === 'arena'}
              className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0F1633] px-3 text-xs font-bold text-white hover:border-cyan-400 disabled:opacity-45 whitespace-nowrap"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRestart();
                onClose();
              }}
              className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0F1633] px-3 text-xs font-bold text-slate-200 hover:border-cyan-400 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeSpeed(spd)}
                className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold tabular-nums transition-colors ${
                  speedMultiplier === spd
                    ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio: Background Music, Female Voice & Sound FX */}
        <div className="border-t border-slate-800 pt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Music, Voice &amp; Sound
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onToggleMusic}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors whitespace-nowrap ${
                musicOn
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              <span>{musicOn ? 'Music' : 'Muted'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleVoice}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors whitespace-nowrap ${
                voiceOn
                  ? 'border-amber-400/70 bg-amber-400/15 text-amber-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300'
              }`}
            >
              {voiceOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              <span>{voiceOn ? 'Voice' : 'Off'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors whitespace-nowrap ${
                soundOn
                  ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300'
              }`}
            >
              {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{soundOn ? 'SFX' : 'Off'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#0F1633] px-2.5 py-2">
            <Languages className="h-4 w-4 text-amber-400 shrink-0" />
            <select
              value={commLang}
              onChange={(e) => onChangeCommLang(e.target.value as CommentaryLanguage)}
              className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
              aria-label="Commentary language"
            >
              {COMMENTARY_LANGUAGES.map((opt) => (
                <option key={opt.code} value={opt.code} className="bg-[#0B1026]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCommentaryModal();
            }}
            className="flex w-full min-h-[38px] items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-[#0F1633] px-3 text-xs font-bold text-amber-300 hover:border-amber-400"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Arrange / Custom Commentary</span>
          </button>
          <p className="text-[11px] text-slate-400">
            Background beat automatically lowers while the commentator speaks.
          </p>
        </div>

        {/* Grand Prix Highway Controls */}
        {appView === 'carrace' && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Grand Prix Highway Settings
            </p>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-400">
                  Cars in Race ({raceRosterPreview.length})
                </p>
                <input
                  type="number"
                  min={2}
                  max={COUNTRIES.length}
                  value={raceConfig.useCustomRoster ? raceRosterPreview.length : raceConfig.carCount}
                  onChange={(e) => {
                    const n = Math.max(
                      2,
                      Math.min(COUNTRIES.length, Math.round(Number(e.target.value) || 2))
                    );
                    onUpdateRaceConfig({ useCustomRoster: false, carCount: n });
                  }}
                  aria-label="Exact number of cars in race"
                  className="w-14 rounded border border-slate-700 bg-[#0F1633] px-1.5 py-0.5 text-center font-mono text-xs font-bold text-white"
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {RACE_COUNT_PRESETS.map((cnt) => {
                  const active = !raceConfig.useCustomRoster && raceConfig.carCount === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => onUpdateRaceConfig({ useCustomRoster: false, carCount: cnt })}
                      className={`min-h-[36px] rounded-lg border font-mono text-xs font-bold tabular-nums ${
                        active
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cnt === 2 ? '1v1' : cnt}
                    </button>
                  );
                })}
              </div>
            </div>

            {raceConfig.carCount === 2 && !raceConfig.useCustomRoster && (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-[#070B1C] p-2.5">
                <p className="text-[11px] font-bold text-amber-300">1v1 Cars</p>
                <div className="flex items-center gap-1.5">
                  <select
                    value={raceConfig.duelA}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateRaceConfig(
                        v === raceConfig.duelB ? { duelA: v, duelB: raceConfig.duelA } : { duelA: v }
                      );
                    }}
                    className="flex-1 min-w-0 rounded-md border border-slate-700 bg-[#0F1633] px-2 py-1.5 text-xs font-bold text-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#0B1026]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRaceConfig({ duelA: raceConfig.duelB, duelB: raceConfig.duelA })
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-[#0F1633] text-amber-400 shrink-0"
                    aria-label="Swap 1v1 cars"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                  <select
                    value={raceConfig.duelB}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateRaceConfig(
                        v === raceConfig.duelA ? { duelB: v, duelA: raceConfig.duelB } : { duelB: v }
                      );
                    }}
                    className="flex-1 min-w-0 rounded-md border border-slate-700 bg-[#0F1633] px-2 py-1.5 text-xs font-bold text-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#0B1026]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRaceCustomModal();
              }}
              className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0F1633] px-3 text-xs font-bold text-amber-300 hover:border-amber-400/60"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Select Custom Countries</span>
            </button>

            <div className="space-y-2 rounded-lg border border-slate-800 bg-[#070B1C] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-cyan-300">
                  Race Timer (1–15 Min)
                </span>
                <span className="font-mono text-xs font-black text-white tabular-nums">
                  {Math.max(1, Math.round(raceConfig.durationSec / 60))} min ·{' '}
                  {raceConfig.durationSec <= 135 ? 'City' : 'Country Tour'}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {RACE_DURATION_PRESETS.map((d) => (
                  <button
                    key={d.sec}
                    type="button"
                    onClick={() => onUpdateRaceConfig({ durationSec: d.sec })}
                    className={`min-h-[30px] rounded border font-mono text-[11px] font-bold tabular-nums ${
                      Math.round(raceConfig.durationSec / 60) === Math.round(d.sec / 60)
                        ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                        : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={Math.max(1, Math.min(15, Math.round(raceConfig.durationSec / 60)))}
                onChange={(e) =>
                  onUpdateRaceConfig({ durationSec: Number(e.target.value) * 60 })
                }
                aria-label="Race timer duration in minutes"
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateRaceConfig({
                    cameraView: raceConfig.cameraView === 'action' ? 'full' : 'action',
                  })
                }
                className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0F1633] px-2 text-xs font-bold text-cyan-200"
              >
                <Camera className="h-3.5 w-3.5 shrink-0" />
                <span>{raceConfig.cameraView === 'action' ? 'Follow Cam' : 'Full Tour Cam'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleCarAudio}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold ${
                  carAudioOn
                    ? 'border-amber-400/70 bg-amber-400/15 text-amber-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-400'
                }`}
              >
                <Volume2 className="h-3.5 w-3.5 shrink-0" />
                <span>{carAudioOn ? 'Tires Audio: On' : 'Tires: Off'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#0F1633] px-2.5 py-2">
                <Languages className="h-4 w-4 text-amber-400 shrink-0" />
                <select
                  value={raceConfig.commLang}
                  onChange={(e) =>
                    onUpdateRaceConfig({ commLang: e.target.value as CommentaryLanguage })
                  }
                  className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                >
                  {COMMENTARY_LANGUAGES.map((opt) => (
                    <option key={opt.code} value={opt.code} className="bg-[#0B1026]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0F1633] px-2.5 py-2">
                <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
                <select
                  value={raceConfig.preferredWinnerCode}
                  onChange={(e) => onUpdateRaceConfig({ preferredWinnerCode: e.target.value })}
                  className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                >
                  <option value="" className="bg-[#0B1026]">
                    Finish Winner: Random
                  </option>
                  {raceRosterPreview.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#0B1026]">
                      Finish Pick: {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>Auto-Start Next Race</span>
              </span>
              <input
                type="checkbox"
                checked={autoNextCycle}
                onChange={(e) => onToggleAutoCycle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-400"
              />
            </label>
          </div>
        )}

        {/* Tekken 3 Fighter Controls */}
        {appView === 'fighter' && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Tekken 3 Fighters ({fighterConfig.fighterCodes.length})
              </p>
              <input
                type="number"
                min={2}
                max={COUNTRIES.length}
                value={fighterConfig.fighterCodes.length}
                onChange={(e) => {
                  const target = Math.max(
                    2,
                    Math.min(COUNTRIES.length, Math.round(Number(e.target.value) || 2))
                  );
                  const cur = [...fighterConfig.fighterCodes];
                  if (target < cur.length) {
                    onUpdateFighterConfig({ fighterCodes: cur.slice(0, target) });
                  } else if (target > cur.length) {
                    const extra = COUNTRIES.map((c) => c.code).filter((c) => !cur.includes(c));
                    while (cur.length < target && extra.length > 0) {
                      cur.push(extra.shift()!);
                    }
                    onUpdateFighterConfig({ fighterCodes: cur });
                  }
                }}
                aria-label="Number of fighters"
                className="w-16 rounded border border-slate-700 bg-[#0F1633] px-2 py-1 font-mono text-xs font-bold text-white text-center"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[2, 4, 8, 16, 32, 40, 50, COUNTRIES.length].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    const cur = [...fighterConfig.fighterCodes];
                    if (cnt <= cur.length) {
                      onUpdateFighterConfig({ fighterCodes: cur.slice(0, cnt) });
                    } else {
                      const extra = COUNTRIES.map((c) => c.code).filter((c) => !cur.includes(c));
                      while (cur.length < cnt && extra.length > 0) {
                        cur.push(extra.shift()!);
                      }
                      onUpdateFighterConfig({ fighterCodes: cur });
                    }
                  }}
                  className={`min-h-[34px] rounded-lg border font-mono text-xs font-bold ${
                    fighterConfig.fighterCodes.length === cnt
                      ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300'
                  }`}
                >
                  {cnt === 2 ? '1v1' : cnt === COUNTRIES.length ? `All ${COUNTRIES.length}` : `${cnt}P`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFighterCustomModal();
              }}
              className="flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 hover:bg-amber-400/20"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Add / Pick Countries (2–{COUNTRIES.length})</span>
            </button>

            <div className="max-h-44 overflow-y-auto space-y-2 rounded-lg border border-slate-800 bg-[#070B1C] p-2.5">
              {fighterConfig.fighterCodes.map((currentCode, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-12 text-[11px] font-bold text-amber-300 shrink-0">
                    P{idx + 1}
                  </span>
                  <FlagBadge code={currentCode} name={currentCode} size={18} />
                  <select
                    value={currentCode}
                    onChange={(e) => {
                      const nextCodes = [...fighterConfig.fighterCodes];
                      nextCodes[idx] = e.target.value;
                      onUpdateFighterConfig({ fighterCodes: nextCodes });
                    }}
                    className="flex-1 min-w-0 rounded-md border border-slate-700 bg-[#0F1633] px-2 py-1.5 text-xs font-bold text-white"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#0B1026]">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateFighterConfig({ controlMode: 'cpu' })}
                className={`min-h-[38px] rounded-lg border px-2 text-xs font-bold ${
                  fighterConfig.controlMode === 'cpu'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300'
                }`}
              >
                All CPU Fight
              </button>
              <button
                type="button"
                onClick={() => onUpdateFighterConfig({ controlMode: 'p1' })}
                className={`min-h-[38px] rounded-lg border px-2 text-xs font-bold ${
                  fighterConfig.controlMode === 'p1'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300'
                }`}
              >
                Control Fighter 1
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleFighterCamMode}
              className="flex w-full min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0F1633] px-3 text-xs font-bold text-cyan-200 hover:border-cyan-400/60"
            >
              <Camera className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                {fighterCamMode === 'all'
                  ? 'Camera: All Fighters In Frame'
                  : 'Camera: Close Clash Focus'}
              </span>
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'shrine', label: 'Shrine' },
                  { id: 'rooftop', label: 'Rooftop' },
                  { id: 'dojo', label: 'Dojo' },
                ] as Array<{ id: FighterStageTheme; label: string }>
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onUpdateFighterConfig({ stageTheme: st.id })}
                  className={`min-h-[36px] rounded-lg border text-xs font-bold ${
                    fighterConfig.stageTheme === st.id
                      ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#0F1633] px-2.5 py-2">
              <Languages className="h-4 w-4 text-amber-400 shrink-0" />
              <select
                value={fighterConfig.commLang}
                onChange={(e) =>
                  onUpdateFighterConfig({ commLang: e.target.value as CommentaryLanguage })
                }
                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
              >
                {COMMENTARY_LANGUAGES.map((opt) => (
                  <option key={opt.code} value={opt.code} className="bg-[#0B1026]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>Auto-Start Next Match</span>
              </span>
              <input
                type="checkbox"
                checked={autoNextCycle}
                onChange={(e) => onToggleAutoCycle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-400"
              />
            </label>
          </div>
        )}

        {/* 1v1 Country War Controls */}
        {appView === 'warmap' && (
          <div className="border-t border-slate-800 pt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              1v1 War Countries
            </p>
            <div className="flex items-center gap-1.5">
              <select
                value={warConfig.countryACode}
                onChange={(e) => {
                  const next = e.target.value;
                  onUpdateWarConfig(
                    next === warConfig.countryBCode
                      ? { countryACode: next, countryBCode: warConfig.countryACode }
                      : { countryACode: next }
                  );
                }}
                className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-[#0F1633] px-2.5 py-2 text-xs font-bold text-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#0B1026]">
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onUpdateWarConfig({
                    countryACode: warConfig.countryBCode,
                    countryBCode: warConfig.countryACode,
                  })
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-[#0F1633] text-amber-400 shrink-0"
                aria-label="Swap war countries"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <select
                value={warConfig.countryBCode}
                onChange={(e) => {
                  const next = e.target.value;
                  onUpdateWarConfig(
                    next === warConfig.countryACode
                      ? { countryBCode: next, countryACode: warConfig.countryACode }
                      : { countryBCode: next }
                  );
                }}
                className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-[#0F1633] px-2.5 py-2 text-xs font-bold text-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#0B1026]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyan-400" />
                <span>Auto-General Commander</span>
              </span>
              <input
                type="checkbox"
                checked={warConfig.autoGeneral}
                onChange={(e) => onUpdateWarConfig({ autoGeneral: e.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-400"
              />
            </label>
          </div>
        )}

        {/* Spinning Ring Controls */}
        {appView === 'arena' && (
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Spinning Ring ({arenaCount})
              </p>
              <input
                type="number"
                min={2}
                max={COUNTRIES.length}
                value={arenaCount}
                onChange={(e) => {
                  const n = Math.max(
                    2,
                    Math.min(COUNTRIES.length, Math.round(Number(e.target.value) || 2))
                  );
                  onShuffleArenaCount(n);
                }}
                aria-label="Number of countries in spinning ring"
                className="w-16 rounded border border-slate-700 bg-[#0F1633] px-2 py-1 font-mono text-xs font-bold text-white text-center"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[2, 5, 10, 20, 32, 50, COUNTRIES.length].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onShuffleArenaCount(cnt)}
                  className={`min-h-[34px] rounded-lg border font-mono text-xs font-bold ${
                    arenaCount === cnt
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {cnt === 2 ? '1v1' : cnt === COUNTRIES.length ? `All ${COUNTRIES.length}` : cnt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeMode('vortex')}
                className={`min-h-[42px] rounded-lg border px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  mode === 'vortex'
                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                Center Vortex
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('gate')}
                className={`min-h-[42px] rounded-lg border px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                  mode === 'gate'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                Gate Escape
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRoster();
              }}
              className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0F1633] px-3 text-xs font-bold text-amber-300 hover:border-amber-400/60"
            >
              <Users className="h-4 w-4" />
              <span>Pick Exact Countries &amp; Champion</span>
            </button>

            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-2.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>Auto-Start Next Cycle</span>
              </span>
              <input
                type="checkbox"
                checked={autoNextCycle}
                onChange={(e) => onToggleAutoCycle(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-400"
              />
            </label>
          </div>
        )}

        {/* Hall of Fame: Top 5 Countries by Lifetime Wins */}
        <section className="border-t border-slate-800 pt-4" aria-label="Hall of Fame Leaderboard">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Crown className="h-3.5 w-3.5" />
              <span>Hall of Fame · Top 5</span>
            </div>
            {hallOfFame.length > 0 && (
              <button
                type="button"
                onClick={onResetHallOfFame}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {hallOfFame.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-3 text-xs text-slate-400">
              No lifetime champions recorded yet. Complete a match in Arena, Race, Tekken, or War to claim #1.
            </div>
          ) : (
            <div className="space-y-1.5">
              {getTopHallOfFame(hallOfFame, 5).map((entry, idx) => {
                const rankColor =
                  idx === 0
                    ? 'text-amber-300'
                    : idx === 1
                      ? 'text-slate-200'
                      : idx === 2
                        ? 'text-orange-300'
                        : 'text-slate-400';
                const parts: string[] = [];
                if (entry.arenaWins > 0) parts.push(`${entry.arenaWins} Arena`);
                if (entry.raceWins > 0) parts.push(`${entry.raceWins} Race`);
                if (entry.fighterWins > 0) parts.push(`${entry.fighterWins} Tekken`);
                if (entry.warWins > 0) parts.push(`${entry.warWins} War`);
                return (
                  <div
                    key={entry.code}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      idx === 0
                        ? 'border-amber-400/50 bg-amber-400/10'
                        : 'border-slate-800 bg-[#070B1C]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-5 font-mono text-xs font-black tabular-nums ${rankColor}`}>
                        #{idx + 1}
                      </span>
                      <FlagBadge code={entry.code} name={entry.name} size={22} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{entry.name}</p>
                        {parts.length > 0 && (
                          <p className="text-[10px] text-slate-400 tabular-nums truncate">
                            {parts.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono text-xs font-extrabold text-amber-300 tabular-nums">
                      {idx === 0 && <Award className="h-3.5 w-3.5 text-amber-400" />}
                      <span>{entry.wins}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {entry.wins === 1 ? 'win' : 'wins'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Cycle Winners */}
        {appView === 'arena' && cycleHistory.length > 0 && (
          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Recent Winners</span>
            </div>
            <div className="space-y-1.5">
              {cycleHistory.slice(0, 5).map((item) => (
                <div
                  key={item.cycle}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#070B1C] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                      C{item.cycle}
                    </span>
                    <FlagBadge code={item.country.code} name={item.country.name} size={20} />
                    <span className="text-xs font-semibold text-white truncate">
                      {item.country.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                    {item.durationSec}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
