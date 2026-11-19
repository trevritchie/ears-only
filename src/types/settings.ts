export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type TriadId = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'viio';
export type SeventhId =
  | 'Imaj7'
  | 'ii7'
  | 'iii7'
  | 'IVmaj7'
  | 'V7'
  | 'vi7'
  | 'viihalfdim7';

export type ChordId = TriadId | SeventhId;

export type TimbreId = 'electric-piano' | 'soft-pad';
export type KeyMode = 'fixed' | 'auto-rotate';
export type KeyOrientationMode = 'cadence' | 'tonic' | 'none';
export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HalfDimNaming = 'half-diminished' | 'minor-seven-flat-five';
export type VoiceSource = 'recorded' | 'speech-synthesis';

export interface SessionSettings {
  allowedChords: ChordId[];
  bpm: number;
  progressionLength: number;
  questionRepeats: number;
  playChordsBehindAnswer: boolean;
  playFinalReplayAfterAnswer: boolean;
  timbre: TimbreId;
  chordVolume: number;
  voiceVolume: number;
  keyMode: KeyMode;
  fixedKey: PitchClass;
  rotateEveryNQuestions: number;
  keyOrientation: KeyOrientationMode;
  droneEnabled: boolean;
  droneScaleDegree: ScaleDegree;
  droneVolume: number;
  repeatPauseSec: number;
  speechRate: number;
  speechVoiceURI: string | null;
  halfDimNaming: HalfDimNaming;
  voiceSource: VoiceSource;
}

export const VALID_CHORD_IDS: readonly ChordId[] = [
  'I',
  'ii',
  'iii',
  'IV',
  'V',
  'vi',
  'viio',
  'Imaj7',
  'ii7',
  'iii7',
  'IVmaj7',
  'V7',
  'vi7',
  'viihalfdim7',
];

const VALID_CHORD_SET = new Set<string>(VALID_CHORD_IDS);

export const SETTINGS_STORAGE_KEY = 'ears-only:settings:v1';

export const DEFAULT_SETTINGS: SessionSettings = {
  allowedChords: ['I', 'IV', 'V', 'vi'],
  bpm: 80,
  progressionLength: 4,
  questionRepeats: 2,
  playChordsBehindAnswer: true,
  playFinalReplayAfterAnswer: false,
  timbre: 'electric-piano',
  chordVolume: 0.85,
  voiceVolume: 0.85,
  keyMode: 'auto-rotate',
  fixedKey: 0,
  rotateEveryNQuestions: 5,
  keyOrientation: 'cadence',
  droneEnabled: false,
  droneScaleDegree: 1,
  droneVolume: 0.35,
  repeatPauseSec: 1.2,
  speechRate: 1.0,
  speechVoiceURI: null,
  halfDimNaming: 'half-diminished',
  voiceSource: 'recorded',
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function sanitizePitchClass(value: unknown, fallback: PitchClass): PitchClass {
  const num = clampInt(value, 0, 11, fallback);
  return num as PitchClass;
}

export function sanitizeSettings(raw: unknown): SessionSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS, allowedChords: [...DEFAULT_SETTINGS.allowedChords] };
  }

  const obj = raw as Record<string, unknown>;

  let allowedChords: ChordId[] = [...DEFAULT_SETTINGS.allowedChords];
  if (Array.isArray(obj.allowedChords)) {
    const deduped = Array.from(
      new Set(
        obj.allowedChords.filter(
          (item): item is ChordId => typeof item === 'string' && VALID_CHORD_SET.has(item),
        ),
      ),
    );
    if (deduped.length > 0) {
      allowedChords = deduped;
    }
  }

  const timbre: TimbreId =
    obj.timbre === 'soft-pad' || obj.timbre === 'electric-piano'
      ? obj.timbre
      : DEFAULT_SETTINGS.timbre;

  const keyMode: KeyMode =
    obj.keyMode === 'auto-rotate' || obj.keyMode === 'fixed'
      ? obj.keyMode
      : DEFAULT_SETTINGS.keyMode;

  const keyOrientation: KeyOrientationMode =
    obj.keyOrientation === 'cadence' ||
    obj.keyOrientation === 'tonic' ||
    obj.keyOrientation === 'none'
      ? obj.keyOrientation
      : DEFAULT_SETTINGS.keyOrientation;

  const halfDimNaming: HalfDimNaming =
    obj.halfDimNaming === 'half-diminished' ||
    obj.halfDimNaming === 'minor-seven-flat-five'
      ? obj.halfDimNaming
      : DEFAULT_SETTINGS.halfDimNaming;

  const voiceSource: VoiceSource =
    obj.voiceSource === 'recorded' || obj.voiceSource === 'speech-synthesis'
      ? obj.voiceSource
      : DEFAULT_SETTINGS.voiceSource;

  return {
    allowedChords,
    bpm: clampInt(obj.bpm, 40, 160, DEFAULT_SETTINGS.bpm),
    progressionLength: clampInt(
      obj.progressionLength,
      2,
      5,
      DEFAULT_SETTINGS.progressionLength,
    ),
    questionRepeats: clampInt(
      obj.questionRepeats,
      1,
      5,
      DEFAULT_SETTINGS.questionRepeats,
    ),
    playChordsBehindAnswer:
      typeof obj.playChordsBehindAnswer === 'boolean'
        ? obj.playChordsBehindAnswer
        : DEFAULT_SETTINGS.playChordsBehindAnswer,
    playFinalReplayAfterAnswer:
      typeof obj.playFinalReplayAfterAnswer === 'boolean'
        ? obj.playFinalReplayAfterAnswer
        : DEFAULT_SETTINGS.playFinalReplayAfterAnswer,
    timbre,
    chordVolume: clampNumber(
      obj.chordVolume,
      0,
      1,
      DEFAULT_SETTINGS.chordVolume,
    ),
    voiceVolume: clampNumber(
      obj.voiceVolume,
      0,
      1,
      DEFAULT_SETTINGS.voiceVolume,
    ),
    keyMode,
    fixedKey: sanitizePitchClass(obj.fixedKey, DEFAULT_SETTINGS.fixedKey),
    rotateEveryNQuestions: clampInt(
      obj.rotateEveryNQuestions,
      1,
      20,
      DEFAULT_SETTINGS.rotateEveryNQuestions,
    ),
    keyOrientation,
    droneEnabled:
      typeof obj.droneEnabled === 'boolean'
        ? obj.droneEnabled
        : DEFAULT_SETTINGS.droneEnabled,
    droneScaleDegree: clampInt(
      obj.droneScaleDegree,
      1,
      7,
      DEFAULT_SETTINGS.droneScaleDegree,
    ) as ScaleDegree,
    droneVolume: clampNumber(obj.droneVolume, 0, 1, DEFAULT_SETTINGS.droneVolume),
    repeatPauseSec: clampNumber(
      obj.repeatPauseSec,
      0.4,
      3.0,
      DEFAULT_SETTINGS.repeatPauseSec,
    ),
    speechRate: clampNumber(obj.speechRate, 0.7, 1.4, DEFAULT_SETTINGS.speechRate),
    speechVoiceURI:
      typeof obj.speechVoiceURI === 'string' && obj.speechVoiceURI.length > 0
        ? obj.speechVoiceURI
        : null,
    halfDimNaming,
    voiceSource,
  };
}

export function loadSettings(): SessionSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return sanitizeSettings(null);
    }
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return sanitizeSettings(null);
    }
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(settings: SessionSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}
