import type {
  ChordId,
  HalfDimNaming,
  PitchClass,
  ScaleDegree,
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

export const ALL_CHORD_IDS: readonly ChordId[] = [...TRIAD_IDS, ...SEVENTH_IDS];

export interface ChordDefinition {
  id: ChordId;
  category: 'triad' | 'seventh';
  symbol: string;
  rootOffset: number;
  intervals: readonly number[];
  upperIntervals: readonly [number, number, number];
  spokenLabel: string;
  estimatedSyllables: number;
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
  },
  ii: {
    id: 'ii',
    category: 'triad',
    symbol: 'ii',
    rootOffset: 2,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Two minor',
    estimatedSyllables: 3,
  },
  iii: {
    id: 'iii',
    category: 'triad',
    symbol: 'iii',
    rootOffset: 4,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Three minor',
    estimatedSyllables: 3,
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
  },
  vi: {
    id: 'vi',
    category: 'triad',
    symbol: 'vi',
    rootOffset: 9,
    intervals: [0, 3, 7],
    upperIntervals: [0, 3, 7],
    spokenLabel: 'Six minor',
    estimatedSyllables: 3,
  },
  viio: {
    id: 'viio',
    category: 'triad',
    symbol: 'vii°',
    rootOffset: 11,
    intervals: [0, 3, 6],
    upperIntervals: [0, 3, 6],
    spokenLabel: 'Seven diminished',
    estimatedSyllables: 5,
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
    spokenLabel: 'Five seven',
    estimatedSyllables: 3,
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
};

export function getSpokenChordPhrase(
  chordId: ChordId,
  halfDimNaming: HalfDimNaming,
): { text: string; estimatedSyllables: number } {
  if (chordId === 'viihalfdim7' && halfDimNaming === 'minor-seven-flat-five') {
    return {
      text: 'Seven minor seven flat five',
      estimatedSyllables: 8,
    };
  }
  const def = CHORD_DEFS[chordId];
  return {
    text: def.spokenLabel,
    estimatedSyllables: def.estimatedSyllables,
  };
}

export interface ChordPreset {
  id: string;
  label: string;
  chords: readonly ChordId[];
}

export const CHORD_PRESETS: readonly ChordPreset[] = [
  { id: 'basic', label: 'Basic (I IV V vi)', chords: ['I', 'IV', 'V', 'vi'] },
  { id: 'all-triads', label: 'All Triads', chords: TRIAD_IDS },
  { id: 'all-sevenths', label: 'All Sevenths', chords: SEVENTH_IDS },
  { id: 'all', label: 'All 14', chords: ALL_CHORD_IDS },
];
