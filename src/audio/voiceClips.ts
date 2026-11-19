const PHRASE_TO_FILENAME: Record<string, string> = {
  'key of c major': 'key-0.mp3',
  'key of d flat major': 'key-1.mp3',
  'key of d major': 'key-2.mp3',
  'key of e flat major': 'key-3.mp3',
  'key of e major': 'key-4.mp3',
  'key of f major': 'key-5.mp3',
  'key of f sharp major': 'key-6.mp3',
  'key of g major': 'key-7.mp3',
  'key of a flat major': 'key-8.mp3',
  'key of a major': 'key-9.mp3',
  'key of b flat major': 'key-10.mp3',
  'key of b major': 'key-11.mp3',
  one: 'chord-I.mp3',
  'one major': 'chord-I-major.mp3',
  two: 'chord-ii-short.mp3',
  'two minor': 'chord-ii.mp3',
  three: 'chord-iii-short.mp3',
  'three minor': 'chord-iii.mp3',
  four: 'chord-IV.mp3',
  'four major': 'chord-IV-major.mp3',
  five: 'chord-V.mp3',
  'five major': 'chord-V-major.mp3',
  six: 'chord-vi-short.mp3',
  'six minor': 'chord-vi.mp3',
  seven: 'chord-viio-short.mp3',
  'seven diminished': 'chord-viio.mp3',
  'one major seven': 'chord-Imaj7.mp3',
  'two minor seven': 'chord-ii7.mp3',
  'three minor seven': 'chord-iii7.mp3',
  'four major seven': 'chord-IVmaj7.mp3',
  'five seven': 'chord-V7.mp3',
  'six minor seven': 'chord-vi7.mp3',
  'seven half diminished': 'chord-viihalfdim7.mp3',
  'seven minor seven flat five': 'chord-viihalfdim7-m7b5.mp3',
};

export const ALL_VOICE_CLIP_TEXTS: readonly string[] = [
  'Key of C major',
  'Key of D flat major',
  'Key of D major',
  'Key of E flat major',
  'Key of E major',
  'Key of F major',
  'Key of F sharp major',
  'Key of G major',
  'Key of A flat major',
  'Key of A major',
  'Key of B flat major',
  'Key of B major',
  'One',
  'One major',
  'Two',
  'Two minor',
  'Three',
  'Three minor',
  'Four',
  'Four major',
  'Five',
  'Five major',
  'Six',
  'Six minor',
  'Seven',
  'Seven diminished',
  'One major seven',
  'Two minor seven',
  'Three minor seven',
  'Four major seven',
  'Five seven',
  'Six minor seven',
  'Seven half diminished',
  'Seven minor seven flat five',
];

export function getVoiceClipFilename(text: string): string | null {
  const key = text.trim().toLowerCase();
  return PHRASE_TO_FILENAME[key] ?? null;
}

export const VOICE_CLIPS_VERSION = '4';

export function getVoiceClipUrl(text: string): string | null {
  const filename = getVoiceClipFilename(text);
  if (!filename) return null;
  const rawBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return `${base}voice/${filename}?v=${VOICE_CLIPS_VERSION}`;
}
