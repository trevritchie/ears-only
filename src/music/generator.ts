import type {
  ChordId,
  DiatonicChordId,
  KeyOrientationMode,
  PitchClass,
  SecondaryDominantId,
} from '../types/settings';
import { CHORD_DEFS } from './chords';

function pickRandomItem<T>(items: readonly T[], rng: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index];
}

function sequencesEqual(a: readonly ChordId[], b: readonly ChordId[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function getCandidateResolutionTargets(
  secDom: SecondaryDominantId,
  allowedChords: readonly DiatonicChordId[],
): DiatonicChordId[] {
  const resolvesTo = CHORD_DEFS[secDom].resolvesTo;
  if (!resolvesTo) return [];
  const allowedSet = new Set<DiatonicChordId>(allowedChords);
  const enabledTargets = resolvesTo.filter((t) => allowedSet.has(t));
  if (enabledTargets.length > 0) {
    return enabledTargets;
  }
  const allSevenths =
    allowedChords.length > 0 &&
    allowedChords.every((c) => CHORD_DEFS[c].category === 'seventh');
  return [allSevenths ? resolvesTo[1] : resolvesTo[0]];
}

export function generateProgression(
  allowedChords: readonly DiatonicChordId[],
  length: number,
  previous?: readonly ChordId[],
  rng: () => number = Math.random,
  secondaryDominants: readonly SecondaryDominantId[] = [],
  strictSecondaryResolution = true,
): ChordId[] {
  if (allowedChords.length === 0) {
    throw new Error('At least one chord must be enabled to generate a progression.');
  }
  if (length <= 0) {
    return [];
  }

  const hasSecDoms =
    secondaryDominants.length > 0 &&
    (!strictSecondaryResolution || length >= 2);
  const secDomProb = hasSecDoms
    ? Math.min(
        0.35,
        Math.max(
          0.18,
          secondaryDominants.length /
            (allowedChords.length + secondaryDominants.length),
        ),
      )
    : 0;
  const maxAttempts =
    (allowedChords.length >= 2 || hasSecDoms) && length >= 2 ? 5 : 1;

  let candidate: ChordId[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    candidate = [];
    let i = 0;
    while (i < length) {
      const prevChord = i > 0 ? candidate[i - 1] : undefined;

      const secPool =
        prevChord !== undefined
          ? secondaryDominants.filter((c) => c !== prevChord)
          : secondaryDominants;
      const canStartSecDom =
        hasSecDoms &&
        secPool.length > 0 &&
        (strictSecondaryResolution ? i < length - 1 : true);

      if (canStartSecDom && rng() < secDomProb) {
        const secDom = pickRandomItem(secPool, rng);
        if (strictSecondaryResolution) {
          // Strict resolution: immediately resolve to the diatonic target chord.
          const targets = getCandidateResolutionTargets(secDom, allowedChords);
          const target = pickRandomItem(targets, rng);
          candidate.push(secDom, target);
          i += 2;
        } else {
          candidate.push(secDom);
          i += 1;
        }
        continue;
      }

      if (allowedChords.length === 1) {
        candidate.push(allowedChords[0]);
      } else {
        const pool =
          prevChord !== undefined
            ? allowedChords.filter((c) => c !== prevChord)
            : allowedChords;
        candidate.push(
          pickRandomItem(pool.length > 0 ? pool : allowedChords, rng),
        );
      }
      i += 1;
    }

    if (!previous || !sequencesEqual(candidate, previous)) {
      return candidate;
    }
  }

  return candidate;
}

export function pickRandomNextKey(
  currentKey: PitchClass,
  rng: () => number = Math.random,
): PitchClass {
  const others: PitchClass[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if (pc !== currentKey) {
      others.push(pc as PitchClass);
    }
  }
  return pickRandomItem(others, rng);
}

export function pickRandomKey(rng: () => number = Math.random): PitchClass {
  return Math.min(11, Math.floor(rng() * 12)) as PitchClass;
}

export function getOrientationChords(mode: KeyOrientationMode): ChordId[] {
  switch (mode) {
    case 'cadence':
      return ['I', 'IV', 'V', 'I'];
    case 'tonic':
      return ['I'];
    case 'none':
      return [];
  }
}
