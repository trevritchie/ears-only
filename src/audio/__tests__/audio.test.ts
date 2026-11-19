import { describe, expect, it, vi } from 'vitest';
import { AudioBufferAnnouncer } from '../../engine/audioAnnouncer';
import { MAJOR_KEYS, ALL_CHORD_IDS, getSpokenChordPhrase } from '../../music/chords';
import { createSilentWavBuffer } from '../silentKeepAlive';
import { ALL_VOICE_CLIP_TEXTS, getVoiceClipUrl } from '../voiceClips';

describe('voiceClips mapping', () => {
  it('maps every key and chord spoken phrase to an mp3 URL', () => {
    expect(ALL_VOICE_CLIP_TEXTS).toHaveLength(27);
    for (const phrase of ALL_VOICE_CLIP_TEXTS) {
      const url = getVoiceClipUrl(phrase);
      expect(url).toMatch(/voice\/.*\.mp3$/);
    }

    for (const key of MAJOR_KEYS) {
      expect(getVoiceClipUrl(`Key of ${key.spokenName}`)).not.toBeNull();
    }

    for (const id of ALL_CHORD_IDS) {
      const p1 = getSpokenChordPhrase(id, 'half-diminished');
      const p2 = getSpokenChordPhrase(id, 'minor-seven-flat-five');
      expect(getVoiceClipUrl(p1.text)).not.toBeNull();
      expect(getVoiceClipUrl(p2.text)).not.toBeNull();
    }
  });
});

describe('SilentKeepAlive WAV buffer', () => {
  it('creates a 44.1kHz 16-bit mono PCM WAV with zero endpoints and non-zero interior samples', () => {
    const buf = createSilentWavBuffer();
    const view = new DataView(buf);

    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );
    expect(riff).toBe('RIFF');
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);

    const numSamples = 44100 * 2;
    expect(buf.byteLength).toBe(44 + numSamples * 2);

    // Loop boundaries must be strictly zero so looping never clicks.
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(44 + (numSamples - 1) * 2, true)).toBe(0);

    // Interior contains +/-1 LSB so mobile pipelines remain active.
    let nonZeroCount = 0;
    for (let i = 0; i < numSamples; i++) {
      if (view.getInt16(44 + i * 2, true) !== 0) {
        nonZeroCount++;
      }
    }
    expect(nonZeroCount).toBeGreaterThan(1000);
  });
});

describe('AudioBufferAnnouncer', () => {
  function createMockHost() {
    let createdSource: {
      buffer: AudioBuffer | null;
      playbackRate: { setValueAtTime: ReturnType<typeof vi.fn> };
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onended: (() => void) | null;
    } | null = null;

    const gainNode = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const fakeBuffer = { duration: 0.9 } as AudioBuffer;
    const ctx = {
      currentTime: 10,
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue(fakeBuffer),
      createBufferSource: vi.fn(() => {
        createdSource = {
          buffer: null,
          playbackRate: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        return createdSource;
      }),
      createGain: vi.fn(() => gainNode),
    } as unknown as AudioContext;

    const voiceInput = {} as AudioNode;
    return {
      host: {
        getAudioContext: () => ctx,
        getVoiceInput: () => voiceInput,
      },
      ctx,
      getSource: () => createdSource,
    };
  }

  it('fetches, decodes, plays with playbackRate, and invokes onStart/onEnd', async () => {
    const { host, getSource } = createMockHost();
    const fakeBytes = new ArrayBuffer(16);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeBytes,
    }) as unknown as typeof fetch;

    const announcer = new AudioBufferAnnouncer(host, fetcher);
    const onStart = vi.fn();
    const onEnd = vi.fn();

    const played = await announcer.trySpeak('Key of C', {
      rate: 1.15,
      voiceURI: null,
      estimatedSyllables: 4,
      onStart,
      onEnd,
    });

    expect(played).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    const src = getSource()!;
    expect(src.playbackRate.setValueAtTime).toHaveBeenCalledWith(1.15, 10);
    expect(src.start).toHaveBeenCalledTimes(1);

    // Exact buffer duration now drives duration estimation
    expect(announcer.estimateDurationSec(4, 1.0, 'Key of C')).toBeCloseTo(0.9, 5);

    src.onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('prevents onEnd from firing after cancel()', async () => {
    const { host, getSource } = createMockHost();
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }) as unknown as typeof fetch;

    const announcer = new AudioBufferAnnouncer(host, fetcher);
    const onEnd = vi.fn();

    await announcer.trySpeak('One', {
      rate: 1.0,
      voiceURI: null,
      estimatedSyllables: 1,
      onEnd,
    });

    const src = getSource()!;
    announcer.cancel();
    src.onended?.();
    expect(onEnd).not.toHaveBeenCalled();
  });
});
