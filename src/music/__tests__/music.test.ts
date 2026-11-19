import { describe, expect, it } from 'vitest';
import {
  ALL_CHORD_IDS,
  CHORD_DEFS,
  getMajorScalePitchClasses,
  getSpokenChordPhrase,
  MAJOR_KEYS,
} from '../chords';
import {
  generateProgression,
  getOrientationChords,
  pickRandomNextKey,
} from '../generator';
import { RootBassVoiceLedStrategy } from '../voicing';
import type { ChordId, PitchClass } from '../../types/settings';

function upperMotionDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return (
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  );
}

function naiveRootPositionDistance(
  chords: readonly ChordId[],
  key: PitchClass,
): number {
  const stacks = chords.map((id) => {
    const def = CHORD_DEFS[id];
    const rootMidi = 60 + ((key + def.rootOffset) % 12);
    return [
      rootMidi + def.upperIntervals[0],
      rootMidi + def.upperIntervals[1],
      rootMidi + def.upperIntervals[2],
    ] as [number, number, number];
  });
  let total = 0;
  for (let i = 1; i < stacks.length; i++) {
    total += upperMotionDistance(stacks[i - 1], stacks[i]);
  }
  return total;
}

describe('music theory & chord definitions', () => {
  it('places all 14 chords strictly inside the major scale across all 12 keys', () => {
    for (const keyInfo of MAJOR_KEYS) {
      const scale = getMajorScalePitchClasses(keyInfo.pitchClass);
      for (const chordId of ALL_CHORD_IDS) {
        const def = CHORD_DEFS[chordId];
        const rootPC = (keyInfo.pitchClass + def.rootOffset) % 12;
        for (const interval of def.intervals) {
          const pc = (rootPC + interval) % 12;
          expect(scale.has(pc)).toBe(true);
        }
      }
    }
  });

  it('supports both spoken phrasings for viiø7 with accurate syllable counts', () => {
    const halfDim = getSpokenChordPhrase('viihalfdim7', 'half-diminished');
    expect(halfDim).toEqual({
      text: 'Seven half diminished',
      estimatedSyllables: 6,
    });

    const min7b5 = getSpokenChordPhrase('viihalfdim7', 'minor-seven-flat-five');
    expect(min7b5).toEqual({
      text: 'Seven minor seven flat five',
      estimatedSyllables: 8,
    });
  });
});

describe('RootBassVoiceLedStrategy', () => {
  const strategy = new RootBassVoiceLedStrategy();

  it('keeps bass in [40, 55], upper voices in [max(57, bass+5), 76], and avoids minor-2nd clashes', () => {
    for (const keyInfo of MAJOR_KEYS) {
      const voiced = strategy.voiceSequence(ALL_CHORD_IDS, keyInfo.pitchClass);
      expect(voiced).toHaveLength(ALL_CHORD_IDS.length);

      for (const chord of voiced) {
        expect(chord.bassMidi).toBeGreaterThanOrEqual(40);
        expect(chord.bassMidi).toBeLessThanOrEqual(55);
        expect(chord.upperMidis).toHaveLength(3);

        const [u0, u1, u2] = chord.upperMidis;
        expect(u0).toBeLessThan(u1);
        expect(u1).toBeLessThan(u2);
        expect(u0).toBeGreaterThanOrEqual(Math.max(57, chord.bassMidi + 5));
        expect(u2).toBeLessThanOrEqual(76);

        // No 1-semitone minor-2nd clusters inside the voicing
        expect(u1 - u0).toBeGreaterThanOrEqual(2);
        expect(u2 - u1).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('achieves strictly less voice motion than naive root-position stacking', () => {
    const sequences: ChordId[][] = [
      ['I', 'IV', 'V', 'I'],
      ['ii7', 'V7', 'Imaj7'],
      ['I', 'vi', 'IV', 'V7'],
    ];

    for (const seq of sequences) {
      const voiced = strategy.voiceSequence(seq, 0);
      let dpDistance = 0;
      for (let i = 1; i < voiced.length; i++) {
        dpDistance += upperMotionDistance(
          voiced[i - 1].upperMidis,
          voiced[i].upperMidis,
        );
      }
      const naiveDistance = naiveRootPositionDistance(seq, 0);
      expect(dpDistance).toBeLessThan(naiveDistance);
    }
  });
});

describe('progression & key generators', () => {
  it('avoids consecutive duplicate chords when pool has >= 2 chords', () => {
    const pool: ChordId[] = ['I', 'IV', 'V', 'vi'];
    for (let run = 0; run < 20; run++) {
      const seq = generateProgression(pool, 5);
      expect(seq).toHaveLength(5);
      for (let i = 0; i < seq.length; i++) {
        expect(pool).toContain(seq[i]);
        if (i > 0) {
          expect(seq[i]).not.toBe(seq[i - 1]);
        }
      }
    }
  });

  it('handles a 1-chord pool safely without crashing', () => {
    const seq = generateProgression(['Imaj7'], 4);
    expect(seq).toEqual(['Imaj7', 'Imaj7', 'Imaj7', 'Imaj7']);
  });

  it('never picks the current key on key rotation', () => {
    for (const keyInfo of MAJOR_KEYS) {
      for (let i = 0; i < 15; i++) {
        const next = pickRandomNextKey(keyInfo.pitchClass);
        expect(next).not.toBe(keyInfo.pitchClass);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(11);
      }
    }
  });

  it('returns configured orientation chord sequences', () => {
    expect(getOrientationChords('cadence')).toEqual(['I', 'IV', 'V', 'I']);
    expect(getOrientationChords('tonic')).toEqual(['I']);
    expect(getOrientationChords('none')).toEqual([]);
  });
});
