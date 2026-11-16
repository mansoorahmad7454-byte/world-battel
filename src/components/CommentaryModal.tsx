import React, { useState } from 'react';
import { Languages, Mic, Play, RotateCcw, X } from 'lucide-react';
import {
  COMMENTARY_LANGUAGES,
  CommentaryLanguage,
  CustomCommentaryConfig,
  DEFAULT_CUSTOM_COMMENTARY,
  resolveSpokenLanguage,
} from '../data/raceCommentary';
import { soundEngine } from '../utils/sound';

interface CommentaryModalProps {
  isOpen: boolean;
  commLang: CommentaryLanguage;
  voiceOn: boolean;
  onChangeLang: (lang: CommentaryLanguage) => void;
  onToggleVoice: () => void;
  onClose: () => void;
}

export const CommentaryModal: React.FC<CommentaryModalProps> = ({
  isOpen,
  commLang,
  voiceOn,
  onChangeLang,
  onToggleVoice,
  onClose,
}) => {
  const [draft, setDraft] = useState<CustomCommentaryConfig>(() => ({
    ...soundEngine.customCommentary,
  }));

  if (!isOpen) return null;

  const updateDraft = (patch: Partial<CustomCommentaryConfig>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      soundEngine.setCustomCommentary(next);
      return next;
    });
  };

  const testLine = (line: string, fallback: string, emotion: 'countdown' | 'excited' | 'victory') => {
    soundEngine.unlockSpeech();
    const spoken = resolveSpokenLanguage(commLang, ['PK', 'IN']);
    const text = (line.trim() || fallback)
      .replace(/\{winner\}|\{leader\}|\{country\}/gi, 'Pakistan')
      .replace(/\{rival\}/gi, 'India');
    soundEngine.speakText(text, true, spoken, emotion);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Arrange Commentary and Language"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0B1026] p-5 text-slate-100 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide text-white">
              Commentary &amp; Language Setup
            </h2>
            <p className="text-xs text-slate-400">
              Choose your commentary language or write your own custom commentary lines
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close commentary setup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#060918] px-3 py-2">
            <Languages className="h-4 w-4 text-amber-400 shrink-0" />
            <select
              value={commLang}
              onChange={(e) => {
                const next = e.target.value as CommentaryLanguage;
                soundEngine.setCommentaryLang(next);
                onChangeLang(next);
              }}
              className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
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
            onClick={onToggleVoice}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-3.5 text-xs font-bold ${
              voiceOn
                ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }`}
          >
            <Mic className="h-4 w-4" />
            <span>{voiceOn ? 'Voice ON' : 'Voice OFF'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#060918] px-2.5 py-2 cursor-pointer">
            <span className="font-semibold text-slate-200">Start / GO</span>
            <input
              type="checkbox"
              checked={draft.enableCountdown}
              onChange={(e) => updateDraft({ enableCountdown: e.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#060918] px-2.5 py-2 cursor-pointer">
            <span className="font-semibold text-slate-200">Live Action</span>
            <input
              type="checkbox"
              checked={draft.enableEvents}
              onChange={(e) => updateDraft({ enableEvents: e.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#060918] px-2.5 py-2 cursor-pointer">
            <span className="font-semibold text-slate-200">Winner</span>
            <input
              type="checkbox"
              checked={draft.enableVictory}
              onChange={(e) => updateDraft({ enableVictory: e.target.checked })}
              className="h-4 w-4 accent-amber-400"
            />
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Custom Start / GO Line (Optional)
              </label>
              <button
                type="button"
                onClick={() => testLine(draft.customIntroLine, 'Three, Two, One, Go! Let the battle begin!', 'countdown')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
              >
                <Play className="h-3 w-3" />
                <span>Test</span>
              </button>
            </div>
            <input
              type="text"
              value={draft.customIntroLine}
              onChange={(e) => updateDraft({ customIntroLine: e.target.value })}
              placeholder="Leave blank for automatic language commentary..."
              className="w-full rounded-lg border border-slate-700 bg-[#060918] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Custom Overtake / Knockout Line (Use {'{leader}'}, {'{rival}'}, {'{country}'})
              </label>
              <button
                type="button"
                onClick={() => testLine(draft.customEventLine, '{leader} takes the lead past {rival}!', 'excited')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
              >
                <Play className="h-3 w-3" />
                <span>Test</span>
              </button>
            </div>
            <input
              type="text"
              value={draft.customEventLine}
              onChange={(e) => updateDraft({ customEventLine: e.target.value })}
              placeholder="Example: {leader} ne {rival} ko peechay chhor diya!"
              className="w-full rounded-lg border border-slate-700 bg-[#060918] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Custom Victory Line (Use {'{winner}'}, {'{rival}'})
              </label>
              <button
                type="button"
                onClick={() => testLine(draft.customVictoryLine, '{winner} wins Vortexia Global Battle!', 'victory')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-cyan-200"
              >
                <Play className="h-3 w-3" />
                <span>Test</span>
              </button>
            </div>
            <input
              type="text"
              value={draft.customVictoryLine}
              onChange={(e) => updateDraft({ customVictoryLine: e.target.value })}
              placeholder="Example: Shandar jeet! {winner} champion ban gaya!"
              className="w-full rounded-lg border border-slate-700 bg-[#060918] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...DEFAULT_CUSTOM_COMMENTARY });
              soundEngine.setCustomCommentary({ ...DEFAULT_CUSTOM_COMMENTARY });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            Save &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
};
