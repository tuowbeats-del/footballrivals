import React from 'react';
import { FORMATIONS, posLabel } from '../utils/formations';

/**
 * Voetbalveld met de formatie. players: object/array met slotnummer -> speler.
 * highlightSlot: slot dat oplicht (bv. waar de volgende pick terechtkomt).
 */
export default function PitchView({ formation, players = {}, accent = 'grass', compact = false, highlightSlot = -1 }) {
  const form = FORMATIONS[formation];
  if (!form) return null;

  const accentBorder = accent === 'gold' ? 'border-gold-500/60' : 'border-grass-500/60';
  const accentBg = accent === 'gold' ? 'bg-gold-500' : 'bg-grass-500';

  return (
    <div
      className="relative w-full rounded-xl border border-grass-500/30 overflow-hidden select-none"
      style={{
        aspectRatio: compact ? '3 / 3.4' : '3 / 4',
        background: 'linear-gradient(180deg, #14532d 0%, #166534 50%, #14532d 100%)',
      }}
    >
      {/* Veldlijnen */}
      <div className="absolute inset-2 border border-white/25 rounded-sm pointer-events-none" />
      <div className="absolute left-2 right-2 top-1/2 h-px bg-white/25 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] aspect-square border border-white/25 rounded-full pointer-events-none" />
      <div className="absolute left-1/2 bottom-2 -translate-x-1/2 w-[44%] h-[13%] border border-white/25 border-b-0 pointer-events-none" />
      <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[44%] h-[13%] border border-white/25 border-t-0 pointer-events-none" />

      {form.slots.map((s, i) => {
        const p = players[i];
        const isHighlight = i === highlightSlot;
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: compact ? '26%' : '24%' }}
          >
            {p ? (
              <>
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full ${accentBg} text-pitch-900 flex items-center justify-center font-black text-[10px] sm:text-xs border-2 ${accentBorder} shadow-md`}>
                  {typeof p.rating === 'number' ? p.rating : posLabel(s.pos)}
                </div>
                <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold text-white bg-black/50 rounded px-1 leading-tight max-w-full truncate">
                  {p.name?.split(' ').slice(-1)[0]}
                </span>
              </>
            ) : (
              <div
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-dashed flex items-center justify-center text-[9px] sm:text-[10px] font-bold transition-all ${
                  isHighlight
                    ? 'border-gold-400 text-gold-300 bg-gold-400/20 animate-pulse-fast scale-110'
                    : 'border-white/40 text-white/60 bg-black/20'
                }`}
              >
                {posLabel(s.pos)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
