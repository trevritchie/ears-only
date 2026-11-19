import { VolumeX } from 'lucide-react';
import type { SessionSnapshot } from '../engine/sessionController';
import { CHORD_DEFS, getMajorKeyInfo } from '../music/chords';
import type { SessionSettings } from '../types/settings';

interface PocketStageProps {
  snapshot: SessionSnapshot;
  settings: SessionSettings;
}

function getPhaseLabel(
  snapshot: SessionSnapshot,
  settings: SessionSettings,
): string {
  const keyInfo = getMajorKeyInfo(snapshot.activeKey);
  switch (snapshot.phase) {
    case 'idle':
      return settings.keyMode === 'auto-rotate'
        ? 'Ready · Auto-rotate keys'
        : `Ready in ${keyInfo.displayName}`;
    case 'orienting_voice':
    case 'orienting_cadence':
      return `Key of ${keyInfo.displayName}: orienting`;
    case 'inter_phase_pause':
      return `Key of ${keyInfo.displayName}: listen`;
    case 'question_playing':
    case 'repeat_pause':
      return `Listening · Pass ${snapshot.currentPass} of ${snapshot.totalPasses}`;
    case 'pre_answer_pause':
      return 'Answer coming up';
    case 'answer_revealing':
      return 'Answer';
    case 'post_answer_pause':
    case 'post_answer_replay':
      return 'Final replay';
    case 'next_question_pause':
      return 'Next question';
  }
}

export function PocketStage({ snapshot, settings }: PocketStageProps) {
  const keyInfo = getMajorKeyInfo(snapshot.activeKey);
  const keyBadgeLabel =
    !snapshot.isRunning && settings.keyMode === 'auto-rotate'
      ? 'Auto key'
      : keyInfo.displayName;
  const isOrienting =
    (snapshot.phase === 'orienting_voice' ||
      snapshot.phase === 'orienting_cadence') &&
    snapshot.orientationChords.length > 0;

  const slotCount = snapshot.isRunning
    ? snapshot.progression.length || settings.progressionLength
    : settings.progressionLength;

  const isTwoRowStage = !isOrienting && slotCount > 5;
  const stageColumns = isOrienting
    ? snapshot.orientationChords.length
    : isTwoRowStage
      ? Math.ceil(slotCount / 2)
      : slotCount;

  return (
    <section
      aria-label="Active session stage"
      className="rounded-2xl border border-[#2B323B] bg-[#1B1F24] p-4 sm:p-5"
    >
      {/* Top quiet instrument metadata bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold tracking-tight text-[#F3EFE6]">
            Ears Only
          </h1>
          <span className="rounded-md border border-[#343C47] bg-[#252B33] px-2.5 py-0.5 text-xs font-medium text-[#F3EFE6]">
            {keyBadgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#9CA3AE]">
          {snapshot.isRunning && snapshot.questionNumber > 0 && (
            <span className="tabular-nums font-medium text-[#F3EFE6]">
              Q{snapshot.questionNumber}
            </span>
          )}
        </div>
      </div>

      {/* Phase status readout */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#9CA3AE]" aria-live="polite">
          {getPhaseLabel(snapshot, settings)}
        </p>
        {!snapshot.isRunning && (
          <span className="text-xs text-[#9CA3AE] tabular-nums">
            {(() => {
              const totalChords =
                settings.allowedChords.length +
                (settings.secondaryDominantsEnabled
                  ? settings.allowedSecondaryDominants.length
                  : 0);
              return `${totalChords} chord${totalChords === 1 ? '' : 's'} · ${settings.bpm} BPM`;
            })()}
          </span>
        )}
      </div>

      {/* Harmonic pad strip */}
      <div
        className="mt-3 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${stageColumns}, minmax(0, 1fr))`,
        }}
      >
        {isOrienting
          ? snapshot.orientationChords.map((chordId, idx) => {
              const isActive = snapshot.orientationStepIndex === idx;
              return (
                <div
                  key={`orient-${idx}-${chordId}`}
                  className={`flex h-16 items-center justify-center rounded-xl border transition-colors ${
                    isActive
                      ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                      : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE]'
                  }`}
                >
                  <span className="font-roman text-2xl font-semibold">
                    {CHORD_DEFS[chordId].symbol}
                  </span>
                </div>
              );
            })
          : Array.from({ length: slotCount }).map((_, idx) => {
              const chordId = snapshot.progression[idx];
              const isRevealed =
                snapshot.isRunning &&
                chordId !== undefined &&
                idx < snapshot.revealedCount;
              const isActive = snapshot.isRunning && snapshot.activeChordIndex === idx;

              let slotStyle = 'border-[#2B323B] bg-[#16191D] text-[#5C6470]';
              if (isRevealed && isActive) {
                slotStyle = 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#F3EFE6]';
              } else if (isRevealed) {
                slotStyle = 'border-[#4FB3A4]/50 bg-[#20292B] text-[#4FB3A4]';
              } else if (isActive) {
                slotStyle = 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]';
              } else if (snapshot.isRunning) {
                slotStyle = 'border-[#343C47] bg-[#252B33] text-[#9CA3AE]';
              }

              return (
                <div
                  key={`slot-${idx}`}
                  data-testid={`stage-slot-${idx}`}
                  className={`flex ${isTwoRowStage ? 'h-14' : 'h-16'} items-center justify-center rounded-xl border transition-colors ${slotStyle}`}
                >
                  {isRevealed ? (
                    <span
                      className={`px-1 whitespace-nowrap font-roman ${
                        CHORD_DEFS[chordId].symbol.length >= 5
                          ? isTwoRowStage
                            ? 'text-sm sm:text-base'
                            : 'text-base sm:text-xl'
                          : isTwoRowStage
                            ? 'text-lg sm:text-xl'
                            : 'text-xl sm:text-2xl'
                      } font-semibold tracking-tight`}
                    >
                      {CHORD_DEFS[chordId].symbol}
                    </span>
                  ) : (
                    <span
                      className="h-1 w-4 rounded-full bg-current opacity-40"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
      </div>

      {!snapshot.speechAvailable && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[#E5A93C]">
          <VolumeX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Speech synthesis is unavailable in this browser; answers reveal visually.
          </span>
        </p>
      )}
    </section>
  );
}
