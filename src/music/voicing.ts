import type { ChordId, PitchClass } from '../types/settings';
import { CHORD_DEFS } from './chords';

export interface VoicedChord {
  chordId: ChordId;
  bassMidi: number;
  upperMidis: [number, number, number];
  allMidis: number[];
}

export interface VoicingStrategy {
  voiceSequence(
    chords: readonly ChordId[],
    key: PitchClass,
    previousVoicing?: VoicedChord,
  ): VoicedChord[];
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const BASS_MIN_MIDI = 40; // E2
const BASS_MAX_MIDI = 55; // G3
const INITIAL_BASS_MIN = 43; // G2
const INITIAL_BASS_MAX = 54; // F#3
const INITIAL_BASS_ANCHOR = 48; // C3
const UPPER_MIN_FLOOR = 57; // A3
const UPPER_MAX_MIDI = 76; // E5
const UPPER_FALLBACK_MAX_MIDI = 79; // G5
const UPPER_CENTER_TARGET = 65; // F4

function selectBassMidi(rootPitchClass: number, prevBassMidi?: number): number {
  const candidates: number[] = [];
  for (let midi = BASS_MIN_MIDI; midi <= BASS_MAX_MIDI; midi++) {
    if (midi % 12 === rootPitchClass) {
      candidates.push(midi);
    }
  }

  if (prevBassMidi === undefined) {
    const preferred = candidates.filter(
      (midi) => midi >= INITIAL_BASS_MIN && midi <= INITIAL_BASS_MAX,
    );
    const pool = preferred.length > 0 ? preferred : candidates;
    return pool.reduce((best, curr) =>
      Math.abs(curr - INITIAL_BASS_ANCHOR) < Math.abs(best - INITIAL_BASS_ANCHOR)
        ? curr
        : best,
    );
  }

  return candidates.reduce((best, curr) => {
    const currDist = Math.abs(curr - prevBassMidi);
    const bestDist = Math.abs(best - prevBassMidi);
    if (currDist !== bestDist) {
      return currDist < bestDist ? curr : best;
    }
    return Math.abs(curr - INITIAL_BASS_ANCHOR) < Math.abs(best - INITIAL_BASS_ANCHOR)
      ? curr
      : best;
  });
}

function generateUpperCandidates(
  upperPitchClasses: readonly [number, number, number],
  minUpperMidi: number,
): [number, number, number][] {
  const buildForRange = (maxMidi: number): [number, number, number][] => {
    const results: [number, number, number][] = [];
    const seen = new Set<string>();

    const rotations: [number, number, number][] = [
      [upperPitchClasses[0], upperPitchClasses[1], upperPitchClasses[2]],
      [upperPitchClasses[1], upperPitchClasses[2], upperPitchClasses[0]],
      [upperPitchClasses[2], upperPitchClasses[0], upperPitchClasses[1]],
    ];

    for (const [pc0, pc1, pc2] of rotations) {
      for (let n0 = minUpperMidi; n0 <= maxMidi; n0++) {
        if (n0 % 12 !== pc0) continue;
        const step1 = (pc1 - pc0 + 12) % 12 || 12;
        const n1 = n0 + step1;
        const step2 = (pc2 - pc1 + 12) % 12 || 12;
        const n2 = n1 + step2;
        if (n2 <= maxMidi) {
          const key = `${n0},${n1},${n2}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push([n0, n1, n2]);
          }
        }
      }
    }

    return results;
  };

  const primary = buildForRange(UPPER_MAX_MIDI);
  if (primary.length > 0) {
    return primary;
  }
  return buildForRange(UPPER_FALLBACK_MAX_MIDI);
}

function registerGravityPenalty(upper: readonly [number, number, number]): number {
  const mean = (upper[0] + upper[1] + upper[2]) / 3;
  return 0.15 * Math.abs(mean - UPPER_CENTER_TARGET);
}

function commonToneCount(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  let count = 0;
  for (const note of a) {
    if (b[0] === note || b[1] === note || b[2] === note) {
      count++;
    }
  }
  return count;
}

function transitionCost(
  prev: readonly [number, number, number],
  curr: readonly [number, number, number],
): number {
  const motion =
    Math.abs(curr[0] - prev[0]) +
    Math.abs(curr[1] - prev[1]) +
    Math.abs(curr[2] - prev[2]);
  return motion - 0.5 * commonToneCount(prev, curr) + registerGravityPenalty(curr);
}

/**
 * Places the chord root in the warm bass register [E2, G3] and uses dynamic
 * programming to select close-position 3-note upper voicings that minimize
 * voice-leading motion across the progression.
 */
export class RootBassVoiceLedStrategy implements VoicingStrategy {
  voiceSequence(
    chords: readonly ChordId[],
    key: PitchClass,
    previousVoicing?: VoicedChord,
  ): VoicedChord[] {
    if (chords.length === 0) return [];

    const bassMidis: number[] = [];
    const candidateLists: [number, number, number][][] = [];

    let prevBass = previousVoicing?.bassMidi;
    for (const chordId of chords) {
      const def = CHORD_DEFS[chordId];
      const rootPitchClass = (key + def.rootOffset) % 12;
      const bassMidi = selectBassMidi(rootPitchClass, prevBass);
      bassMidis.push(bassMidi);
      prevBass = bassMidi;

      const upperPitchClasses: [number, number, number] = [
        (rootPitchClass + def.upperIntervals[0]) % 12,
        (rootPitchClass + def.upperIntervals[1]) % 12,
        (rootPitchClass + def.upperIntervals[2]) % 12,
      ];
      const minUpper = Math.max(UPPER_MIN_FLOOR, bassMidi + 5);
      candidateLists.push(generateUpperCandidates(upperPitchClasses, minUpper));
    }

    const n = chords.length;
    const dpCosts: number[][] = candidateLists.map((cands) =>
      new Array<number>(cands.length).fill(Infinity),
    );
    const backPointers: number[][] = candidateLists.map((cands) =>
      new Array<number>(cands.length).fill(-1),
    );

    // Base step
    for (let c = 0; c < candidateLists[0].length; c++) {
      const cand = candidateLists[0][c];
      dpCosts[0][c] = previousVoicing
        ? transitionCost(previousVoicing.upperMidis, cand)
        : registerGravityPenalty(cand);
    }

    // Viterbi forward pass
    for (let i = 1; i < n; i++) {
      const prevCands = candidateLists[i - 1];
      const currCands = candidateLists[i];
      for (let c = 0; c < currCands.length; c++) {
        let bestCost = Infinity;
        let bestPrev = 0;
        for (let p = 0; p < prevCands.length; p++) {
          const cost =
            dpCosts[i - 1][p] + transitionCost(prevCands[p], currCands[c]);
          if (cost < bestCost) {
            bestCost = cost;
            bestPrev = p;
          }
        }
        dpCosts[i][c] = bestCost;
        backPointers[i][c] = bestPrev;
      }
    }

    // Backtrack best path
    let bestLastIndex = 0;
    let bestLastCost = Infinity;
    for (let c = 0; c < dpCosts[n - 1].length; c++) {
      if (dpCosts[n - 1][c] < bestLastCost) {
        bestLastCost = dpCosts[n - 1][c];
        bestLastIndex = c;
      }
    }

    const chosenUpper: [number, number, number][] = new Array(n);
    let idx = bestLastIndex;
    for (let i = n - 1; i >= 0; i--) {
      chosenUpper[i] = candidateLists[i][idx];
      idx = backPointers[i][idx];
    }

    return chords.map((chordId, i) => ({
      chordId,
      bassMidi: bassMidis[i],
      upperMidis: chosenUpper[i],
      allMidis: [bassMidis[i], ...chosenUpper[i]],
    }));
  }
}

export const defaultVoicingStrategy = new RootBassVoiceLedStrategy();
