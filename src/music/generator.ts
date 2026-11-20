import type {
  ChordId,
  ChordInversion,
  DiatonicChordId,
  KeyOrientationMode,
  PitchClass,
  ProgressionChord,
  SecondaryDominantId,
} from '../types/settings';
import { CHORD_DEFS, getChordBassPitchClass } from './chords';

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

function weightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  rng: () => number,
): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pickRandomItem(items, rng);
  let target = rng() * total;
  for (let i = 0; i < items.length; i++) {
    target -= weights[i];
    if (target <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function circularPitchDistance(pcA: number, pcB: number): number {
  const d = Math.abs(pcA - pcB) % 12;
  return Math.min(d, 12 - d);
}

function isLeadingToneFirstInversion(chordId: ChordId, inv: ChordInversion): boolean {
  return (
    inv === 1 &&
    (chordId === 'V' ||
      chordId === 'V7' ||
      CHORD_DEFS[chordId].category === 'secondary-triad' ||
      CHORD_DEFS[chordId].category === 'secondary-seventh')
  );
}

export function assignProgressionInversions(
  chords: readonly ChordId[],
  getAllowedInversions: (chordId: ChordId) => readonly ChordInversion[],
  key: PitchClass,
  musicalLeading = true,
  rng: () => number = Math.random,
): ProgressionChord[] {
  const n = chords.length;
  const result: ProgressionChord[] = [];

  for (let i = 0; i < n; i++) {
    const chordId = chords[i];
    const allowedRaw = getAllowedInversions(chordId);
    const allowed: ChordInversion[] =
      allowedRaw.length > 0 ? [...allowedRaw] : [0];

    if (allowed.length === 1) {
      result.push({ chordId, inversion: allowed[0] });
      continue;
    }

    if (!musicalLeading) {
      result.push({ chordId, inversion: pickRandomItem(allowed, rng) });
      continue;
    }

    const prev = i > 0 ? result[i - 1] : undefined;
    const prevBassPc = prev
      ? getChordBassPitchClass(prev.chordId, prev.inversion, key)
      : undefined;
    const nextChord = i < n - 1 ? chords[i + 1] : undefined;
    const nextAllowed = nextChord ? getAllowedInversions(nextChord) : [];

    const weights = allowed.map((inv) => {
      if (i === 0) {
        if (inv === 0) return 1.4;
        if (inv === 1) return 1.1;
        if (inv === 2) return 0.5;
        return 0.55;
      }

      let weight = 1.0;
      const currBassPc = getChordBassPitchClass(chordId, inv, key);
      const bassStep = circularPitchDistance(prevBassPc!, currBassPc);

      // Stepwise and common-tone bass motion
      if (bassStep === 1 || bassStep === 2) {
        weight *= 2.8;
      } else if (bassStep === 0) {
        weight *= 2.0;
      } else if (bassStep === 3 || bassStep === 4) {
        weight *= 1.3;
      } else {
        weight *= 0.85;
      }

      // Idiomatic resolution from 3rd inversion (4/2): bass (7th) steps down
      const downStep = (prevBassPc! - currBassPc + 12) % 12;
      if (prev!.inversion === 3 && (downStep === 1 || downStep === 2)) {
        weight *= 4.5;
      }

      // Leading-tone 1st inversion (V6, V6/5, V6/x, V6/5/x) resolving up by semitone
      const upStep = (currBassPc - prevBassPc! + 12) % 12;
      if (isLeadingToneFirstInversion(prev!.chordId, prev!.inversion) && upStep === 1) {
        weight *= 4.0;
      }

      // 2nd inversion (6/4) cadential, pedal, and passing idioms
      if (inv === 2) {
        let idiomatic = bassStep === 0;
        if (nextChord) {
          const nextRootPc = (key + CHORD_DEFS[nextChord].rootOffset) % 12;
          if (currBassPc === nextRootPc) {
            idiomatic = true;
          }
          // Passing 6/4: stepwise entry continuing stepwise in same direction
          const signedIn = ((currBassPc - prevBassPc! + 18) % 12) - 6;
          if (Math.abs(signedIn) >= 1 && Math.abs(signedIn) <= 2) {
            const dir = Math.sign(signedIn);
            for (const nInv of nextAllowed) {
              const nb = getChordBassPitchClass(nextChord, nInv, key);
              const signedOut = ((nb - currBassPc + 18) % 12) - 6;
              if (
                Math.sign(signedOut) === dir &&
                Math.abs(signedOut) >= 1 &&
                Math.abs(signedOut) <= 2
              ) {
                idiomatic = true;
                break;
              }
            }
          }
        }
        if (idiomatic) {
          weight *= 2.6;
        }
        if (i === n - 1) {
          weight *= 0.45;
        }
      }

      // 3rd inversion (4/2) favors chords that can step down into the next bass
      if (inv === 3) {
        if (nextChord) {
          const canStepDown = nextAllowed.some((nInv) => {
            const nb = getChordBassPitchClass(nextChord, nInv, key);
            const ds = (currBassPc - nb + 12) % 12;
            return ds === 1 || ds === 2;
          });
          if (canStepDown) {
            weight *= 1.8;
          }
        }
        if (i === n - 1) {
          weight *= 0.35;
        }
      }

      return Math.max(0.25, weight);
    });

    result.push({
      chordId,
      inversion: weightedPick(allowed, weights, rng),
    });
  }

  return result;
}

export function generateProgressionWithInversions(
  allowedChords: readonly DiatonicChordId[],
  length: number,
  getAllowedInversions: (chordId: ChordId) => readonly ChordInversion[],
  key: PitchClass,
  musicalLeading = true,
  previous?: readonly ChordId[],
  rng: () => number = Math.random,
  secondaryDominants: readonly SecondaryDominantId[] = [],
  strictSecondaryResolution = true,
): ProgressionChord[] {
  const chords = generateProgression(
    allowedChords,
    length,
    previous,
    rng,
    secondaryDominants,
    strictSecondaryResolution,
  );
  return assignProgressionInversions(
    chords,
    getAllowedInversions,
    key,
    musicalLeading,
    rng,
  );
}
