import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Trophy } from 'lucide-react';
import { ArenaCanvas } from './components/ArenaCanvas';
import {
  AppView,
  ArenaMenuDrawer,
  CycleWinnerRecord,
  ScreenLayoutMode,
} from './components/ArenaMenuDrawer';
import { CommentaryModal } from './components/CommentaryModal';
import { CountryCarRace, RaceConfig } from './components/CountryCarRace';
import { CountryFighter, FighterCameraMode, FighterConfig } from './components/CountryFighter';
import { CountryWarMap, WarConfig } from './components/CountryWarMap';
import { FlagBadge } from './components/FlagBadge';
import { HeaderStatBox } from './components/HeaderStatBox';
import { RosterModal } from './components/RosterModal';
import { VictoryConfetti } from './components/VictoryConfetti';
import { COUNTRIES, CountryDef } from './data/countries';
import { CommentaryLanguage } from './data/raceCommentary';
import {
  ArenaEvents,
  ArenaMode,
  ArenaState,
  createArenaState,
  EliminatedRecord,
  FlagEntity,
} from './engine/arenaPhysics';
import {
  clearHallOfFameStore,
  HallOfFameEntry,
  loadHallOfFame,
  recordWinInStore,
  syncHallOfFameFromServer,
  WinSource,
} from './utils/hallOfFame';
import { soundEngine } from './utils/sound';

export default function App() {
  const [appView, setAppView] = useState<AppView>('arena');
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() =>
    COUNTRIES.slice(0, 50).map((c) => c.code)
  );
  const [mode, setMode] = useState<ArenaMode>('vortex');
  const [cycle, setCycle] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [musicOn, setMusicOn] = useState<boolean>(soundEngine.musicEnabled);
  const [soundOn, setSoundOn] = useState<boolean>(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(soundEngine.voiceEnabled);
  const [carAudioOn, setCarAudioOn] = useState<boolean>(soundEngine.carAudioEnabled);
  const [commLang, setCommLang] = useState<CommentaryLanguage>(soundEngine.commentaryLang);
  const [championCode, setChampionCode] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState<boolean>(false);
  const [raceCustomOpen, setRaceCustomOpen] = useState<boolean>(false);
  const [fighterCustomOpen, setFighterCustomOpen] = useState<boolean>(false);
  const [fighterCamMode, setFighterCamMode] = useState<FighterCameraMode>('all');
  const [commentaryModalOpen, setCommentaryModalOpen] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<ScreenLayoutMode>('auto');
  const [mediaPortrait, setMediaPortrait] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-aspect-ratio: 1/1), (max-width: 679px)').matches;
  });
  const [autoNextCycle, setAutoNextCycle] = useState<boolean>(true);
  const [cycleHistory, setCycleHistory] = useState<CycleWinnerRecord[]>([]);
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>(() => loadHallOfFame());
  const [restartSignal, setRestartSignal] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-aspect-ratio: 1/1), (max-width: 679px)');
    const sync = () => setMediaPortrait(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const isPortrait916 =
    layoutMode === 'portrait916' || (layoutMode === 'auto' && mediaPortrait);

  const [raceConfig, setRaceConfig] = useState<RaceConfig>(() => ({
    carCount: 2,
    durationSec: 180,
    duelA: 'PK',
    duelB: 'IN',
    cameraView: 'action',
    customCodes: COUNTRIES.slice(0, 5).map((c) => c.code),
    useCustomRoster: false,
    commLang: soundEngine.commentaryLang,
    preferredWinnerCode: '',
  }));

  const [fighterConfig, setFighterConfig] = useState<FighterConfig>(() => ({
    fighterCodes: ['PK', 'IN'],
    controlMode: 'cpu',
    stageTheme: 'shrine',
    commLang: soundEngine.commentaryLang,
  }));

  const [warConfig, setWarConfig] = useState<WarConfig>(() => ({
    countryACode: 'GB',
    countryBCode: 'IE',
    autoGeneral: true,
  }));

  const activeRoster = useMemo(
    () => COUNTRIES.filter((c) => selectedCodes.includes(c.code)),
    [selectedCodes]
  );
  const countryCount = activeRoster.length;

  const arenaRef = useRef<ArenaState>(createArenaState(activeRoster, mode));
  const [, setSyncTick] = useState<number>(0);

  const forceSync = useCallback(() => {
    setSyncTick((t) => t + 1);
  }, []);

  // Start original copyright-free music & unlock voice globally on first user gesture across ALL modes
  useEffect(() => {
    const startAudio = () => {
      soundEngine.unlockSpeech();
      if (soundEngine.musicEnabled) {
        soundEngine.startRaceMusic();
      }
    };
    startAudio();
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('keydown', startAudio);
    };
  }, []);

  useEffect(() => {
    soundEngine.setMusicPaused(!isPlaying);
  }, [isPlaying]);

  // Hydrate persistent Hall of Fame from server + localStorage
  useEffect(() => {
    let active = true;
    syncHallOfFameFromServer(loadHallOfFame()).then((merged) => {
      if (active) setHallOfFame(merged);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleRecordWin = useCallback((country: CountryDef, source: WinSource) => {
    setHallOfFame((prev) => recordWinInStore(prev, country, source));
  }, []);

  const handleResetHallOfFame = useCallback(() => {
    setHallOfFame(clearHallOfFameStore());
  }, []);

  const eventsRef = useRef<ArenaEvents>({});
  eventsRef.current = {
    onBounce: (intensity) => soundEngine.playBounce(intensity),
    onShieldPickup: () => soundEngine.playShieldPickup(),
    onShieldBreak: () => soundEngine.playShieldBreak(),
    onEliminate: (record) => {
      soundEngine.playEliminate();
      soundEngine.speakCountryOut(
        record.country,
        activeRoster.map((c) => c.code)
      );
    },
    onWinner: (winner, elapsed) => {
      soundEngine.playVictory();
      soundEngine.speakWinner(
        winner.country,
        activeRoster.map((c) => c.code)
      );
      handleRecordWin(winner.country, 'arena');
      setCycleHistory((prev) => [
        {
          cycle,
          country: winner.country,
          durationSec: Math.round(elapsed),
          knockouts: winner.knockouts,
          mode,
        },
        ...prev.slice(0, 9),
      ]);
      forceSync();
    },
  };

  const resetArena = useCallback(
    (nextRoster: CountryDef[], nextMode: ArenaMode, incrementCycle: boolean) => {
      arenaRef.current = createArenaState(nextRoster, nextMode);
      if (incrementCycle) {
        setCycle((c) => c + 1);
      }
      setIsPlaying(true);
      forceSync();
    },
    [forceSync]
  );

  const handleToggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);
    soundEngine.setMusicEnabled(next);
    if (next) {
      soundEngine.startRaceMusic();
    }
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundEngine.setEnabled(next);
  };

  const handleToggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    soundEngine.setVoiceEnabled(next);
    if (next) {
      soundEngine.unlockSpeech();
    }
  };

  const handleToggleCarAudio = () => {
    const next = !carAudioOn;
    setCarAudioOn(next);
    soundEngine.setCarAudioEnabled(next);
  };

  const handleApplySelectedCodes = (codes: string[]) => {
    const clean = codes.length >= 2 ? codes : COUNTRIES.slice(0, 2).map((c) => c.code);
    setSelectedCodes(clean);
    const nextRoster = COUNTRIES.filter((c) => clean.includes(c.code));
    if (championCode && !nextRoster.some((c) => c.code === championCode)) {
      setChampionCode(null);
    }
    resetArena(nextRoster, mode, false);
  };

  const handleShuffleCount = (count: number) => {
    const copy = [...COUNTRIES];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    const picked = copy.slice(0, Math.max(2, count));
    setSelectedCodes(picked.map((c) => c.code));
    if (championCode && !picked.some((c) => c.code === championCode)) {
      setChampionCode(null);
    }
    resetArena(picked, mode, false);
  };

  const handleChangeMode = (nextMode: ArenaMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetArena(activeRoster, nextMode, false);
  };

  const handleNextCycle = useCallback(() => {
    resetArena(activeRoster, mode, true);
  }, [activeRoster, mode, resetArena]);

  const handleRestartActiveGame = () => {
    setIsPlaying(true);
    if (appView === 'arena') {
      resetArena(activeRoster, mode, false);
    } else {
      setRestartSignal((s) => s + 1);
    }
  };

  const handleChangeCommLang = (lang: CommentaryLanguage) => {
    setCommLang(lang);
    soundEngine.setCommentaryLang(lang);
    setRaceConfig((prev) => ({ ...prev, commLang: lang }));
    setFighterConfig((prev) => ({ ...prev, commLang: lang }));
  };

  const updateRaceConfig = (patch: Partial<RaceConfig>) => {
    if (patch.commLang) {
      setCommLang(patch.commLang);
      soundEngine.setCommentaryLang(patch.commLang);
      setFighterConfig((prev) => ({ ...prev, commLang: patch.commLang! }));
    }
    setRaceConfig((prev) => ({ ...prev, ...patch }));
  };

  const updateFighterConfig = (patch: Partial<FighterConfig>) => {
    if (patch.commLang) {
      setCommLang(patch.commLang);
      soundEngine.setCommentaryLang(patch.commLang);
      setRaceConfig((prev) => ({ ...prev, commLang: patch.commLang! }));
    }
    setFighterConfig((prev) => ({ ...prev, ...patch }));
  };

  const updateWarConfig = (patch: Partial<WarConfig>) => {
    setWarConfig((prev) => ({ ...prev, ...patch }));
  };

  const state = arenaRef.current;
  const remainingFlags = state.flags.filter((f) => !f.eliminated);
  const remainingCount = remainingFlags.length;
  const eliminatedList: EliminatedRecord[] = state.eliminated;
  const winner: FlagEntity | null = state.winner;

  useEffect(() => {
    if (!winner || !autoNextCycle || appView !== 'arena') return;
    const timer = window.setTimeout(() => {
      handleNextCycle();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [winner, autoNextCycle, appView, handleNextCycle]);

  const statusText = winner ? 'Finished' : isPlaying ? 'Live' : 'Paused';

  return (
    <>
      <div className={isPortrait916 ? 'vortexia-916-backdrop' : 'contents'}>
      {appView === 'warmap' ? (
        <CountryWarMap
          config={warConfig}
          isPlaying={isPlaying}
          speedMultiplier={speedMultiplier}
          restartSignal={restartSignal}
          commLang={commLang}
          isPortrait916={isPortrait916}
          onUpdateConfig={updateWarConfig}
          onOpenMenu={() => setMenuOpen(true)}
          onRecordWin={(c) => handleRecordWin(c, 'warmap')}
          onBackToArena={() => {
            setAppView('arena');
            setIsPlaying(true);
          }}
        />
      ) : appView === 'carrace' ? (
        <CountryCarRace
          config={raceConfig}
          isPlaying={isPlaying}
          speedMultiplier={speedMultiplier}
          autoNextCycle={autoNextCycle}
          restartSignal={restartSignal}
          customModalOpen={raceCustomOpen}
          isPortrait916={isPortrait916}
          onCloseCustomModal={() => setRaceCustomOpen(false)}
          onUpdateConfig={updateRaceConfig}
          onOpenMenu={() => setMenuOpen(true)}
          onRecordWin={(c) => handleRecordWin(c, 'carrace')}
        />
      ) : appView === 'fighter' ? (
        <CountryFighter
          config={fighterConfig}
          camMode={fighterCamMode}
          isPlaying={isPlaying}
          speedMultiplier={speedMultiplier}
          autoNextCycle={autoNextCycle}
          restartSignal={restartSignal}
          voiceOn={voiceOn}
          customModalOpen={fighterCustomOpen}
          isPortrait916={isPortrait916}
          onCloseCustomModal={() => setFighterCustomOpen(false)}
          onToggleVoice={handleToggleVoice}
          onUpdateConfig={updateFighterConfig}
          onOpenMenu={() => setMenuOpen(true)}
          onRecordWin={(c) => handleRecordWin(c, 'fighter')}
        />
      ) : (
        <div className="vortexia-shell bg-[#060918] text-slate-100">
          <div className="mx-auto w-full max-w-[1160px] flex-1 min-h-0 px-3 py-2 sm:px-6 sm:py-4 flex flex-col">
            {/* Pro Header: Brand + Colorful Total/Left Countries Box + 3-Lines Menu */}
            <header className="flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0 flex-1">
                <h1 className="text-[13px] sm:text-xl lg:text-2xl font-black uppercase tracking-tight leading-none truncate">
                  <span className="text-white">VORTEXIA GLOBAL </span>
                  <span className="text-amber-400">BATTLE</span>
                </h1>
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-bold tracking-wider text-[#8C96C8] uppercase truncate">
                  Spinning Reactor Ring · {mode === 'vortex' ? 'Center Vortex' : 'Gate Escape'} · Cycle {cycle}
                </p>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <HeaderStatBox
                  totalCount={countryCount}
                  totalLabel="Countries"
                  leftCount={remainingCount}
                  leftLabel="Left"
                  extraText={`Cycle ${cycle} · ${statusText}`}
                />
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-[#0F1633] text-amber-300 hover:border-amber-400 hover:text-white shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
                  aria-label="Open arena settings and controls"
                  title="All Game Options & Modes"
                >
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </header>

            {/* Clean Centered Spinning Reactor Ring Stage (All controls live inside 3-Lines Menu) */}
            <div className="mt-1.5 sm:mt-3 flex flex-col items-center justify-start flex-1 min-h-0 overflow-hidden">
              <main className="w-full flex-1 min-h-0 flex flex-col items-center">
                <div className="text-center mb-1 sm:mb-2 shrink-0">
                  <h2 className="text-sm sm:text-xl lg:text-2xl font-black uppercase tracking-tight leading-tight">
                    <span className="text-white">LAST FLAG </span>
                    <span className="text-amber-400">STANDING WINS</span>
                  </h2>
                </div>

                {/* Spinning Reactor Arena */}
                <div className="relative vortexia-arena-box aspect-square flex items-center justify-center shrink-0">
                  <ArenaCanvas
                    arenaRef={arenaRef}
                    isPlaying={isPlaying}
                    speedMultiplier={speedMultiplier}
                    championCode={championCode}
                    eventsRef={eventsRef}
                    onTickSync={forceSync}
                  />

                  {/* Winner Overlay */}
                  {winner && (
                    <div className="absolute inset-0 flex items-center justify-center p-2.5 sm:p-4 bg-[#060918]/75 backdrop-blur-[2px] rounded-2xl overflow-hidden">
                      <VictoryConfetti
                        colors={winner.country.colors.filter(Boolean) as string[]}
                        className="z-20"
                      />
                      <div className="relative z-10 w-full max-w-[300px] max-h-[95%] overflow-y-auto rounded-xl border border-amber-400/50 bg-[#0A1027]/95 p-3.5 sm:p-5 text-center shadow-2xl">
                        <div className="mx-auto mb-1.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
                          <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400">
                          Cycle {cycle} Champion
                        </p>
                        <div className="my-2 sm:my-3 flex justify-center">
                          <FlagBadge
                            code={winner.country.code}
                            name={winner.country.name}
                            size={54}
                            className="ring-3 ring-amber-400/70"
                          />
                        </div>
                        <h3 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                          {winner.country.name}
                        </h3>
                        <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-300 tabular-nums">
                          Survived {Math.round(state.elapsed)}s · {winner.knockouts} knockouts
                        </p>

                        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleNextCycle}
                            className="min-h-[36px] sm:min-h-[40px] rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
                          >
                            Next Cycle
                          </button>
                          <button
                            type="button"
                            onClick={handleRestartActiveGame}
                            className="min-h-[36px] sm:min-h-[40px] rounded-lg border border-slate-600 bg-slate-900 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:border-slate-400 transition-colors whitespace-nowrap shrink-0"
                          >
                            Replay
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ALL ELIMINATED Tray */}
                <section
                  className="mt-2 sm:mt-3 w-full max-w-[580px] flex-1 min-h-0 flex flex-col"
                  aria-label="All eliminated countries"
                >
                  <div className="mb-1 sm:mb-2 flex items-baseline justify-between gap-2 shrink-0">
                    <span className="text-[11px] sm:text-xs font-medium text-slate-400 tabular-nums truncate">
                      {eliminatedList.length > 0
                        ? `Last out: ${eliminatedList[eliminatedList.length - 1].country.name}`
                        : 'No eliminations yet'}
                    </span>
                    <h3 className="text-xs sm:text-base font-black uppercase tracking-wide text-white shrink-0">
                      ALL ELIMINATED
                    </h3>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-wrap gap-1.5 items-start content-start pb-1">
                    {eliminatedList.map((rec) => (
                      <FlagBadge
                        key={`${rec.country.code}-${rec.placement}`}
                        code={rec.country.code}
                        name={rec.country.name}
                        size={24}
                        title={`#${rec.placement} ${rec.country.name} (${Math.round(rec.eliminatedAt)}s)`}
                        className="animate-flag-pop transition-transform duration-150 hover:scale-125"
                      />
                    ))}
                  </div>
                </section>
              </main>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* 3-Lines Menu Drawer (All Game Modes, Per-Game Options, Screen Ratio, Music, Voice & Hall of Fame) */}
      <ArenaMenuDrawer
        isOpen={menuOpen}
        appView={appView}
        layoutMode={layoutMode}
        isPlaying={isPlaying}
        hasWinner={Boolean(winner)}
        speedMultiplier={speedMultiplier}
        mode={mode}
        arenaCount={countryCount}
        musicOn={musicOn}
        soundOn={soundOn}
        voiceOn={voiceOn}
        carAudioOn={carAudioOn}
        commLang={commLang}
        autoNextCycle={autoNextCycle}
        cycleHistory={cycleHistory}
        hallOfFame={hallOfFame}
        raceConfig={raceConfig}
        fighterConfig={fighterConfig}
        fighterCamMode={fighterCamMode}
        warConfig={warConfig}
        onClose={() => setMenuOpen(false)}
        onChangeLayoutMode={setLayoutMode}
        onSwitchView={(view) => {
          setAppView(view);
          setIsPlaying(true);
        }}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onRestart={handleRestartActiveGame}
        onChangeSpeed={setSpeedMultiplier}
        onChangeMode={handleChangeMode}
        onShuffleArenaCount={handleShuffleCount}
        onToggleMusic={handleToggleMusic}
        onToggleSound={handleToggleSound}
        onToggleVoice={handleToggleVoice}
        onToggleCarAudio={handleToggleCarAudio}
        onToggleFighterCamMode={() =>
          setFighterCamMode((m) => (m === 'all' ? 'focus' : 'all'))
        }
        onChangeCommLang={handleChangeCommLang}
        onOpenCommentaryModal={() => setCommentaryModalOpen(true)}
        onToggleAutoCycle={setAutoNextCycle}
        onOpenRoster={() => setRosterOpen(true)}
        onOpenRaceCustomModal={() => setRaceCustomOpen(true)}
        onOpenFighterCustomModal={() => setFighterCustomOpen(true)}
        onUpdateRaceConfig={updateRaceConfig}
        onUpdateFighterConfig={updateFighterConfig}
        onUpdateWarConfig={updateWarConfig}
        onResetHallOfFame={handleResetHallOfFame}
      />

      <RosterModal
        isOpen={rosterOpen}
        selectedCodes={selectedCodes}
        championCode={championCode}
        onClose={() => setRosterOpen(false)}
        onApplySelectedCodes={handleApplySelectedCodes}
        onSelectChampion={setChampionCode}
        onShuffleCount={handleShuffleCount}
      />

      <CommentaryModal
        isOpen={commentaryModalOpen}
        commLang={commLang}
        voiceOn={voiceOn}
        onChangeLang={handleChangeCommLang}
        onToggleVoice={handleToggleVoice}
        onClose={() => setCommentaryModalOpen(false)}
      />
    </>
  );
}
