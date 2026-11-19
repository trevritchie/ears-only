const PHRASE_TO_FILENAME: Record<string, string> = {
  'key of c': 'key-0.mp3',
  'key of d flat': 'key-1.mp3',
  'key of d': 'key-2.mp3',
  'key of e flat': 'key-3.mp3',
  'key of e': 'key-4.mp3',
  'key of f': 'key-5.mp3',
  'key of f sharp': 'key-6.mp3',
  'key of g': 'key-7.mp3',
  'key of a flat': 'key-8.mp3',
  'key of a': 'key-9.mp3',
  'key of b flat': 'key-10.mp3',
  'key of b': 'key-11.mp3',
  one: 'chord-I.mp3',
  'two minor': 'chord-ii.mp3',
  'three minor': 'chord-iii.mp3',
  four: 'chord-IV.mp3',
  five: 'chord-V.mp3',
  'six minor': 'chord-vi.mp3',
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
  'Key of C',
  'Key of D flat',
  'Key of D',
  'Key of E flat',
  'Key of E',
  'Key of F',
  'Key of F sharp',
  'Key of G',
  'Key of A flat',
  'Key of A',
  'Key of B flat',
  'Key of B',
  'One',
  'Two minor',
  'Three minor',
  'Four',
  'Five',
  'Six minor',
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

export function getVoiceClipUrl(text: string): string | null {
  const filename = getVoiceClipFilename(text);
  if (!filename) return null;
  const rawBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return `${base}voice/${filename}`;
}
