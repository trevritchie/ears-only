import { Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import type { SessionPhase } from '../engine/sessionController';

interface TransportBarProps {
  isRunning: boolean;
  phase: SessionPhase;
  hasProgression: boolean;
  onStart: () => void;
  onStop: () => void;
  onReplay: () => void;
  onSkip: () => void;
}

export function TransportBar({
  isRunning,
  phase,
  hasProgression,
  onStart,
  onStop,
  onReplay,
  onSkip,
}: TransportBarProps) {
  const isAnswerOrAfter =
    phase === 'answer_revealing' ||
    phase === 'post_answer_pause' ||
    phase === 'post_answer_replay' ||
    phase === 'next_question_pause';

  if (!isRunning) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={onStart}
          className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#E5A93C] px-6 text-base font-bold text-[#121417] transition active:scale-[0.99] hover:bg-[#ebb553] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
        >
          <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          <span>Start Pocket Mode</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="mt-3 grid grid-cols-3 gap-2.5"
      role="group"
      aria-label="Session transport controls"
    >
      <button
        type="button"
        onClick={onReplay}
        disabled={!hasProgression}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#343C47] bg-[#252B33] px-3 text-sm font-semibold text-[#F3EFE6] transition active:scale-[0.98] hover:border-[#495463] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
      >
        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Replay</span>
      </button>

      <button
        type="button"
        onClick={onStop}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#F3EFE6] px-3 text-sm font-bold text-[#121417] transition active:scale-[0.98] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
      >
        <Square className="h-4 w-4 fill-current shrink-0" aria-hidden="true" />
        <span>Stop</span>
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#4FB3A4]/60 bg-[#4FB3A4]/15 px-3 text-sm font-semibold text-[#F3EFE6] transition active:scale-[0.98] hover:bg-[#4FB3A4]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4]"
      >
        <SkipForward className="h-4 w-4 shrink-0 text-[#4FB3A4]" aria-hidden="true" />
        <span>{isAnswerOrAfter ? 'Next' : 'Answer'}</span>
      </button>
    </div>
  );
}
