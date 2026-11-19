import { useState } from 'react';
import {
  CHORD_DEFS,
  CHORD_PRESETS,
  SECONDARY_DOMINANT_PRESETS,
  SECONDARY_SEVENTH_IDS,
  SECONDARY_TRIAD_IDS,
  SEVENTH_IDS,
  TRIAD_IDS,
} from '../music/chords';
import type {
  DiatonicChordId,
  SecondaryDominantId,
} from '../types/settings';
import { SwitchRow } from './SwitchRow';

interface ChordSelectorProps {
  allowedChords: DiatonicChordId[];
  secondaryDominantsEnabled: boolean;
  allowedSecondaryDominants: SecondaryDominantId[];
  announceTriadQuality: boolean;
  playChordsBehindAnswer: boolean;
  onChange: (next: DiatonicChordId[]) => void;
  onToggleSecondaryDominants: (enabled: boolean) => void;
  onChangeSecondaryDominants: (next: SecondaryDominantId[]) => void;
  onToggleTriadQuality: (enabled: boolean) => void;
  onToggleChordsBehindAnswer: (enabled: boolean) => void;
}

function setsMatch<T extends string>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}

export function ChordSelector({
  allowedChords,
  secondaryDominantsEnabled,
  allowedSecondaryDominants,
  announceTriadQuality,
  playChordsBehindAnswer,
  onChange,
  onToggleSecondaryDominants,
  onChangeSecondaryDominants,
  onToggleTriadQuality,
  onToggleChordsBehindAnswer,
}: ChordSelectorProps) {
  const [minGuardNotice, setMinGuardNotice] = useState(false);
  const [secMinGuardNotice, setSecMinGuardNotice] = useState(false);
  const selectedSet = new Set(allowedChords);
  const selectedSecondarySet = new Set(allowedSecondaryDominants);

  const toggleChord = (id: DiatonicChordId) => {
    if (selectedSet.has(id)) {
      if (allowedChords.length <= 1) {
        setMinGuardNotice(true);
        return;
      }
      setMinGuardNotice(false);
      onChange(allowedChords.filter((item) => item !== id));
    } else {
      setMinGuardNotice(false);
      onChange([...allowedChords, id]);
    }
  };

  const toggleSecondaryDominant = (id: SecondaryDominantId) => {
    if (selectedSecondarySet.has(id)) {
      if (allowedSecondaryDominants.length <= 1) {
        setSecMinGuardNotice(true);
        return;
      }
      setSecMinGuardNotice(false);
      onChangeSecondaryDominants(
        allowedSecondaryDominants.filter((item) => item !== id),
      );
    } else {
      setSecMinGuardNotice(false);
      onChangeSecondaryDominants([...allowedSecondaryDominants, id]);
    }
  };

  const hasAutoResolvedTarget =
    secondaryDominantsEnabled &&
    allowedSecondaryDominants.some((secId) => {
      const targets = CHORD_DEFS[secId].resolvesTo;
      return targets ? targets.every((t) => !selectedSet.has(t)) : false;
    });

  const activeCountLabel = secondaryDominantsEnabled
    ? `${allowedChords.length} + ${allowedSecondaryDominants.length} active`
    : `${allowedChords.length} active`;

  return (
    <section
      aria-label="Allowed chords"
      className="mt-4 rounded-2xl border border-[#2B323B] bg-[#1B1F24] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#F3EFE6]">Allowed chords</h2>
        <span className="text-xs text-[#9CA3AE] tabular-nums">
          {activeCountLabel}
        </span>
      </div>

      {/* Quick-select presets */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CHORD_PRESETS.map((preset) => {
          const isCurrent = setsMatch(allowedChords, preset.chords);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setMinGuardNotice(false);
                onChange([...preset.chords]);
              }}
              className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                isCurrent
                  ? 'border-[#E5A93C]/70 bg-[#E5A93C]/15 text-[#E5A93C]'
                  : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Triads row */}
      <div className="mt-3.5">
        <p className="mb-1.5 text-xs font-medium text-[#9CA3AE]">Triads</p>
        <div className="grid grid-cols-7 gap-1.5">
          {TRIAD_IDS.map((id) => {
            const def = CHORD_DEFS[id];
            const active = selectedSet.has(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-label={`Triad ${def.symbol} (${def.spokenQualityLabel ?? def.spokenLabel})`}
                onClick={() => toggleChord(id)}
                className={`flex min-h-[48px] items-center justify-center rounded-xl border font-roman text-base sm:text-lg font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                  active
                    ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                    : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                }`}
              >
                {def.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seventh chords row */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-[#9CA3AE]">Seventh chords</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {SEVENTH_IDS.map((id) => {
            const def = CHORD_DEFS[id];
            const active = selectedSet.has(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-label={`Seventh ${def.symbol} (${def.spokenLabel})`}
                onClick={() => toggleChord(id)}
                className={`flex min-h-[48px] items-center justify-center rounded-xl border px-1 font-roman text-sm sm:text-[15px] font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                  active
                    ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                    : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                }`}
              >
                {def.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {minGuardNotice && (
        <p className="mt-2.5 text-xs text-[#E5A93C]" role="status">
          Keep at least one chord active.
        </p>
      )}

      {/* Progressive Secondary Dominants drawer */}
      <div className="mt-4 border-t border-[#2B323B] pt-3.5">
        <SwitchRow
          id="toggle-secondary-dominants"
          label="Secondary dominants"
          description={
            secondaryDominantsEnabled
              ? 'Always resolves directly to its target chord'
              : 'Add tonicized V/x triads and V7/x dominant sevenths'
          }
          checked={secondaryDominantsEnabled}
          onChange={(enabled) => {
            setSecMinGuardNotice(false);
            onToggleSecondaryDominants(enabled);
          }}
        />

        {secondaryDominantsEnabled && (
          <div className="mt-3 rounded-xl border border-[#2B323B] bg-[#16191D] p-3">
            <div className="flex flex-wrap gap-1.5">
              {SECONDARY_DOMINANT_PRESETS.map((preset) => {
                const isCurrent = setsMatch(
                  allowedSecondaryDominants,
                  preset.chords,
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSecMinGuardNotice(false);
                      onChangeSecondaryDominants([...preset.chords]);
                    }}
                    className={`min-h-[32px] rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                      isCurrent
                        ? 'border-[#E5A93C]/70 bg-[#E5A93C]/15 text-[#E5A93C]'
                        : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-[#9CA3AE]">Triads</p>
                <span className="text-[11px] text-[#7D8590]">
                  V/IV triad is identical to I
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {SECONDARY_TRIAD_IDS.map((id) => {
                  const def = CHORD_DEFS[id];
                  const active = selectedSecondarySet.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Secondary dominant triad ${def.symbol} (${def.spokenLabel})`}
                      onClick={() => toggleSecondaryDominant(id)}
                      className={`flex min-h-[44px] items-center justify-center rounded-xl border px-1 font-roman text-sm sm:text-base font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                        active
                          ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {def.symbol}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-[#9CA3AE]">
                Dominant 7ths
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {SECONDARY_SEVENTH_IDS.map((id) => {
                  const def = CHORD_DEFS[id];
                  const active = selectedSecondarySet.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Secondary dominant seventh ${def.symbol} (${def.spokenLabel})`}
                      onClick={() => toggleSecondaryDominant(id)}
                      className={`flex min-h-[44px] items-center justify-center rounded-xl border px-1 font-roman text-xs sm:text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                        active
                          ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {def.symbol}
                    </button>
                  );
                })}
              </div>
            </div>

            {secMinGuardNotice && (
              <p className="mt-2.5 text-xs text-[#E5A93C]" role="status">
                Keep at least one secondary dominant active, or turn the toggle off.
              </p>
            )}

            {hasAutoResolvedTarget && (
              <p className="mt-2.5 text-[11px] leading-relaxed text-[#9CA3AE]">
                Unchecked resolution targets still play automatically after their secondary dominant.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-[#2B323B] pt-3.5">
        <SwitchRow
          id="toggle-triad-quality"
          label="Speak triad qualities"
          description={
            announceTriadQuality
              ? 'Says major, minor, and diminished (e.g. "One major, Two minor")'
              : 'Says numbers only for triads (e.g. "One, Two, Seven")'
          }
          checked={announceTriadQuality}
          onChange={onToggleTriadQuality}
        />

        <SwitchRow
          id="toggle-chords-behind-answer"
          label="Play chords behind answer voice"
          description="Carves a gentle midrange EQ pocket behind the narrator"
          checked={playChordsBehindAnswer}
          onChange={onToggleChordsBehindAnswer}
        />
      </div>
    </section>
  );
}
