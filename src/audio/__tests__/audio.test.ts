import { describe, expect, it, vi } from 'vitest';
import { AudioBufferAnnouncer } from '../../engine/audioAnnouncer';
import { MAJOR_KEYS, ALL_CHORD_IDS, getSpokenChordPhrase } from '../../music/chords';
import { sanitizeSettings } from '../../types/settings';
import { formatDroneNoteName, pitchClassToDroneMidi } from '../drone';
import { INSTRUMENT_PRESETS } from '../instruments';
import { computeVoicePan } from '../instruments/types';
import { AMBIENCE_CONFIGS, createAmbienceImpulseResponse } from '../reverb';
import { createSilentWavBuffer } from '../silentKeepAlive';
import {
  DUCKED_CHORD_BUS_GAIN,
  PolySynth,
  VOICE_POCKET_CUT_DB,
  VOICE_POCKET_FREQ_HZ,
} from '../synth';
import { ALL_VOICE_CLIP_TEXTS, getVoiceClipUrl } from '../voiceClips';
import {
  chordSliderToGain,
  droneSliderToGain,
  voiceSliderToGain,
} from '../volume';

describe('voiceClips mapping', () => {
  it('maps every key and chord spoken phrase to an mp3 URL', () => {
    expect(ALL_VOICE_CLIP_TEXTS).toHaveLength(27);
    for (const phrase of ALL_VOICE_CLIP_TEXTS) {
      const url = getVoiceClipUrl(phrase);
      expect(url).toMatch(/voice\/.*\.mp3(\?v=\d+)?$/);
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

describe('perceptual volume calibration', () => {
  it('maps 0 to exact silence and places default sweet spots cleanly in the middle of each slider', () => {
    expect(chordSliderToGain(0)).toBe(0);
    expect(voiceSliderToGain(0)).toBe(0);
    expect(droneSliderToGain(0)).toBe(0);

    // Chords 75% ~= 0.98, Voice 65% ~= 0.24, Drone 50% ~= 0.08
    expect(chordSliderToGain(0.75)).toBeCloseTo(0.98, 1);
    expect(voiceSliderToGain(0.65)).toBeCloseTo(0.24, 2);
    expect(droneSliderToGain(0.5)).toBeCloseTo(0.08, 2);

    // Strictly monotonic with useful headroom up to 100%
    expect(voiceSliderToGain(1.0)).toBeGreaterThan(voiceSliderToGain(0.65) * 2);
    expect(chordSliderToGain(1.0)).toBeGreaterThan(chordSliderToGain(0.75) * 1.5);
  });
});

describe('meditative instruments & ambience', () => {
  it('exposes all 6 instrument presets including preserved classic voices', () => {
    expect(INSTRUMENT_PRESETS).toHaveLength(6);
    const ids = INSTRUMENT_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'felt-piano',
      'warm-rhodes',
      'velvet-pad',
      'soft-vibes',
      'electric-piano',
      'soft-pad',
    ]);
    for (const preset of INSTRUMENT_PRESETS) {
      expect(preset.defaultReleaseSec).toBeGreaterThan(0);
      expect(preset.rollStepSec).toBeGreaterThanOrEqual(0);
    }
  });

  it('centers bass pan and spreads upper voices symmetrically inside [-0.3, 0.3]', () => {
    expect(Math.abs(computeVoicePan(0, 4, 'bass'))).toBeLessThanOrEqual(0.05);
    const upperPans = [
      computeVoicePan(1, 4, 'harmony'),
      computeVoicePan(2, 4, 'harmony'),
      computeVoicePan(3, 4, 'harmony'),
    ];
    for (const pan of upperPans) {
      expect(pan).toBeGreaterThanOrEqual(-0.3);
      expect(pan).toBeLessThanOrEqual(0.3);
    }
    expect(upperPans[0]).toBeLessThan(0);
    expect(upperPans[2]).toBeGreaterThan(0);
  });

  it('builds pre-delayed damped stereo impulse responses for Warm Room and Lush Hall', () => {
    const fakeCtx = {
      sampleRate: 44100,
      createBuffer: (_ch: number, len: number) => {
        const ch0 = new Float32Array(len);
        const ch1 = new Float32Array(len);
        return {
          length: len,
          numberOfChannels: 2,
          getChannelData: (c: number) => (c === 0 ? ch0 : ch1),
        } as unknown as AudioBuffer;
      },
    } as unknown as BaseAudioContext;

    expect(AMBIENCE_CONFIGS.dry.wetGain).toBe(0);

    for (const mode of ['warm-room', 'lush-hall'] as const) {
      const ir = createAmbienceImpulseResponse(fakeCtx, mode);
      const left = ir.getChannelData(0);
      const right = ir.getChannelData(1);
      // Pre-delay starts strictly silent
      expect(left[0]).toBe(0);
      expect(right[0]).toBe(0);
      // Tail has bounded non-zero energy
      const peak = left.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
      expect(peak).toBeGreaterThan(0.01);
      expect(peak).toBeLessThanOrEqual(0.5);
    }
  });

  it('defaults fresh settings to felt-piano + warm-room while preserving classic saved timbres', () => {
    const fresh = sanitizeSettings(null);
    expect(fresh.timbre).toBe('felt-piano');
    expect(fresh.ambience).toBe('warm-room');

    expect(sanitizeSettings({ timbre: 'electric-piano' }).timbre).toBe(
      'electric-piano',
    );
    expect(sanitizeSettings({ timbre: 'soft-pad' }).timbre).toBe('soft-pad');
    expect(sanitizeSettings({ ambience: 'lush-hall' }).ambience).toBe(
      'lush-hall',
    );
    expect(sanitizeSettings({ droneOctave: 2 }).droneOctave).toBe(2);
    expect(sanitizeSettings({ droneOctave: -5 }).droneOctave).toBe(-1);
    expect(sanitizeSettings({ droneOctave: 9 }).droneOctave).toBe(2);
  });

  it('maps drone octave offsets cleanly from deep bass (-1) to high soprano pedal (+2)', () => {
    // C (0): -1 = C2 (36), 0 = C3 (48), +1 = C4 (60), +2 = C5 (72)
    expect(pitchClassToDroneMidi(0, -1)).toBe(36);
    expect(pitchClassToDroneMidi(0, 0)).toBe(48);
    expect(pitchClassToDroneMidi(0, 1)).toBe(60);
    expect(pitchClassToDroneMidi(0, 2)).toBe(72);

    expect(formatDroneNoteName(0, -1)).toBe('C2');
    expect(formatDroneNoteName(0, 2)).toBe('C5');
    // G (7): +2 = G5 (79), clearly above E5 (76) upper chord ceiling
    expect(pitchClassToDroneMidi(7, 2)).toBe(79);
    expect(formatDroneNoteName(7, 2)).toBe('G5');
  });

  it('uses midrange EQ pocket carving with gentle broadband cushion when ducking', async () => {
    const createdFilters: Array<{
      type: string;
      frequency: { value: number };
      Q: { value: number };
      gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
    }> = [];
    const createdGains: Array<{
      gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> };
    }> = [];

    const makeParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });

    class MockAudioContext {
      currentTime = 2.0;
      sampleRate = 44100;
      state = 'running';
      destination = {};
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createGain = vi.fn(() => {
        const node = {
          gain: makeParam(1),
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        createdGains.push(node);
        return node;
      });
      createBiquadFilter = vi.fn(() => {
        const node = {
          type: 'lowpass',
          frequency: makeParam(350),
          Q: makeParam(1),
          gain: makeParam(0),
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        createdFilters.push(node);
        return node;
      });
      createConvolver = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createDynamicsCompressor = vi.fn(() => ({
        threshold: makeParam(-6),
        knee: makeParam(12),
        ratio: makeParam(3),
        attack: makeParam(0.008),
        release: makeParam(0.18),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));
      createBuffer = vi.fn((ch: number, len: number) => {
        const channels = Array.from({ length: ch }, () => new Float32Array(len));
        return {
          length: len,
          numberOfChannels: ch,
          getChannelData: (c: number) => channels[c],
        };
      });
    }

    const originalAudioContext = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
      writable: true,
    });

    try {
      const synth = new PolySynth();
      await synth.ensureContext();

      const pocketFilter = createdFilters.find((f) => f.type === 'peaking');
      expect(pocketFilter).toBeDefined();
      expect(pocketFilter!.frequency.value).toBe(VOICE_POCKET_FREQ_HZ);
      expect(pocketFilter!.gain.value).toBe(0);

      const chordBus = createdGains[0];
      synth.setDucked(true, 2.0);
      expect(chordBus.gain.setTargetAtTime).toHaveBeenCalledWith(
        DUCKED_CHORD_BUS_GAIN,
        2.0,
        0.08,
      );
      expect(pocketFilter!.gain.setTargetAtTime).toHaveBeenCalledWith(
        VOICE_POCKET_CUT_DB,
        2.0,
        0.08,
      );

      synth.setDucked(false, 4.0);
      expect(chordBus.gain.setTargetAtTime).toHaveBeenCalledWith(1.0, 4.0, 0.08);
      expect(pocketFilter!.gain.setTargetAtTime).toHaveBeenCalledWith(
        0,
        4.0,
        0.08,
      );

      synth.dispose();
    } finally {
      Object.defineProperty(window, 'AudioContext', {
        value: originalAudioContext,
        configurable: true,
        writable: true,
      });
    }
  });
});
