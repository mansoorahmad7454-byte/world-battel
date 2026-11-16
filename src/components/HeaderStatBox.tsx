import React from 'react';

interface HeaderStatBoxProps {
  totalCount: number;
  totalLabel?: string;
  leftCount: number;
  leftLabel?: string;
  extraText?: string;
}

export const HeaderStatBox: React.FC<HeaderStatBoxProps> = ({
  totalCount,
  totalLabel = 'Countries',
  leftCount,
  leftLabel = 'Left',
  extraText,
}) => {
  const leftUrgent = leftCount <= 5 && totalCount > 5;

  return (
    <div
      className="inline-flex items-stretch overflow-hidden rounded-lg sm:rounded-xl border border-indigo-400/35 bg-gradient-to-r from-[#0F1A3D] via-[#13214B] to-[#0E1838] shadow-[0_4px_18px_rgba(8,15,40,0.65)] shrink-0"
      aria-label="Match countries scoreboard"
    >
      {/* Total Countries Cell */}
      <div className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 px-2 py-1 sm:px-3 sm:py-1.5 border-r border-slate-700/70">
        <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE] shrink-0" />
        <span className="font-mono text-xs sm:text-base font-black text-white tabular-nums leading-none">
          {totalCount}
        </span>
        <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wide text-cyan-200 leading-none whitespace-nowrap">
          {totalLabel}
        </span>
      </div>

      {/* Remaining / Left Cell */}
      <div
        className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 ${
          leftUrgent
            ? 'bg-gradient-to-r from-rose-500/30 to-amber-500/25'
            : 'bg-gradient-to-r from-amber-500/25 to-emerald-500/20'
        }`}
      >
        <span
          className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shrink-0 ${
            leftUrgent
              ? 'bg-rose-400 shadow-[0_0_8px_#FB7185]'
              : 'bg-amber-400 shadow-[0_0_8px_#FBBF24]'
          }`}
        />
        <span
          className={`font-mono text-xs sm:text-base font-black tabular-nums leading-none ${
            leftUrgent ? 'text-rose-200' : 'text-amber-300'
          }`}
        >
          {leftCount}
        </span>
        <span
          className={`text-[9px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-none whitespace-nowrap ${
            leftUrgent ? 'text-rose-100' : 'text-amber-100'
          }`}
        >
          {leftLabel}
        </span>
      </div>

      {/* Optional Phase / Timer / Cycle Cell (Desktop landscape) */}
      {extraText && (
        <div className="vortexia-desktop-only items-center border-l border-slate-700/70 bg-gradient-to-r from-purple-500/15 to-indigo-500/15 px-3 py-1.5">
          <span className="font-mono text-xs font-bold uppercase tracking-wide text-slate-200 tabular-nums whitespace-nowrap">
            {extraText}
          </span>
        </div>
      )}
    </div>
  );
};
