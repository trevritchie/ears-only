import type {
  ChordId,
  KeyOrientationMode,
  PitchClass,
} from '../types/settings';

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

export function generateProgression(
  allowedChords: readonly ChordId[],
  length: number,
  previous?: readonly ChordId[],
  rng: () => number = Math.random,
): ChordId[] {
  if (allowedChords.length === 0) {
    throw new Error('At least one chord must be enabled to generate a progression.');
  }
  if (length <= 0) {
    return [];
  }

  const maxAttempts = allowedChords.length >= 2 && length >= 2 ? 5 : 1;

  let candidate: ChordId[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    candidate = [];
    for (let i = 0; i < length; i++) {
      if (allowedChords.length === 1) {
        candidate.push(allowedChords[0]);
      } else {
        const prevChord = i > 0 ? candidate[i - 1] : undefined;
        const pool =
          prevChord !== undefined
            ? allowedChords.filter((c) => c !== prevChord)
            : allowedChords;
        candidate.push(pickRandomItem(pool, rng));
      }
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
