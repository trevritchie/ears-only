import type { ChoirVowel } from '../audio/choirSamples';
import type { VoicedChord } from './voicing';

export type NoteRole = 'bass' | 'harmony' | 'melody';

export interface ScheduledNote {
  midi: number;
  offsetSec: number;
  /** `null` indicates open sustain until explicitly released by the scheduler. */
  durationSec: number | null;
  velocity: number;
  role: NoteRole;
  /** Optional explicit stereo pan [-1, 1]; falls back to default gentle spread when omitted. */
  pan?: number;
  /** Optional choir vowel articulation ('ooh' or 'ahh'), used by SATB Choir. */
  vowel?: ChoirVowel;
}

export interface ArrangementStrategy {
  arrangeChord(
    voiced: VoicedChord,
    slotDurationSec: number | null,
    rollStepSec?: number,
  ): ScheduledNote[];
}

/**
 * Plays sustained harmonic block chords with an instrument-tailored micro-roll
 * across upper voices and minimal inter-chord gap so release tails overlap
 * smoothly like a sustain pedal.
 */
export class WarmBlockArrangement implements ArrangementStrategy {
  arrangeChord(
    voiced: VoicedChord,
    slotDurationSec: number | null,
    rollStepSec = 0.01,
  ): ScheduledNote[] {
    const fixedDuration =
      slotDurationSec === null ? null : Math.max(0.18, slotDurationSec - 0.015);

    const notes: ScheduledNote[] = [
      {
        midi: voiced.bassMidi,
        offsetSec: 0,
        durationSec: fixedDuration,
        velocity: 0.78,
        role: 'bass',
      },
    ];

    voiced.upperMidis.forEach((midi, index) => {
      const offsetSec = (index + 1) * rollStepSec;
      notes.push({
        midi,
        offsetSec,
        durationSec:
          fixedDuration === null ? null : Math.max(0.14, fixedDuration - offsetSec),
        velocity: index === 2 ? 0.62 : 0.56,
        role: 'harmony',
      });
    });

    return notes;
  }
}

export const defaultArrangementStrategy = new WarmBlockArrangement();
