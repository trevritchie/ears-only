import type {
  ChordId,
  ChordInversion,
  DiatonicChordId,
  HalfDimNaming,
  InversionNotation,
  PitchClass,
  ScaleDegree,
  SecondaryDominantId,
  SecondarySeventhId,
  SecondaryTriadId,
  SessionSettings,
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

export function isSeventhChordId(id: ChordId): boolean {
  const cat = CHORD_DEFS[id].category;
  return cat === 'seventh' || cat === 'secondary-seventh';
}

export function getMaxInversionForChord(id: ChordId): 2 | 3 {
  return isSeventhChordId(id) ? 3 : 2;
}

export function getAllowedInversionsForChord(
  chordId: ChordId,
  settings: Pick<
    SessionSettings,
    'triadInversions' | 'seventhInversions' | 'chordInversionOverrides'
  >,
): ChordInversion[] {
  const maxInv = getMaxInversionForChord(chordId);
  const override = settings.chordInversionOverrides[chordId];
  if (override && override.length > 0) {
    const valid = override.filter((inv) => inv >= 0 && inv <= maxInv);
    if (valid.length > 0) return valid;
  }
  const globalPool = isSeventhChordId(chordId)
    ? settings.seventhInversions
    : settings.triadInversions;
  const filtered = globalPool.filter(
    (inv): inv is ChordInversion => inv >= 0 && inv <= maxInv,
  );
  return filtered.length > 0 ? filtered : [0];
}

export function getChordBassPitchClass(
  chordId: ChordId,
  inversion: ChordInversion,
  key: PitchClass,
): PitchClass {
  const def = CHORD_DEFS[chordId];
  const safeInv = Math.min(inversion, def.intervals.length - 1);
  return ((key + def.rootOffset + (def.intervals[safeInv] ?? 0)) %
    12) as PitchClass;
}

const INVERSION_NAME_SHORT: Record<1 | 2 | 3, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
};

const BASS_TONE_SHORT: Record<1 | 2 | 3, string> = {
  1: '3rd in bass',
  2: '5th in bass',
  3: '7th in bass',
};

const TRIAD_FIGURES: Record<1 | 2, string> = {
  1: '⁶',
  2: '⁶₄',
};

const SEVENTH_FIGURES: Record<1 | 2 | 3, string> = {
  1: '⁶₅',
  2: '⁴₃',
  3: '⁴₂',
};

export interface FormattedChordDisplay {
  primary: string;
  secondary?: string;
  inline: string;
}

export function formatChordDisplay(
  chordId: ChordId,
  inversion: ChordInversion,
  notation: InversionNotation = 'inversion-name',
): FormattedChordDisplay {
  const def = CHORD_DEFS[chordId];
  const isSeventh = isSeventhChordId(chordId);
  const maxInv = isSeventh ? 3 : 2;
  const inv = Math.min(inversion, maxInv) as ChordInversion;

  if (inv === 0) {
    return { primary: def.symbol, inline: def.symbol };
  }

  if (notation === 'inversion-name') {
    const label = INVERSION_NAME_SHORT[inv as 1 | 2 | 3];
    return {
      primary: def.symbol,
      secondary: label,
      inline: `${def.symbol} (${label})`,
    };
  }

  if (notation === 'bass-tone') {
    const label = BASS_TONE_SHORT[inv as 1 | 2 | 3];
    return {
      primary: def.symbol,
      secondary: label,
      inline: `${def.symbol} (${label})`,
    };
  }

  // Figured bass notation
  const fig = isSeventh
    ? SEVENTH_FIGURES[inv as 1 | 2 | 3]
    : TRIAD_FIGURES[inv as 1 | 2];

  if (def.symbol.includes('/')) {
    const [head, tail] = def.symbol.split('/');
    const baseHead = isSeventh && head.endsWith('7') ? head.slice(0, -1) : head;
    const figured = `${baseHead}${fig}/${tail}`;
    return { primary: figured, inline: figured };
  }

  const baseSymbol =
    isSeventh && def.symbol.endsWith('7') ? def.symbol.slice(0, -1) : def.symbol;
  const figured = `${baseSymbol}${fig}`;
  return { primary: figured, inline: figured };
}

const INVERSION_NAME_SPOKEN: Record<
  1 | 2 | 3,
  { text: string; syllables: number }
> = {
  1: { text: 'first inversion', syllables: 4 },
  2: { text: 'second inversion', syllables: 5 },
  3: { text: 'third inversion', syllables: 4 },
};

const BASS_TONE_SPOKEN: Record<1 | 2 | 3, { text: string; syllables: number }> =
  {
    1: { text: 'with the third in the bass', syllables: 6 },
    2: { text: 'with the fifth in the bass', syllables: 6 },
    3: { text: 'with the seventh in the bass', syllables: 7 },
  };

export function getInversionSuffixPhrases(
  notation: InversionNotation,
): readonly string[] {
  if (notation === 'bass-tone') {
    return [
      BASS_TONE_SPOKEN[1].text,
      BASS_TONE_SPOKEN[2].text,
      BASS_TONE_SPOKEN[3].text,
    ];
  }
  return [
    INVERSION_NAME_SPOKEN[1].text,
    INVERSION_NAME_SPOKEN[2].text,
    INVERSION_NAME_SPOKEN[3].text,
  ];
}

export function getSpokenChordPhrase(
  chordId: ChordId,
  halfDimNaming: HalfDimNaming,
  announceTriadQuality = false,
  inversion: ChordInversion = 0,
  inversionNotation: InversionNotation = 'inversion-name',
): { text: string; estimatedSyllables: number } {
  let baseText: string;
  let baseSyllables: number;

  if (chordId === 'viihalfdim7' && halfDimNaming === 'minor-seven-flat-five') {
    baseText = 'Seven minor seven flat five';
    baseSyllables = 8;
  } else {
    const def = CHORD_DEFS[chordId];
    if (announceTriadQuality && def.spokenQualityLabel) {
      baseText = def.spokenQualityLabel;
      baseSyllables = def.estimatedQualitySyllables ?? def.estimatedSyllables;
    } else {
      baseText = def.spokenLabel;
      baseSyllables = def.estimatedSyllables;
    }
  }

  const maxInv = getMaxInversionForChord(chordId);
  const inv = Math.min(inversion, maxInv) as ChordInversion;
  if (inv === 0) {
    return {
      text: baseText,
      estimatedSyllables: baseSyllables,
    };
  }

  const suffix =
    inversionNotation === 'bass-tone'
      ? BASS_TONE_SPOKEN[inv as 1 | 2 | 3]
      : INVERSION_NAME_SPOKEN[inv as 1 | 2 | 3];

  return {
    text: `${baseText} ${suffix.text}`,
    estimatedSyllables: baseSyllables + suffix.syllables,
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
