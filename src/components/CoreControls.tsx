import type { SessionSettings } from '../types/settings';

interface CoreControlsProps {
  settings: SessionSettings;
  onUpdate: (patch: Partial<SessionSettings>) => void;
}

const LENGTH_OPTIONS = [2, 3, 4, 5] as const;
const REPEAT_OPTIONS = [1, 2, 3, 4, 5] as const;

export function CoreControls({ settings, onUpdate }: CoreControlsProps) {
  const chordDurationSec = (60 / settings.bpm) * 2;
  const formattedSec = Number.isInteger(chordDurationSec)
    ? chordDurationSec.toFixed(1)
    : chordDurationSec.toFixed(2).replace(/0$/, '');

  return (
    <section
      aria-label="Session pacing controls"
      className="mt-3 space-y-4 rounded-2xl border border-[#2B323B] bg-[#1B1F24] p-4"
    >
      {/* Tempo */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="bpm-slider" className="text-sm font-semibold text-[#F3EFE6]">
            Tempo
          </label>
          <div className="text-right tabular-nums">
            <span className="text-sm font-semibold text-[#E5A93C]">
              {settings.bpm} BPM
            </span>
            <span className="ml-2 text-xs text-[#9CA3AE]">
              {formattedSec}s per chord
            </span>
          </div>
        </div>
        <input
          id="bpm-slider"
          type="range"
          min={40}
          max={160}
          step={2}
          value={settings.bpm}
          onChange={(e) => onUpdate({ bpm: Number(e.target.value) })}
          className="studio-slider mt-1"
        />
      </div>

      {/* Progression Length & Question Repeats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="block text-sm font-semibold text-[#F3EFE6]">
            Progression length
          </span>
          <div
            className="mt-2 grid grid-cols-4 gap-1.5"
            role="group"
            aria-label="Progression length"
          >
            {LENGTH_OPTIONS.map((len) => {
              const active = settings.progressionLength === len;
              return (
                <button
                  key={len}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onUpdate({ progressionLength: len })}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                    active
                      ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                      : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                  }`}
                >
                  {len}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block text-sm font-semibold text-[#F3EFE6]">
            Question repeats
          </span>
          <div
            className="mt-2 grid grid-cols-5 gap-1.5"
            role="group"
            aria-label="Question repeats"
          >
            {REPEAT_OPTIONS.map((rep) => {
              const active = settings.questionRepeats === rep;
              return (
                <button
                  key={rep}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onUpdate({ questionRepeats: rep })}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                    active
                      ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                      : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                  }`}
                >
                  {rep}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
