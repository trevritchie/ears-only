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
  'five of two': 'chord-V-of-ii.mp3',
  'five of three': 'chord-V-of-iii.mp3',
  'five of five': 'chord-V-of-V.mp3',
  'five of six': 'chord-V-of-vi.mp3',
  'five seven of two': 'chord-V7-of-ii.mp3',
  'five seven of three': 'chord-V7-of-iii.mp3',
  'five seven of four': 'chord-V7-of-IV.mp3',
  'five seven of five': 'chord-V7-of-V.mp3',
  'five seven of six': 'chord-V7-of-vi.mp3',
  'first inversion': 'inv-1.mp3',
  'second inversion': 'inv-2.mp3',
  'third inversion': 'inv-3.mp3',
  'third in bass': 'bass-3.mp3',
  'fifth in bass': 'bass-5.mp3',
  'seventh in bass': 'bass-7.mp3',
  'over degree one': 'deg-0.mp3',
  'over degree sharp one': 'deg-1.mp3',
  'over degree two': 'deg-2.mp3',
  'over degree sharp two': 'deg-3.mp3',
  'over degree three': 'deg-4.mp3',
  'over degree four': 'deg-5.mp3',
  'over degree sharp four': 'deg-6.mp3',
  'over degree five': 'deg-7.mp3',
  'over degree sharp five': 'deg-8.mp3',
  'over degree six': 'deg-9.mp3',
  'over degree flat seven': 'deg-10.mp3',
  'over degree seven': 'deg-11.mp3',
  'over do': 'solf-0.mp3',
  'over di': 'solf-1.mp3',
  'over re': 'solf-2.mp3',
  'over ri': 'solf-3.mp3',
  'over mi': 'solf-4.mp3',
  'over fa': 'solf-5.mp3',
  'over fi': 'solf-6.mp3',
  'over sol': 'solf-7.mp3',
  'over si': 'solf-8.mp3',
  'over la': 'solf-9.mp3',
  'over te': 'solf-10.mp3',
  'over ti': 'solf-11.mp3',
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
  'Five of two',
  'Five of three',
  'Five of five',
  'Five of six',
  'Five seven of two',
  'Five seven of three',
  'Five seven of four',
  'Five seven of five',
  'Five seven of six',
  'first inversion',
  'second inversion',
  'third inversion',
  'third in bass',
  'fifth in bass',
  'seventh in bass',
  'over degree one',
  'over degree sharp one',
  'over degree two',
  'over degree sharp two',
  'over degree three',
  'over degree four',
  'over degree sharp four',
  'over degree five',
  'over degree sharp five',
  'over degree six',
  'over degree flat seven',
  'over degree seven',
  'over do',
  'over di',
  'over re',
  'over ri',
  'over mi',
  'over fa',
  'over fi',
  'over sol',
  'over si',
  'over la',
  'over te',
  'over ti',
];

const INVERSION_SUFFIX_KEYS: readonly string[] = [
  'first inversion',
  'second inversion',
  'third inversion',
  'third in bass',
  'fifth in bass',
  'seventh in bass',
  'over degree one',
  'over degree sharp one',
  'over degree two',
  'over degree sharp two',
  'over degree three',
  'over degree four',
  'over degree sharp four',
  'over degree five',
  'over degree sharp five',
  'over degree six',
  'over degree flat seven',
  'over degree seven',
  'over do',
  'over di',
  'over re',
  'over ri',
  'over mi',
  'over fa',
  'over fi',
  'over sol',
  'over si',
  'over la',
  'over te',
  'over ti',
];

export function getVoiceClipFilename(text: string): string | null {
  const key = text.trim().toLowerCase();
  return PHRASE_TO_FILENAME[key] ?? null;
}

export const VOICE_CLIPS_VERSION = '10';

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

export function getVoiceClipUrlsForPhrase(text: string): string[] | null {
  const direct = getVoiceClipUrl(text);
  if (direct) return [direct];

  const normalized = text.trim().toLowerCase();
  for (const suffix of INVERSION_SUFFIX_KEYS) {
    const marker = ` ${suffix}`;
    if (normalized.endsWith(marker)) {
      const baseText = normalized.slice(0, -marker.length).trim();
      const baseUrl = getVoiceClipUrl(baseText);
      const suffixUrl = getVoiceClipUrl(suffix);
      if (baseUrl && suffixUrl) {
        return [baseUrl, suffixUrl];
      }
    }
  }

  return null;
}
