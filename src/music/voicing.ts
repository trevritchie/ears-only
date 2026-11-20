import type {
  ChordId,
  ChordInversion,
  PitchClass,
  ProgressionChord,
} from '../types/settings';
import { CHORD_DEFS } from './chords';

export interface VoicedChord {
  chordId: ChordId;
  inversion: ChordInversion;
  bassMidi: number;
  upperMidis: [number, number, number];
  allMidis: number[];
}

export interface VoicingOptions {
  maxUpperMidi?: number;
  upperCenterTarget?: number;
}

export interface VoicingStrategy {
  voiceSequence(
    chords: readonly (ChordId | ProgressionChord)[],
    key: PitchClass,
    previousVoicing?: VoicedChord,
    options?: VoicingOptions,
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

interface UpperCandidate {
  upper: [number, number, number];
  doublingPenalty: number;
}

function selectBassMidi(bassPitchClass: number, prevBassMidi?: number): number {
  const candidates: number[] = [];
  for (let midi = BASS_MIN_MIDI; midi <= BASS_MAX_MIDI; midi++) {
    if (midi % 12 === bassPitchClass) {
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
  maxUpperMidi: number = UPPER_MAX_MIDI,
  fallbackMaxMidi: number = UPPER_FALLBACK_MAX_MIDI,
): [number, number, number][] {
  const buildForRange = (
    maxMidi: number,
    requireNoMinorSecond: boolean,
  ): [number, number, number][] => {
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
        if (
          n2 <= maxMidi &&
          (!requireNoMinorSecond || (n1 - n0 >= 2 && n2 - n1 >= 2))
        ) {
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

  const primaryClean = buildForRange(maxUpperMidi, true);
  if (primaryClean.length > 0) return primaryClean;

  const fallbackClean = buildForRange(fallbackMaxMidi, true);
  if (fallbackClean.length > 0) return fallbackClean;

  const primaryAny = buildForRange(maxUpperMidi, false);
  if (primaryAny.length > 0) return primaryAny;

  return buildForRange(fallbackMaxMidi, false);
}

function generateDoubledPairCandidates(
  pcA: number,
  pcB: number,
  minUpperMidi: number,
  maxUpperMidi: number = UPPER_MAX_MIDI,
  fallbackMaxMidi: number = UPPER_FALLBACK_MAX_MIDI,
): [number, number, number][] {
  const buildForRange = (maxMidi: number): [number, number, number][] => {
    const results: [number, number, number][] = [];
    for (let n0 = minUpperMidi; n0 <= maxMidi - 12; n0++) {
      if (n0 % 12 !== pcA) continue;
      const step1 = (pcB - pcA + 12) % 12 || 12;
      const n1 = n0 + step1;
      const n2 = n0 + 12;
      if (n1 > n0 && n1 < n2 && n2 <= maxMidi && n1 - n0 >= 2 && n2 - n1 >= 2) {
        results.push([n0, n1, n2]);
      }
    }
    return results;
  };

  const primary = buildForRange(maxUpperMidi);
  if (primary.length > 0) return primary;
  return buildForRange(fallbackMaxMidi);
}

function buildCandidatesForChord(
  chordId: ChordId,
  inversion: ChordInversion,
  rootPitchClass: number,
  minUpperMidi: number,
  maxUpperMidi: number = UPPER_MAX_MIDI,
  fallbackMaxMidi: number = UPPER_FALLBACK_MAX_MIDI,
): UpperCandidate[] {
  const def = CHORD_DEFS[chordId];
  const intervals = def.intervals;

  if (intervals.length === 4) {
    // Complete 4-note 7th chord: the remaining 3 distinct chord tones go to T/A/S.
    const remaining = intervals.filter((_, idx) => idx !== inversion);
    const upperPcs: [number, number, number] = [
      (rootPitchClass + remaining[0]) % 12,
      (rootPitchClass + remaining[1]) % 12,
      (rootPitchClass + remaining[2]) % 12,
    ];
    return generateUpperCandidates(
      upperPcs,
      minUpperMidi,
      maxUpperMidi,
      fallbackMaxMidi,
    ).map((upper) => ({
      upper,
      doublingPenalty: 0,
    }));
  }

  // Triads: 3 distinct pitch classes mapped across 4 voices according to SATB rules.
  const rPc = (rootPitchClass + intervals[0]) % 12;
  const tPc = (rootPitchClass + intervals[1]) % 12;
  const fPc = (rootPitchClass + intervals[2]) % 12;

  // Root position doubles the root; 2nd inversion (6/4) always doubles the bass (5th);
  // vii°6 doubles the stable bass (3rd = scale degree 2), never the leading tone or tritone.
  if (inversion === 0 || inversion === 2 || chordId === 'viio') {
    return generateUpperCandidates(
      [rPc, tPc, fPc],
      minUpperMidi,
      maxUpperMidi,
      fallbackMaxMidi,
    ).map((upper) => ({
      upper,
      doublingPenalty: 0,
    }));
  }

  // 1st inversion triad (6): bass holds the 3rd.
  const candidateMap = new Map<string, UpperCandidate>();
  const addPool = (
    pool: [number, number, number][],
    doublingPenalty: number,
  ) => {
    for (const upper of pool) {
      const key = `${upper[0]},${upper[1]},${upper[2]}`;
      const existing = candidateMap.get(key);
      if (!existing || doublingPenalty < existing.doublingPenalty) {
        candidateMap.set(key, { upper, doublingPenalty });
      }
    }
  };

  // Double root or fifth (both keep the leading-tone 3rd single).
  addPool(
    generateDoubledPairCandidates(
      rPc,
      fPc,
      minUpperMidi,
      maxUpperMidi,
      fallbackMaxMidi,
    ),
    0,
  );
  addPool(
    generateDoubledPairCandidates(
      fPc,
      rPc,
      minUpperMidi,
      maxUpperMidi,
      fallbackMaxMidi,
    ),
    chordId === 'V' || def.category === 'secondary-triad' ? 0.35 : 0.45,
  );

  // Never double the leading tone in the bass on V6 or V6/x secondary dominants.
  if (chordId !== 'V' && def.category !== 'secondary-triad') {
    const tonalThirdPenalty =
      chordId === 'ii' || chordId === 'IV' || chordId === 'vi' ? 0.2 : 0.7;
    addPool(
      generateUpperCandidates(
        [rPc, tPc, fPc],
        minUpperMidi,
        maxUpperMidi,
        fallbackMaxMidi,
      ),
      tonalThirdPenalty,
    );
  }

  const combined = Array.from(candidateMap.values());
  if (combined.length > 0) return combined;

  return generateUpperCandidates(
    [rPc, tPc, fPc],
    minUpperMidi,
    maxUpperMidi,
    fallbackMaxMidi,
  ).map((upper) => ({
    upper,
    doublingPenalty: 0,
  }));
}

function registerGravityPenalty(
  upper: readonly [number, number, number],
  centerTarget: number = UPPER_CENTER_TARGET,
): number {
  const mean = (upper[0] + upper[1] + upper[2]) / 3;
  return 0.15 * Math.abs(mean - centerTarget);
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

function parallelFifthOctavePenalty(
  prevBass: number,
  prevUpper: readonly [number, number, number],
  currBass: number,
  currUpper: readonly [number, number, number],
): number {
  const prevVoices = [prevBass, prevUpper[0], prevUpper[1], prevUpper[2]];
  const currVoices = [currBass, currUpper[0], currUpper[1], currUpper[2]];
  let penalty = 0;

  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const da = currVoices[a] - prevVoices[a];
      const db = currVoices[b] - prevVoices[b];
      if (da !== 0 && db !== 0 && Math.sign(da) === Math.sign(db)) {
        const prevInt = (((prevVoices[b] - prevVoices[a]) % 12) + 12) % 12;
        const currInt = (((currVoices[b] - currVoices[a]) % 12) + 12) % 12;
        if ((prevInt === 0 && currInt === 0) || (prevInt === 7 && currInt === 7)) {
          penalty += 6.0;
        }
      }
    }
  }

  return penalty;
}

function transitionCost(
  prevBass: number,
  prev: readonly [number, number, number],
  currBass: number,
  curr: UpperCandidate,
  centerTarget: number = UPPER_CENTER_TARGET,
): number {
  const motion =
    Math.abs(curr.upper[0] - prev[0]) +
    Math.abs(curr.upper[1] - prev[1]) +
    Math.abs(curr.upper[2] - prev[2]);
  return (
    motion -
    0.5 * commonToneCount(prev, curr.upper) +
    registerGravityPenalty(curr.upper, centerTarget) +
    curr.doublingPenalty +
    parallelFifthOctavePenalty(prevBass, prev, currBass, curr.upper)
  );
}

/**
 * Places each chord's active bass inversion tone in [E2, G3] nearest the prior
 * bass and uses 4-voice Viterbi dynamic programming to minimize upper-voice motion,
 * enforce SATB doubling rules, and avoid parallel fifths and octaves.
 */
export class RootBassVoiceLedStrategy implements VoicingStrategy {
  voiceSequence(
    chords: readonly (ChordId | ProgressionChord)[],
    key: PitchClass,
    previousVoicing?: VoicedChord,
    options?: VoicingOptions,
  ): VoicedChord[] {
    if (chords.length === 0) return [];

    const maxUpper = options?.maxUpperMidi ?? UPPER_MAX_MIDI;
    const fallbackMaxUpper =
      options?.maxUpperMidi !== undefined
        ? Math.max(maxUpper + 3, UPPER_FALLBACK_MAX_MIDI)
        : UPPER_FALLBACK_MAX_MIDI;
    const centerTarget = options?.upperCenterTarget ?? UPPER_CENTER_TARGET;

    const normalized: ProgressionChord[] = chords.map((item) => {
      if (typeof item === 'string') {
        return { chordId: item, inversion: 0 };
      }
      const maxInv = CHORD_DEFS[item.chordId].intervals.length - 1;
      const safeInv = Math.max(0, Math.min(maxInv, item.inversion)) as ChordInversion;
      return { chordId: item.chordId, inversion: safeInv };
    });

    const bassMidis: number[] = [];
    const candidateLists: UpperCandidate[][] = [];

    let prevBass = previousVoicing?.bassMidi;
    for (const { chordId, inversion } of normalized) {
      const def = CHORD_DEFS[chordId];
      const rootPitchClass = (key + def.rootOffset) % 12;
      const bassInterval = def.intervals[inversion] ?? 0;
      const bassPitchClass = (rootPitchClass + bassInterval) % 12;
      const bassMidi = selectBassMidi(bassPitchClass, prevBass);
      bassMidis.push(bassMidi);
      prevBass = bassMidi;

      const minUpper = Math.max(UPPER_MIN_FLOOR, bassMidi + 5);
      candidateLists.push(
        buildCandidatesForChord(
          chordId,
          inversion,
          rootPitchClass,
          minUpper,
          maxUpper,
          fallbackMaxUpper,
        ),
      );
    }

    const n = normalized.length;
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
        ? transitionCost(
            previousVoicing.bassMidi,
            previousVoicing.upperMidis,
            bassMidis[0],
            cand,
            centerTarget,
          )
        : registerGravityPenalty(cand.upper, centerTarget) +
          cand.doublingPenalty;
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
            dpCosts[i - 1][p] +
            transitionCost(
              bassMidis[i - 1],
              prevCands[p].upper,
              bassMidis[i],
              currCands[c],
              centerTarget,
            );
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
      chosenUpper[i] = candidateLists[i][idx].upper;
      idx = backPointers[i][idx];
    }

    return normalized.map(({ chordId, inversion }, i) => ({
      chordId,
      inversion,
      bassMidi: bassMidis[i],
      upperMidis: chosenUpper[i],
      allMidis: [bassMidis[i], ...chosenUpper[i]],
    }));
  }
}

export const defaultVoicingStrategy = new RootBassVoiceLedStrategy();
