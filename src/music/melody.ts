import type { ChoirVowel } from '../audio/choirSamples';
import type { PitchClass, TimbreId } from '../types/settings';
import {
  CHORD_DEFS,
  getChordAvailableTensionOffsets,
  getChordScalePitchClasses,
} from './chords';
import type { ScheduledNote } from './arrangement';
import type { VoicedChord } from './voicing';

export type MelodyToneKind = 'chord' | 'tension' | 'passing';

export interface MelodyNoteEvent {
  barIndex: number;
  startBeat: number;
  durationBeats: number;
  midi: number;
  velocity: number;
  isStrongBeat: boolean;
  toneKind: MelodyToneKind;
}

export interface MelodyGenerationOptions {
  allowTensions: boolean;
  rng?: () => number;
}

interface RhythmSlot {
  startBeat: number;
  durationBeats: number;
  isStrongBeat: boolean;
}

interface RhythmPattern {
  id: string;
  slots: readonly RhythmSlot[];
  allowFirstBar: boolean;
  isDense: boolean;
}

const INTERIOR_PATTERNS: readonly RhythmPattern[] = [
  {
    id: 'half-half',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 2, isStrongBeat: true },
      { startBeat: 2, durationBeats: 2, isStrongBeat: true },
    ],
  },
  {
    id: 'dotted-half-quarter',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 3, isStrongBeat: true },
      { startBeat: 3, durationBeats: 1, isStrongBeat: false },
    ],
  },
  {
    id: 'half-quarter-quarter',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 2, isStrongBeat: true },
      { startBeat: 2, durationBeats: 1, isStrongBeat: true },
      { startBeat: 3, durationBeats: 1, isStrongBeat: false },
    ],
  },
  {
    id: 'dotted-quarter-eighth-half',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 1.5, isStrongBeat: true },
      { startBeat: 1.5, durationBeats: 0.5, isStrongBeat: false },
      { startBeat: 2, durationBeats: 2, isStrongBeat: true },
    ],
  },
  {
    id: 'quarter-quarter-half',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 1, isStrongBeat: true },
      { startBeat: 1, durationBeats: 1, isStrongBeat: false },
      { startBeat: 2, durationBeats: 2, isStrongBeat: true },
    ],
  },
  {
    id: 'quarter-dotted-eighth-quarter',
    allowFirstBar: true,
    isDense: true,
    slots: [
      { startBeat: 0, durationBeats: 1, isStrongBeat: true },
      { startBeat: 1, durationBeats: 1.5, isStrongBeat: false },
      { startBeat: 2.5, durationBeats: 0.5, isStrongBeat: false },
      { startBeat: 3, durationBeats: 1, isStrongBeat: false },
    ],
  },
  {
    id: 'half-rest-eighth-quarter',
    allowFirstBar: true,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 2, isStrongBeat: true },
      { startBeat: 2.5, durationBeats: 0.5, isStrongBeat: false },
      { startBeat: 3, durationBeats: 1, isStrongBeat: false },
    ],
  },
  {
    id: 'four-quarters',
    allowFirstBar: true,
    isDense: true,
    slots: [
      { startBeat: 0, durationBeats: 1, isStrongBeat: true },
      { startBeat: 1, durationBeats: 1, isStrongBeat: false },
      { startBeat: 2, durationBeats: 1, isStrongBeat: true },
      { startBeat: 3, durationBeats: 1, isStrongBeat: false },
    ],
  },
  {
    id: 'quarter-rest-pickup',
    allowFirstBar: false,
    isDense: false,
    slots: [
      { startBeat: 1, durationBeats: 1, isStrongBeat: false },
      { startBeat: 2, durationBeats: 2, isStrongBeat: true },
    ],
  },
];

const FINAL_CADENCE_PATTERNS: readonly RhythmPattern[] = [
  {
    id: 'whole-cadence',
    allowFirstBar: false,
    isDense: false,
    slots: [{ startBeat: 0, durationBeats: 3.85, isStrongBeat: true }],
  },
  {
    id: 'half-half-cadence',
    allowFirstBar: false,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 2, isStrongBeat: true },
      { startBeat: 2, durationBeats: 1.85, isStrongBeat: true },
    ],
  },
  {
    id: 'quarter-dotted-half-cadence',
    allowFirstBar: false,
    isDense: false,
    slots: [
      { startBeat: 0, durationBeats: 1, isStrongBeat: true },
      { startBeat: 1, durationBeats: 2.85, isStrongBeat: false },
    ],
  },
];

interface MelodySlotSpec {
  barIndex: number;
  startBeat: number;
  durationBeats: number;
  isStrongBeat: boolean;
  voiced: VoicedChord;
  bassMidi: number;
  chordTonePcs: Set<number>;
  tensionPcs: Set<number>;
  tendencyPcs: Set<number>;
  scalePcs: Set<number>;
  minMidi: number;
  maxMidi: number;
}

interface CandidatePitch {
  midi: number;
  toneKind: MelodyToneKind;
}

interface BeamState {
  cost: number;
  pitches: number[];
  kinds: MelodyToneKind[];
}

const MELODY_MAX_MIDI = 81; // A5
const MELODY_FALLBACK_MAX_MIDI = 84; // C6
const MELODY_CENTER_MIDI = 76; // E5
const BEAM_WIDTH = 24;

function pickBarPatterns(
  barCount: number,
  rng: () => number,
): RhythmPattern[] {
  const chosen: RhythmPattern[] = [];
  let prevId = '';
  let prevWasDense = false;

  for (let b = 0; b < barCount; b++) {
    if (b === barCount - 1) {
      const idx = Math.min(
        FINAL_CADENCE_PATTERNS.length - 1,
        Math.floor(rng() * FINAL_CADENCE_PATTERNS.length),
      );
      chosen.push(FINAL_CADENCE_PATTERNS[idx]);
      continue;
    }

    const pool = INTERIOR_PATTERNS.filter((p) => {
      if (b === 0 && !p.allowFirstBar) return false;
      if (p.id === prevId) return false;
      if (prevWasDense && p.isDense) return false;
      return true;
    });
    const candidates = pool.length > 0 ? pool : [INTERIOR_PATTERNS[0]];
    const pick = candidates[Math.floor(rng() * candidates.length) % candidates.length];
    chosen.push(pick);
    prevId = pick.id;
    prevWasDense = pick.isDense;
  }

  return chosen;
}

function getTendencyPcs(
  voiced: VoicedChord,
  key: PitchClass,
): Set<number> {
  const def = CHORD_DEFS[voiced.chordId];
  const rootPc = (key + def.rootOffset) % 12;
  const result = new Set<number>();
  // Dominant 3rd (local leading tone) and chord 7ths carry strong tendency to resolve by step
  if (
    voiced.chordId === 'V' ||
    voiced.chordId === 'V7' ||
    def.category === 'secondary-triad' ||
    def.category === 'secondary-seventh'
  ) {
    result.add((rootPc + def.intervals[1]) % 12);
  }
  if (def.intervals.length >= 4) {
    result.add((rootPc + def.intervals[3]) % 12);
  }
  return result;
}

function buildSlotCandidates(
  slot: MelodySlotSpec,
  allowTensions: boolean,
  isEndpoint: boolean,
  isFinalNote: boolean,
): CandidatePitch[] {
  const collectForUpper = (highMidi: number): CandidatePitch[] => {
    const list: CandidatePitch[] = [];
    for (let midi = slot.minMidi; midi <= highMidi; midi++) {
      const pc = midi % 12;
      if (slot.chordTonePcs.has(pc)) {
        list.push({ midi, toneKind: 'chord' });
      } else if (allowTensions) {
        if (slot.tensionPcs.has(pc) && !isFinalNote) {
          list.push({ midi, toneKind: 'tension' });
        } else if (!slot.isStrongBeat && !isEndpoint && slot.scalePcs.has(pc)) {
          list.push({ midi, toneKind: 'passing' });
        }
      }
    }
    return list;
  };

  const primary = collectForUpper(slot.maxMidi);
  if (primary.length > 0) return primary;

  const expanded = collectForUpper(MELODY_FALLBACK_MAX_MIDI);
  if (expanded.length > 0) return expanded;

  // Absolute chord-tone safety fallback
  const minSafe = slot.voiced.upperMidis[2] + 1;
  for (let midi = minSafe; midi <= 88; midi++) {
    if (slot.chordTonePcs.has(midi % 12)) {
      return [{ midi, toneKind: 'chord' }];
    }
  }
  return [{ midi: Math.max(72, minSafe), toneKind: 'chord' }];
}

function isParallelOuterFifthOrOctave(
  prevBass: number,
  prevMelody: number,
  currBass: number,
  currMelody: number,
): boolean {
  const dBass = currBass - prevBass;
  const dMel = currMelody - prevMelody;
  if (dBass === 0 || dMel === 0 || Math.sign(dBass) !== Math.sign(dMel)) {
    return false;
  }
  const prevInt = (((prevMelody - prevBass) % 12) + 12) % 12;
  const currInt = (((currMelody - currBass) % 12) + 12) % 12;
  return (prevInt === 0 && currInt === 0) || (prevInt === 7 && currInt === 7);
}

function leapCost(absDelta: number, chordTonesOnly: boolean): number {
  if (absDelta === 0) return 1.35;
  if (absDelta <= 2) return 0.0;
  if (absDelta <= 4) return chordTonesOnly ? 0.15 : 0.55;
  if (absDelta === 5) return chordTonesOnly ? 0.7 : 1.15;
  if (absDelta === 7) return chordTonesOnly ? 1.15 : 1.75;
  if (absDelta <= 9) return 2.8;
  return 4.0;
}

/**
 * Generates a single-line lyrical counterpoint melody sitting cleanly above
 * a voiced 4-part chord progression.
 */
export function generateProgressionMelody(
  voicedProgression: readonly VoicedChord[],
  key: PitchClass,
  options: MelodyGenerationOptions,
): MelodyNoteEvent[][] {
  if (voicedProgression.length === 0) return [];

  const rng = options.rng ?? Math.random;
  const allowTensions = options.allowTensions;
  const barPatterns = pickBarPatterns(voicedProgression.length, rng);

  const slots: MelodySlotSpec[] = [];
  voicedProgression.forEach((voiced, barIndex) => {
    const def = CHORD_DEFS[voiced.chordId];
    const rootPc = (key + def.rootOffset) % 12;
    const chordTonePcs = new Set(
      def.intervals.map((iv) => (rootPc + iv) % 12),
    );
    const tensionPcs = new Set(
      getChordAvailableTensionOffsets(voiced.chordId).map(
        (off) => (rootPc + off) % 12,
      ),
    );
    const tendencyPcs = getTendencyPcs(voiced, key);
    const scalePcs = getChordScalePitchClasses(voiced.chordId, key);
    const minMidi = Math.max(70, voiced.upperMidis[2] + 2);

    for (const r of barPatterns[barIndex].slots) {
      slots.push({
        barIndex,
        startBeat: r.startBeat,
        durationBeats: r.durationBeats,
        isStrongBeat: r.isStrongBeat,
        voiced,
        bassMidi: voiced.bassMidi,
        chordTonePcs,
        tensionPcs,
        tendencyPcs,
        scalePcs,
        minMidi,
        maxMidi: MELODY_MAX_MIDI,
      });
    }
  });

  const totalNotes = slots.length;
  const slotCandidates: CandidatePitch[][] = slots.map((slot, idx) =>
    buildSlotCandidates(
      slot,
      allowTensions,
      idx === 0 || idx === totalNotes - 1,
      idx === totalNotes - 1,
    ),
  );

  // Pick a balanced single phrase climax around 45%-82% through the progression
  const climaxIdx =
    totalNotes <= 3
      ? Math.max(0, totalNotes - 2)
      : Math.min(
          totalNotes - 2,
          Math.max(
            1,
            Math.floor((0.45 + rng() * 0.37) * (totalNotes - 1)),
          ),
        );
  const climaxTargetMidi = 77 + Math.floor(rng() * 5); // 77 (F5) .. 81 (A5)

  const archHeightPenalty = (idx: number, midi: number): number => {
    if (totalNotes <= 2) return 0.08 * Math.abs(midi - MELODY_CENTER_MIDI);
    const progress =
      idx <= climaxIdx
        ? climaxIdx === 0
          ? 1
          : idx / climaxIdx
        : Math.max(0, 1 - (idx - climaxIdx) / Math.max(1, totalNotes - 1 - climaxIdx));
    const curveTarget = 73 + progress * (climaxTargetMidi - 73);
    let p = 0.14 * Math.abs(midi - curveTarget);
    if (idx === climaxIdx) {
      p += midi >= climaxTargetMidi - 1 ? -0.9 : 1.5;
    } else if (Math.abs(idx - climaxIdx) > 1 && midi >= climaxTargetMidi) {
      p += 2.2;
    }
    return p;
  };

  // Initialize beam on note 0
  let beam: BeamState[] = slotCandidates[0]
    .map((cand) => {
      const tonicBonus = cand.midi % 12 === key ? -0.4 : 0;
      const tensionOffset = cand.toneKind === 'tension' ? 0.45 : 0;
      return {
        cost:
          archHeightPenalty(0, cand.midi) +
          tonicBonus +
          tensionOffset +
          rng() * 1.1,
        pitches: [cand.midi],
        kinds: [cand.toneKind],
      };
    })
    .sort((a, b) => a.cost - b.cost)
    .slice(0, BEAM_WIDTH);

  for (let s = 1; s < totalNotes; s++) {
    const prevSlot = slots[s - 1];
    const currSlot = slots[s];
    const crossBar = currSlot.barIndex !== prevSlot.barIndex;
    const cands = slotCandidates[s];
    const nextCands = s + 1 < totalNotes ? slotCandidates[s + 1] : null;
    const nextBeam: BeamState[] = [];

    for (const state of beam) {
      const prev1 = state.pitches[s - 1];
      const prevKind = state.kinds[s - 1];
      const prev2 = s >= 2 ? state.pitches[s - 2] : null;

      for (const cand of cands) {
        const curr = cand.midi;
        const delta = curr - prev1;
        const absDelta = Math.abs(delta);

        // Hard counterpoint filters
        if (absDelta === 6 || absDelta === 10 || absDelta === 11 || absDelta > 12) {
          continue;
        }
        if (prev2 !== null && prev2 === prev1 && prev1 === curr) {
          continue;
        }
        if (prevKind === 'passing') {
          if (cand.toneKind === 'passing' || absDelta < 1 || absDelta > 2) {
            continue;
          }
        }
        if (cand.toneKind === 'passing') {
          if (absDelta < 1 || absDelta > 2) {
            continue;
          }
          // One-step lookahead guarantees next slot can leave this passing tone by step
          if (
            nextCands &&
            !nextCands.some(
              (nc) =>
                nc.toneKind !== 'passing' &&
                Math.abs(nc.midi - curr) >= 1 &&
                Math.abs(nc.midi - curr) <= 2,
            )
          ) {
            continue;
          }
        }
        if (
          crossBar &&
          isParallelOuterFifthOrOctave(
            prevSlot.bassMidi,
            prev1,
            currSlot.bassMidi,
            curr,
          )
        ) {
          continue;
        }

        let stepCost = leapCost(absDelta, !allowTensions);

        // Leap recovery & tritone outline rules when a prior note exists
        if (prev2 !== null) {
          const prevDelta = prev1 - prev2;
          const absPrevDelta = Math.abs(prevDelta);

          if (absPrevDelta >= 5) {
            if (delta !== 0 && Math.sign(delta) !== Math.sign(prevDelta)) {
              stepCost += absDelta <= 2 ? -1.2 : 0.4;
            } else {
              stepCost += 4.5;
            }
          } else if (
            absPrevDelta >= 3 &&
            absDelta >= 3 &&
            Math.sign(delta) === Math.sign(prevDelta)
          ) {
            const sumInt = Math.abs(curr - prev2);
            const outlinesTriad = sumInt === 7 || sumInt === 8 || sumInt === 9;
            stepCost += outlinesTriad && absDelta < absPrevDelta ? 1.4 : 4.8;
          }

          if (Math.abs(curr - prev2) === 6) {
            stepCost += 3.5;
          }
        }

        // Tension / tendency resolution
        if (
          (prevKind === 'tension' || prevSlot.tendencyPcs.has(prev1 % 12)) &&
          cand.toneKind === 'chord' &&
          absDelta >= 1 &&
          absDelta <= 2
        ) {
          stepCost -= 1.0;
        }

        // Feature tensions and smooth passing motion tastefully when Allow tensions is ON
        if (allowTensions) {
          if (
            cand.toneKind === 'tension' &&
            currSlot.isStrongBeat &&
            s < totalNotes - 1 &&
            prevKind === 'chord'
          ) {
            stepCost -= 0.45;
          } else if (cand.toneKind === 'passing' && !currSlot.isStrongBeat) {
            stepCost -= 0.25;
          }
        }

        // Outer-voice independence against bass on chord changes
        if (crossBar) {
          const dBass = currSlot.bassMidi - prevSlot.bassMidi;
          if (dBass !== 0 && delta !== 0) {
            if (Math.sign(dBass) !== Math.sign(delta)) {
              stepCost -= 0.5;
            } else {
              const currOuterInt = (((curr - currSlot.bassMidi) % 12) + 12) % 12;
              if (currOuterInt === 0 || currOuterInt === 7) {
                stepCost += 2.0;
              }
            }
          }
        }

        // Gentle cadence tonic pull on the final note
        if (s === totalNotes - 1) {
          if (curr % 12 === key) {
            stepCost -= 0.6;
          } else if (curr % 12 === (key + 4) % 12) {
            stepCost -= 0.35;
          }
        }

        const totalCost =
          state.cost +
          stepCost +
          archHeightPenalty(s, curr) +
          rng() * 1.35;

        nextBeam.push({
          cost: totalCost,
          pitches: [...state.pitches, curr],
          kinds: [...state.kinds, cand.toneKind],
        });
      }
    }

    if (nextBeam.length > 0) {
      nextBeam.sort((a, b) => a.cost - b.cost);
      beam = nextBeam.slice(0, BEAM_WIDTH);
    } else {
      // Safe musical fallback if tight register ever prunes all candidates
      const bestPrev = beam[0];
      const prev1 = bestPrev.pitches[s - 1];
      const fallback = cands.reduce((best, curr) => {
        const bestSafe = best.toneKind !== 'passing' ? 0 : 10;
        const currSafe = curr.toneKind !== 'passing' ? 0 : 10;
        const bestScore = bestSafe + Math.abs(best.midi - prev1);
        const currScore = currSafe + Math.abs(curr.midi - prev1);
        return currScore < bestScore ? curr : best;
      });
      beam = [
        {
          cost: bestPrev.cost + 2,
          pitches: [...bestPrev.pitches, fallback.midi],
          kinds: [...bestPrev.kinds, fallback.toneKind],
        },
      ];
    }
  }

  const chosen = beam[0];
  const byBar: MelodyNoteEvent[][] = voicedProgression.map(() => []);
  slots.forEach((slot, idx) => {
    const velocity =
      idx === climaxIdx
        ? 0.96
        : slot.isStrongBeat
          ? 0.92
          : slot.durationBeats <= 0.5
            ? 0.8
            : 0.85;
    byBar[slot.barIndex].push({
      barIndex: slot.barIndex,
      startBeat: slot.startBeat,
      durationBeats: slot.durationBeats,
      midi: chosen.pitches[idx],
      velocity,
      isStrongBeat: slot.isStrongBeat,
      toneKind: chosen.kinds[idx],
    });
  });

  return byBar;
}

export function melodyBarToScheduledNotes(
  events: readonly MelodyNoteEvent[],
  slotDurationSec: number,
  timbre: TimbreId,
  vowel?: ChoirVowel,
): ScheduledNote[] {
  const beatSec = slotDurationSec / 4;
  return events.map((ev) => ({
    midi: ev.midi,
    offsetSec: ev.startBeat * beatSec,
    durationSec: Math.max(0.08, ev.durationBeats * beatSec * 0.94),
    velocity: ev.velocity,
    role: 'melody',
    timbre,
    pan: 0,
    vowel,
  }));
}
