import { describe, expect, it } from 'vitest';
import {
  ALL_CHORD_IDS,
  ALL_SECONDARY_DOMINANT_IDS,
  CHORD_DEFS,
  DIATONIC_CHORD_IDS,
  getMajorScalePitchClasses,
  getScaleDegreePitchClass,
  getSpokenChordPhrase,
  isSecondaryDominantId,
  MAJOR_KEYS,
  SECONDARY_SEVENTH_IDS,
  SECONDARY_TRIAD_IDS,
} from '../chords';
import {
  generateProgression,
  getOrientationChords,
  pickRandomNextKey,
} from '../generator';
import {
  computeProgressionVoicePans,
  generateRandomVoicePans,
  getOrderedVoicePans,
  getSatbVoicePans,
  matchUpperVoicePans,
} from '../panning';
import { RootBassVoiceLedStrategy } from '../voicing';
import type { ChordId, DiatonicChordId, PitchClass } from '../../types/settings';

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
  it('places all 14 diatonic chords strictly inside the major scale across all 12 keys', () => {
    for (const keyInfo of MAJOR_KEYS) {
      const scale = getMajorScalePitchClasses(keyInfo.pitchClass);
      for (const chordId of DIATONIC_CHORD_IDS) {
        const def = CHORD_DEFS[chordId];
        const rootPC = (keyInfo.pitchClass + def.rootOffset) % 12;
        for (const interval of def.intervals) {
          const pc = (rootPC + interval) % 12;
          expect(scale.has(pc)).toBe(true);
        }
      }
    }
  });

  it('defines all 9 secondary dominants a fifth above their target with chromatic tones and concise spoken labels', () => {
    expect(SECONDARY_TRIAD_IDS).toEqual(['V/ii', 'V/iii', 'V/V', 'V/vi']);
    expect(SECONDARY_SEVENTH_IDS).toEqual([
      'V7/ii',
      'V7/iii',
      'V7/IV',
      'V7/V',
      'V7/vi',
    ]);

    for (const keyInfo of MAJOR_KEYS) {
      const scale = getMajorScalePitchClasses(keyInfo.pitchClass);
      for (const secId of ALL_SECONDARY_DOMINANT_IDS) {
        const def = CHORD_DEFS[secId];
        expect(def.resolvesTo).toBeDefined();
        const targetRootOffset = CHORD_DEFS[def.resolvesTo![0]].rootOffset;
        // Root must be a perfect fifth (+7 semitones) above its target chord
        expect(def.rootOffset).toBe((targetRootOffset + 7) % 12);

        const rootPC = (keyInfo.pitchClass + def.rootOffset) % 12;
        const chordPCs = def.intervals.map((i) => (rootPC + i) % 12);
        // Every secondary dominant introduces at least one chromatic (out-of-key) tone
        expect(chordPCs.some((pc) => !scale.has(pc))).toBe(true);
      }
    }

    expect(getSpokenChordPhrase('V/ii', 'half-diminished').text).toBe(
      'Five of two',
    );
    expect(getSpokenChordPhrase('V/V', 'half-diminished', true).text).toBe(
      'Five of five',
    );
    expect(getSpokenChordPhrase('V7/IV', 'half-diminished').text).toBe(
      'Five seven of four',
    );
    expect(getSpokenChordPhrase('V7/vi', 'half-diminished', true).text).toBe(
      'Five seven of six',
    );
  });

  it('omits triad quality words by default and announces major/minor/diminished when enabled while keeping sevenths unchanged', () => {
    // Default (announceTriadQuality = false): numbers only for all 7 triads
    expect(getSpokenChordPhrase('I', 'half-diminished').text).toBe('One');
    expect(getSpokenChordPhrase('ii', 'half-diminished').text).toBe('Two');
    expect(getSpokenChordPhrase('iii', 'half-diminished').text).toBe('Three');
    expect(getSpokenChordPhrase('IV', 'half-diminished').text).toBe('Four');
    expect(getSpokenChordPhrase('V', 'half-diminished').text).toBe('Five');
    expect(getSpokenChordPhrase('vi', 'half-diminished').text).toBe('Six');
    expect(getSpokenChordPhrase('viio', 'half-diminished').text).toBe('Seven');

    // Enabled (announceTriadQuality = true): includes major on I/IV/V, minor on ii/iii/vi, diminished on vii°
    expect(getSpokenChordPhrase('I', 'half-diminished', true)).toEqual({
      text: 'One major',
      estimatedSyllables: 3,
    });
    expect(getSpokenChordPhrase('ii', 'half-diminished', true).text).toBe('Two minor');
    expect(getSpokenChordPhrase('iii', 'half-diminished', true).text).toBe('Three minor');
    expect(getSpokenChordPhrase('IV', 'half-diminished', true).text).toBe('Four major');
    expect(getSpokenChordPhrase('V', 'half-diminished', true).text).toBe('Five major');
    expect(getSpokenChordPhrase('vi', 'half-diminished', true).text).toBe('Six minor');
    expect(getSpokenChordPhrase('viio', 'half-diminished', true)).toEqual({
      text: 'Seven diminished',
      estimatedSyllables: 5,
    });

    // Seventh chords stay identical regardless of announceTriadQuality
    expect(getSpokenChordPhrase('V7', 'half-diminished')).toEqual({
      text: 'Five dominant seven',
      estimatedSyllables: 6,
    });
    for (const seventhId of [
      'Imaj7',
      'ii7',
      'iii7',
      'IVmaj7',
      'V7',
      'vi7',
      'viihalfdim7',
    ] as const) {
      expect(getSpokenChordPhrase(seventhId, 'half-diminished', true)).toEqual(
        getSpokenChordPhrase(seventhId, 'half-diminished', false),
      );
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

  it('resolves scale degrees 1-7 relative to any active major key', () => {
    // Key of C (0): 1=C(0), 3=E(4), 5=G(7), 7=B(11)
    expect(getScaleDegreePitchClass(0, 1)).toBe(0);
    expect(getScaleDegreePitchClass(0, 3)).toBe(4);
    expect(getScaleDegreePitchClass(0, 5)).toBe(7);
    expect(getScaleDegreePitchClass(0, 7)).toBe(11);

    // Key of G (7): 1=G(7), 4=C(0), 5=D(2), 7=F#(6)
    expect(getScaleDegreePitchClass(7, 1)).toBe(7);
    expect(getScaleDegreePitchClass(7, 4)).toBe(0);
    expect(getScaleDegreePitchClass(7, 5)).toBe(2);
    expect(getScaleDegreePitchClass(7, 7)).toBe(6);
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
  it('avoids consecutive duplicate chords when pool has >= 2 chords (up to 8-chord progressions)', () => {
    const pool: DiatonicChordId[] = ['I', 'IV', 'V', 'vi'];
    for (const len of [4, 5, 8]) {
      for (let run = 0; run < 15; run++) {
        const seq = generateProgression(pool, len);
        expect(seq).toHaveLength(len);
        for (let i = 0; i < seq.length; i++) {
          expect(pool).toContain(seq[i]);
          if (i > 0) {
            expect(seq[i]).not.toBe(seq[i - 1]);
          }
        }
      }
    }
  });

  it('strictly resolves secondary dominants to their target chord and never places them last', () => {
    const diatonicPool: DiatonicChordId[] = ['I', 'IV', 'V', 'vi'];
    let secDomSeen = 0;

    for (const len of [2, 3, 4, 6, 8]) {
      for (let run = 0; run < 30; run++) {
        const seq = generateProgression(
          diatonicPool,
          len,
          undefined,
          Math.random,
          ALL_SECONDARY_DOMINANT_IDS,
        );
        expect(seq).toHaveLength(len);
        // Never ends on a secondary dominant
        expect(isSecondaryDominantId(seq[seq.length - 1])).toBe(false);

        for (let i = 0; i < seq.length; i++) {
          if (i > 0) {
            expect(seq[i]).not.toBe(seq[i - 1]);
          }
          if (isSecondaryDominantId(seq[i])) {
            secDomSeen++;
            const expectedTargets = CHORD_DEFS[seq[i]].resolvesTo!;
            expect(expectedTargets).toContain(seq[i + 1]);
          }
        }
      }
    }

    expect(secDomSeen).toBeGreaterThan(20);

    // When diatonic pool is sevenths-only and target isn't checked, resolves to seventh target
    const seventhFallbackSeq = generateProgression(
      ['Imaj7', 'IVmaj7'],
      2,
      undefined,
      () => 0.05,
      ['V7/ii'],
    );
    expect(seventhFallbackSeq).toEqual(['V7/ii', 'ii7']);

    // With strictSecondaryResolution=false, secondary dominants can move freely & land last without consecutive duplicates
    let endedOnSecDom = false;
    let nonTargetFollow = false;
    for (let run = 0; run < 120; run++) {
      const seq = generateProgression(
        ['I', 'IV'],
        4,
        undefined,
        Math.random,
        ['V7/V', 'V7/vi'],
        false,
      );
      expect(seq).toHaveLength(4);
      if (isSecondaryDominantId(seq[seq.length - 1])) {
        endedOnSecDom = true;
      }
      for (let i = 0; i < seq.length; i++) {
        if (i > 0) {
          expect(seq[i]).not.toBe(seq[i - 1]);
        }
        if (
          isSecondaryDominantId(seq[i]) &&
          i < seq.length - 1 &&
          !CHORD_DEFS[seq[i]].resolvesTo!.includes(seq[i + 1] as never)
        ) {
          nonTargetFollow = true;
        }
      }
    }
    expect(endedOnSecDom).toBe(true);
    expect(nonTargetFollow).toBe(true);
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

describe('voice-led stereo panning', () => {
  it('returns low-to-high ordered stereo pans, traditional SATB section pans, and randomized seats', () => {
    expect(getOrderedVoicePans(4)).toEqual([-0.84, -0.28, 0.28, 0.84]);
    // [Bass, Tenor, Alto, Soprano] -> S left (-0.72), T center-left (-0.24), B center-right (+0.24), A right (+0.72)
    expect(getSatbVoicePans(4)).toEqual([0.24, -0.24, 0.72, -0.72]);
    const topVoicePositions = new Set<number>();
    for (let run = 0; run < 40; run++) {
      const pans = generateRandomVoicePans(4);
      expect(pans).toHaveLength(4);
      expect([...pans].sort((a, b) => a - b)).toEqual([
        -0.84, -0.28, 0.28, 0.84,
      ]);
      topVoicePositions.add(pans[3]);
    }
    // Over 40 draws, the highest voice should not stay stuck in a single seat
    expect(topVoicePositions.size).toBeGreaterThan(1);
  });

  it('keeps common tones and closest voice-led steps locked to their previous stereo pan', () => {
    // I (C4, E4, G4) -> vi (A3, C4, E4): common tones C4 and E4 must keep their pans!
    const nextPans = matchUpperVoicePans(
      [60, 64, 67],
      [-0.6, 0.2, 0.55],
      [57, 60, 64],
    );
    expect(nextPans).toEqual([0.55, -0.6, 0.2]);

    // Across a full voiced progression, bass stays in its seat and upper pan set is preserved
    const strategy = new RootBassVoiceLedStrategy();
    const voiced = strategy.voiceSequence(['ii7', 'V7', 'Imaj7'], 0);
    const progPans = computeProgressionVoicePans(
      voiced,
      undefined,
      [-0.55, -0.2, 0.22, 0.6],
    );
    expect(progPans).toHaveLength(3);
    // Bass keeps its pan seat across every chord
    expect(progPans[0][0]).toBe(-0.55);
    expect(progPans[1][0]).toBe(-0.55);
    expect(progPans[2][0]).toBe(-0.55);
    // Upper voice pan set is strictly preserved (voices never jump to brand-new random spots)
    for (const chordPans of progPans) {
      expect([...chordPans.slice(1)].sort((a, b) => a - b)).toEqual([
        -0.2, 0.22, 0.6,
      ]);
    }
  });
});
