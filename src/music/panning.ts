import type { VoicedChord } from './voicing';

const MAX_PAN = 0.84;

// 6 permutations of [0, 1, 2] for exact optimal 3-voice upper matching
const PERMS_3: readonly [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

/**
 * Spreads voices evenly across the stereo field from -0.84 to +0.84 (wide,
 * almost hard pan for the outer two voices without 100% isolation), then
 * randomly shuffles which voice gets each stereo seat.
 */
export function generateRandomVoicePans(
  voiceCount: number,
  rng: () => number = Math.random,
): number[] {
  if (voiceCount <= 0) return [];
  if (voiceCount === 1) return [0];

  const step = (MAX_PAN * 2) / (voiceCount - 1);
  const pans = Array.from({ length: voiceCount }, (_, i) =>
    Math.round((-MAX_PAN + i * step) * 1000) / 1000,
  );

  // Fisher-Yates shuffle so bass/upper voices get fresh random seats each time
  for (let i = pans.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const tmp = pans[i];
    pans[i] = pans[j];
    pans[j] = tmp;
  }

  return pans;
}

/**
 * Matches the 3 upper voices of `nextUpper` to `prevUpper` using minimum
 * concave pitch-distance cost so common tones (dist 0) and stepwise voice
 * resolutions stay on the exact same stereo pan position as the prior chord.
 */
export function matchUpperVoicePans(
  prevUpper: readonly [number, number, number],
  prevUpperPans: readonly [number, number, number],
  nextUpper: readonly [number, number, number],
): [number, number, number] {
  let bestPerm = PERMS_3[0];
  let bestCost = Infinity;

  for (const perm of PERMS_3) {
    let cost = 0;
    for (let nextIdx = 0; nextIdx < 3; nextIdx++) {
      const prevIdx = perm[nextIdx];
      const dist = Math.abs(nextUpper[nextIdx] - prevUpper[prevIdx]);
      // Concave exponent (< 1) strictly favors preserving common tones (0) and
      // small half/whole-step resolutions over shifting all three voices.
      cost += dist === 0 ? 0 : Math.pow(dist, 0.75);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestPerm = perm;
    }
  }

  return [
    prevUpperPans[bestPerm[0]],
    prevUpperPans[bestPerm[1]],
    prevUpperPans[bestPerm[2]],
  ];
}

/**
 * Computes per-chord `[bassPan, upper0Pan, upper1Pan, upper2Pan]` arrays for
 * an entire voiced sequence. Chord 0 gets random balanced non-hard pans; each
 * subsequent chord preserves the bass seat and carries upper pans along the
 * closest voice-led pitch transitions.
 */
export function computeProgressionVoicePans(
  voicedChords: readonly VoicedChord[],
  rng: () => number = Math.random,
  initialPans?: readonly [number, number, number, number],
): [number, number, number, number][] {
  if (voicedChords.length === 0) return [];

  const first =
    initialPans ??
    (generateRandomVoicePans(4, rng) as [number, number, number, number]);

  const result: [number, number, number, number][] = [
    [first[0], first[1], first[2], first[3]],
  ];

  for (let i = 1; i < voicedChords.length; i++) {
    const prevChord = voicedChords[i - 1];
    const currChord = voicedChords[i];
    const prevPans = result[i - 1];
    const nextUpperPans = matchUpperVoicePans(
      prevChord.upperMidis,
      [prevPans[1], prevPans[2], prevPans[3]],
      currChord.upperMidis,
    );
    result.push([prevPans[0], nextUpperPans[0], nextUpperPans[1], nextUpperPans[2]]);
  }

  return result;
}
