import type { VoicedChord } from './voicing';

export type NoteRole = 'bass' | 'harmony' | 'melody';

export interface ScheduledNote {
  midi: number;
  offsetSec: number;
  /** `null` indicates open sustain until explicitly released by the scheduler. */
  durationSec: number | null;
  velocity: number;
  role: NoteRole;
}

export interface ArrangementStrategy {
  arrangeChord(voiced: VoicedChord, slotDurationSec: number | null): ScheduledNote[];
}

/**
 * Plays sustained harmonic block chords with a subtle 8ms upward micro-roll
 * across upper voices to prevent harsh phase-locked oscillator transients.
 */
export class WarmBlockArrangement implements ArrangementStrategy {
  arrangeChord(voiced: VoicedChord, slotDurationSec: number | null): ScheduledNote[] {
    const fixedDuration =
      slotDurationSec === null ? null : Math.max(0.18, slotDurationSec - 0.04);

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
      const offsetSec = (index + 1) * 0.008;
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
