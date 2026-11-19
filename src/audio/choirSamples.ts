export type ChoirVowel = 'ooh' | 'ahh';

export const CHOIR_VOWELS: readonly ChoirVowel[] = ['ooh', 'ahh'];

// 10 anchor MIDI pitches spaced every 4 semitones across E2 (40) .. E5 (76)
// so any chord voice in [E2, G5] pitch-shifts by at most +/-2 semitones.
export const CHOIR_ANCHOR_MIDIS: readonly number[] = [
  40, 44, 48, 52, 56, 60, 64, 68, 72, 76,
];

export const CHOIR_SAMPLES_VERSION = '1';

export function findNearestChoirAnchor(targetMidi: number): {
  anchorMidi: number;
  playbackRate: number;
} {
  let bestAnchor = CHOIR_ANCHOR_MIDIS[0];
  let bestDist = Math.abs(targetMidi - bestAnchor);
  for (let i = 1; i < CHOIR_ANCHOR_MIDIS.length; i++) {
    const candidate = CHOIR_ANCHOR_MIDIS[i];
    const dist = Math.abs(targetMidi - candidate);
    if (dist < bestDist) {
      bestDist = dist;
      bestAnchor = candidate;
    }
  }
  return {
    anchorMidi: bestAnchor,
    playbackRate: Math.pow(2, (targetMidi - bestAnchor) / 12),
  };
}

export function getChoirSampleUrl(
  vowel: ChoirVowel,
  anchorMidi: number,
): string {
  const rawBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return `${base}choir/${vowel}-${anchorMidi}.mp3?v=${CHOIR_SAMPLES_VERSION}`;
}

/**
 * Lazy-loaded, in-memory decoded AudioBuffer cache for recorded SATB choir
 * "Ooh" and "Ahh" multi-samples (FluidR3_GM, CC-BY 3.0).
 */
export class ChoirSampleBank {
  private buffers = new Map<string, AudioBuffer>();
  private loadingPromise: Promise<void> | null = null;
  private loaded = false;
  private readonly fetcher: typeof fetch;

  constructor(fetcher?: typeof fetch) {
    this.fetcher =
      fetcher ??
      ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  }

  private key(vowel: ChoirVowel, anchorMidi: number): string {
    return `${vowel}-${anchorMidi}`;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  async preload(ctx: AudioContext): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;
    if (typeof this.fetcher !== 'function') return;

    const tasks: Promise<void>[] = [];
    for (const vowel of CHOIR_VOWELS) {
      for (const anchorMidi of CHOIR_ANCHOR_MIDIS) {
        const k = this.key(vowel, anchorMidi);
        if (this.buffers.has(k)) continue;
        const url = getChoirSampleUrl(vowel, anchorMidi);
        tasks.push(
          this.fetcher(url)
            .then(async (res) => {
              if (!res.ok) return;
              const bytes = await res.arrayBuffer();
              const decoded = await ctx.decodeAudioData(bytes.slice(0));
              this.buffers.set(k, decoded);
            })
            .catch(() => {
              // Fall back gracefully to Csound formant synthesis if offline.
            }),
        );
      }
    }

    this.loadingPromise = Promise.all(tasks)
      .then(() => {
        if (this.buffers.size > 0) {
          this.loaded = true;
        }
      })
      .finally(() => {
        this.loadingPromise = null;
      });

    return this.loadingPromise;
  }

  getSample(
    vowel: ChoirVowel,
    targetMidi: number,
  ): { buffer: AudioBuffer; playbackRate: number } | null {
    const { anchorMidi, playbackRate } = findNearestChoirAnchor(targetMidi);
    const buffer = this.buffers.get(this.key(vowel, anchorMidi));
    if (!buffer) return null;
    return { buffer, playbackRate };
  }

  clear(): void {
    this.buffers.clear();
    this.loadingPromise = null;
    this.loaded = false;
  }
}
