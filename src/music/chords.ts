import type {
  ChordId,
  DiatonicChordId,
  HalfDimNaming,
  PitchClass,
  ScaleDegree,
  SecondaryDominantId,
  SecondarySeventhId,
  SecondaryTriadId,
  SeventhId,
  TriadId,
} from '../types/settings';

export interface MajorKeyInfo {
  pitchClass: PitchClass;
  shortName: string;
  displayName: string;
  spokenName: string;
}

export const MAJOR_KEYS: readonly MajorKeyInfo[] = [
  { pitchClass: 0, shortName: 'C', displayName: 'C Major', spokenName: 'C' },
  { pitchClass: 1, shortName: 'D♭', displayName: 'D♭ Major', spokenName: 'D flat' },
  { pitchClass: 2, shortName: 'D', displayName: 'D Major', spokenName: 'D' },
  { pitchClass: 3, shortName: 'E♭', displayName: 'E♭ Major', spokenName: 'E flat' },
  { pitchClass: 4, shortName: 'E', displayName: 'E Major', spokenName: 'E' },
  { pitchClass: 5, shortName: 'F', displayName: 'F Major', spokenName: 'F' },
  { pitchClass: 6, shortName: 'F♯', displayName: 'F♯ Major', spokenName: 'F sharp' },
  { pitchClass: 7, shortName: 'G', displayName: 'G Major', spokenName: 'G' },
  { pitchClass: 8, shortName: 'A♭', displayName: 'A♭ Major', spokenName: 'A flat' },
  { pitchClass: 9, shortName: 'A', displayName: 'A Major', spokenName: 'A' },
  { pitchClass: 10, shortName: 'B♭', displayName: 'B♭ Major', spokenName: 'B flat' },
  { pitchClass: 11, shortName: 'B', displayName: 'B Major', spokenName: 'B' },
] as const;

export function getMajorKeyInfo(pitchClass: PitchClass): MajorKeyInfo {
  return MAJOR_KEYS[pitchClass];
}

export function getSpokenKeyPhrase(pitchClass: PitchClass): string {
  return `Key of ${getMajorKeyInfo(pitchClass).spokenName} major`;
}

export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

export function getMajorScalePitchClasses(key: PitchClass): Set<number> {
  return new Set(MAJOR_SCALE_INTERVALS.map((interval) => (key + interval) % 12));
}

export function getScaleDegreePitchClass(
  key: PitchClass,
  degree: ScaleDegree,
): PitchClass {
  return ((key + MAJOR_SCALE_INTERVALS[degree - 1]) % 12) as PitchClass;
}

export const TRIAD_IDS: readonly TriadId[] = [
  'I',
  'ii',
  'iii',
  'IV',
  'V',
  'vi',
  'viio',
];

export const SEVENTH_IDS: readonly SeventhId[] = [
  'Imaj7',
  'ii7',
  'iii7',
  'IVmaj7',
  'V7',
  'vi7',
  'viihalfdim7',
];

export const DIATONIC_CHORD_IDS: readonly DiatonicChordId[] = [
  ...TRIAD_IDS,
  ...SEVENTH_IDS,
];

export const SECONDARY_TRIAD_IDS: readonly SecondaryTriadId[] = [
  'V/ii',
  'V/iii',
  'V/V',
  'V/vi',
];

export const SECONDARY_SEVENTH_IDS: readonly SecondarySeventhId[] = [
  'V7/ii',
  'V7/iii',
  'V7/IV',
  'V7/V',
  'V7/vi',
];

export const ALL_SECONDARY_DOMINANT_IDS: readonly SecondaryDominantId[] = [
  ...SECONDARY_TRIAD_IDS,
  ...SECONDARY_SEVENTH_IDS,
];

const SECONDARY_DOMINANT_SET = new Set<string>(ALL_SECONDARY_DOMINANT_IDS);

export function isSecondaryDominantId(id: ChordId): id is SecondaryDominantId {
  return SECONDARY_DOMINANT_SET.has(id);
}

export const ALL_CHORD_IDS: readonly ChordId[] = [
  ...DIATONIC_CHORD_IDS,
  ...ALL_SECONDARY_DOMINANT_IDS,
];

export interface ChordDefinition {
  id: ChordId;
  category: 'triad' | 'seventh' | 'secondary-triad' | 'secondary-seventh';
  symbol: string;
  rootOffset: number;
  intervals: readonly number[];
  upperIntervals: readonly [number, number, number];
  spokenLabel: string;
  estimatedSyllables: number;
  spokenQualityLabel?: string;
  estimatedQualitySyllables?: number;
  /** Target triad and seventh chord that a secondary dominant resolves to. */
  resolvesTo?: readonly [TriadId, SeventhId];
}

export const CHORD_DEFS: Record<ChordId, ChordDefinition> = {
  I: {
    id: 'I',
    category: 'triad',
    symbol: 'I',
    rootOffset: 0,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'One',
    estimatedSyllables: 1,
    spokenQualityLabel: 'One major',
    estimatedQualitySyllables: 3,
  },
  ii: {
    id: 'ii',
    category: 'triad',
    symbol: 'ii',
    rootOffset: 2,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Two',
    estimatedSyllables: 1,
    spokenQualityLabel: 'Two minor',
    estimatedQualitySyllables: 3,
  },
  iii: {
    id: 'iii',
    category: 'triad',
    symbol: 'iii',
    rootOffset: 4,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Three',
    estimatedSyllables: 1,
    spokenQualityLabel: 'Three minor',
    estimatedQualitySyllables: 3,
  },
  IV: {
    id: 'IV',
    category: 'triad',
    symbol: 'IV',
    rootOffset: 5,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Four',
    estimatedSyllables: 1,
    spokenQualityLabel: 'Four major',
    estimatedQualitySyllables: 3,
  },
  V: {
    id: 'V',
    category: 'triad',
    symbol: 'V',
    rootOffset: 7,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Five',
    estimatedSyllables: 1,
    spokenQualityLabel: 'Five major',
    estimatedQualitySyllables: 3,
  },
  vi: {
    id: 'vi',
    category: 'triad',
    symbol: 'vi',
    rootOffset: 9,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Six',
    estimatedSyllables: 1,
    spokenQualityLabel: 'Six minor',
    estimatedQualitySyllables: 3,
  },
  viio: {
    id: 'viio',
    category: 'triad',
    symbol: 'vii°',
    rootOffset: 11,
    intervals: [0, 3, 6],
    upperIntervals: [0, 3, 6],
    spokenLabel: 'Seven',
    estimatedSyllables: 2,
    spokenQualityLabel: 'Seven diminished',
    estimatedQualitySyllables: 5,
  },
  Imaj7: {
    id: 'Imaj7',
    category: 'seventh',
    symbol: 'Imaj7',
    rootOffset: 0,
    intervals: [0, 4, 7, 11],
    upperIntervals: [4, 7, 11],
    spokenLabel: 'One major seven',
    estimatedSyllables: 5,
  },
  ii7: {
    id: 'ii7',
    category: 'seventh',
    symbol: 'ii7',
    rootOffset: 2,
    intervals: [0, 3, 7, 10],
    upperIntervals: [3, 7, 10],
    spokenLabel: 'Two minor seven',
    estimatedSyllables: 5,
  },
  iii7: {
    id: 'iii7',
    category: 'seventh',
    symbol: 'iii7',
    rootOffset: 4,
    intervals: [0, 3, 7, 10],
    upperIntervals: [3, 7, 10],
    spokenLabel: 'Three minor seven',
    estimatedSyllables: 5,
  },
  IVmaj7: {
    id: 'IVmaj7',
    category: 'seventh',
    symbol: 'IVmaj7',
    rootOffset: 5,
    intervals: [0, 4, 7, 11],
    upperIntervals: [4, 7, 11],
    spokenLabel: 'Four major seven',
    estimatedSyllables: 5,
  },
  V7: {
    id: 'V7',
    category: 'seventh',
    symbol: 'V7',
    rootOffset: 7,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five dominant seven',
    estimatedSyllables: 6,
  },
  vi7: {
    id: 'vi7',
    category: 'seventh',
    symbol: 'vi7',
    rootOffset: 9,
    intervals: [0, 3, 7, 10],
    upperIntervals: [3, 7, 10],
    spokenLabel: 'Six minor seven',
    estimatedSyllables: 5,
  },
  viihalfdim7: {
    id: 'viihalfdim7',
    category: 'seventh',
    symbol: 'viiø7',
    rootOffset: 11,
    intervals: [0, 3, 6, 10],
    upperIntervals: [3, 6, 10],
    spokenLabel: 'Seven half diminished',
    estimatedSyllables: 6,
  },
  'V/ii': {
    id: 'V/ii',
    category: 'secondary-triad',
    symbol: 'V/ii',
    rootOffset: 9,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Five of two',
    estimatedSyllables: 3,
    resolvesTo: ['ii', 'ii7'],
  },
  'V/iii': {
    id: 'V/iii',
    category: 'secondary-triad',
    symbol: 'V/iii',
    rootOffset: 11,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Five of three',
    estimatedSyllables: 3,
    resolvesTo: ['iii', 'iii7'],
  },
  'V/V': {
    id: 'V/V',
    category: 'secondary-triad',
    symbol: 'V/V',
    rootOffset: 2,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Five of five',
    estimatedSyllables: 3,
    resolvesTo: ['V', 'V7'],
  },
  'V/vi': {
    id: 'V/vi',
    category: 'secondary-triad',
    symbol: 'V/vi',
    rootOffset: 4,
    intervals: [0, 4, 7],
    upperIntervals: [0, 4, 7],
    spokenLabel: 'Five of six',
    estimatedSyllables: 3,
    resolvesTo: ['vi', 'vi7'],
  },
  'V7/ii': {
    id: 'V7/ii',
    category: 'secondary-seventh',
    symbol: 'V7/ii',
    rootOffset: 9,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five seven of two',
    estimatedSyllables: 5,
    resolvesTo: ['ii', 'ii7'],
  },
  'V7/iii': {
    id: 'V7/iii',
    category: 'secondary-seventh',
    symbol: 'V7/iii',
    rootOffset: 11,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five seven of three',
    estimatedSyllables: 5,
    resolvesTo: ['iii', 'iii7'],
  },
  'V7/IV': {
    id: 'V7/IV',
    category: 'secondary-seventh',
    symbol: 'V7/IV',
    rootOffset: 0,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five seven of four',
    estimatedSyllables: 5,
    resolvesTo: ['IV', 'IVmaj7'],
  },
  'V7/V': {
    id: 'V7/V',
    category: 'secondary-seventh',
    symbol: 'V7/V',
    rootOffset: 2,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five seven of five',
    estimatedSyllables: 5,
    resolvesTo: ['V', 'V7'],
  },
  'V7/vi': {
    id: 'V7/vi',
    category: 'secondary-seventh',
    symbol: 'V7/vi',
    rootOffset: 4,
    intervals: [0, 4, 7, 10],
    upperIntervals: [4, 7, 10],
    spokenLabel: 'Five seven of six',
    estimatedSyllables: 5,
    resolvesTo: ['vi', 'vi7'],
  },
};

export function getSpokenChordPhrase(
  chordId: ChordId,
  halfDimNaming: HalfDimNaming,
  announceTriadQuality = false,
): { text: string; estimatedSyllables: number } {
  if (chordId === 'viihalfdim7' && halfDimNaming === 'minor-seven-flat-five') {
    return {
      text: 'Seven minor seven flat five',
      estimatedSyllables: 8,
    };
  }
  const def = CHORD_DEFS[chordId];
  if (announceTriadQuality && def.spokenQualityLabel) {
    return {
      text: def.spokenQualityLabel,
      estimatedSyllables: def.estimatedQualitySyllables ?? def.estimatedSyllables,
    };
  }
  return {
    text: def.spokenLabel,
    estimatedSyllables: def.estimatedSyllables,
  };
}

export interface ChordPreset {
  id: string;
  label: string;
  chords: readonly DiatonicChordId[];
}

export const CHORD_PRESETS: readonly ChordPreset[] = [
  { id: 'basic', label: 'Basic (I IV V vi)', chords: ['I', 'IV', 'V', 'vi'] },
  { id: 'all-triads', label: 'All Triads', chords: TRIAD_IDS },
  { id: 'all-sevenths', label: 'All Sevenths', chords: SEVENTH_IDS },
  { id: 'all', label: 'All 14', chords: DIATONIC_CHORD_IDS },
];

export interface SecondaryDominantPreset {
  id: string;
  label: string;
  chords: readonly SecondaryDominantId[];
}

export const SECONDARY_DOMINANT_PRESETS: readonly SecondaryDominantPreset[] = [
  { id: 'sec-triads', label: 'All Triads', chords: SECONDARY_TRIAD_IDS },
  { id: 'sec-sevenths', label: 'All 7ths', chords: SECONDARY_SEVENTH_IDS },
  { id: 'sec-all', label: 'All 9', chords: ALL_SECONDARY_DOMINANT_IDS },
];
