import { describe, expect, it, vi } from 'vitest';
import { AudioBufferAnnouncer } from '../../engine/audioAnnouncer';
import { PocketManager } from '../../engine/pocketManager';
import {
  MAJOR_KEYS,
  ALL_CHORD_IDS,
  getSpokenChordPhrase,
  getSpokenKeyPhrase,
} from '../../music/chords';
import {
  LEGACY_SETTINGS_STORAGE_KEY,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from '../../types/settings';
import {
  CHOIR_ANCHOR_MIDIS,
  ChoirSampleBank,
  findNearestChoirAnchor,
  getChoirSampleUrl,
} from '../choirSamples';
import { formatDroneNoteName, pitchClassToDroneMidi } from '../drone';
import { INSTRUMENT_PRESETS } from '../instruments';
import { computeVoicePan } from '../instruments/types';
import { AMBIENCE_CONFIGS, createAmbienceImpulseResponse } from '../reverb';
import {
  ACOUSTIC_PACK_CONFIGS,
  AcousticSampleBank,
  findNearestAnchor,
  getAcousticSampleUrl,
} from '../sampleBank';
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
    expect(ALL_VOICE_CLIP_TEXTS).toHaveLength(43);
    for (const phrase of ALL_VOICE_CLIP_TEXTS) {
      const url = getVoiceClipUrl(phrase);
      expect(url).toMatch(/voice\/.*\.mp3(\?v=\d+)?$/);
    }

    for (const key of MAJOR_KEYS) {
      expect(getVoiceClipUrl(getSpokenKeyPhrase(key.pitchClass))).not.toBeNull();
    }

    for (const id of ALL_CHORD_IDS) {
      for (const announceTriadQuality of [false, true]) {
        const p1 = getSpokenChordPhrase(
          id,
          'half-diminished',
          announceTriadQuality,
        );
        const p2 = getSpokenChordPhrase(
          id,
          'minor-seven-flat-five',
          announceTriadQuality,
        );
        expect(getVoiceClipUrl(p1.text)).not.toBeNull();
        expect(getVoiceClipUrl(p2.text)).not.toBeNull();
      }
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

describe('PocketManager lock-screen Media Session metadata', () => {
  it('publishes metadata with synchronous inline data-URL artwork (no background network fetch when locked)', () => {
    const fakeMediaSession = {
      metadata: null as {
        title?: string;
        artist?: string;
        album?: string;
        artwork?: Array<{ src: string; sizes?: string; type?: string }>;
      } | null,
      playbackState: 'none',
      setActionHandler: vi.fn(),
    };

    class MockMediaMetadata {
      title?: string;
      artist?: string;
      album?: string;
      artwork?: Array<{ src: string; sizes?: string; type?: string }>;
      constructor(init: {
        title?: string;
        artist?: string;
        album?: string;
        artwork?: Array<{ src: string; sizes?: string; type?: string }>;
      }) {
        Object.assign(this, init);
      }
    }

    const origMediaSession = Object.getOwnPropertyDescriptor(
      navigator,
      'mediaSession',
    );
    const origMediaMetadata = (globalThis as Record<string, unknown>)
      .MediaMetadata;
    const origCreateElement = document.createElement.bind(document);
    const canvasSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 256,
            height: 256,
            getContext: () => ({
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 1,
              lineCap: 'round',
              lineJoin: 'round',
              fillRect: vi.fn(),
              strokeRect: vi.fn(),
              save: vi.fn(),
              restore: vi.fn(),
              translate: vi.fn(),
              scale: vi.fn(),
              beginPath: vi.fn(),
              ellipse: vi.fn(),
              arc: vi.fn(),
              fill: vi.fn(),
              stroke: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
          } as unknown as HTMLCanvasElement;
        }
        return origCreateElement(tagName);
      });

    Object.defineProperty(navigator, 'mediaSession', {
      value: fakeMediaSession,
      configurable: true,
    });
    (globalThis as Record<string, unknown>).MediaMetadata = MockMediaMetadata;

    try {
      const pocket = new PocketManager();
      pocket.updateMetadata({
        title: 'Q1 Answer: I – IV – V',
        artist: 'Paws Off',
        album: 'C Major · 120 BPM',
      });

      expect(fakeMediaSession.metadata).not.toBeNull();
      expect(fakeMediaSession.metadata!.title).toBe('Q1 Answer: I – IV – V');
      expect(fakeMediaSession.metadata!.artist).toBe('Paws Off');
      expect(fakeMediaSession.metadata!.album).toBe('C Major · 120 BPM');
      expect(fakeMediaSession.metadata!.artwork).toHaveLength(1);
      expect(fakeMediaSession.metadata!.artwork![0].src).toMatch(
        /^data:image\/png;base64,/,
      );
      pocket.dispose();
    } finally {
      canvasSpy.mockRestore();
      if (origMediaSession) {
        Object.defineProperty(navigator, 'mediaSession', origMediaSession);
      } else {
        delete (navigator as unknown as Record<string, unknown>).mediaSession;
      }
      (globalThis as Record<string, unknown>).MediaMetadata = origMediaMetadata;
    }
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

    const played = await announcer.trySpeak('Key of C major', {
      rate: 1.15,
      voiceURI: null,
      estimatedSyllables: 6,
      onStart,
      onEnd,
    });

    expect(played).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    const src = getSource()!;
    expect(src.playbackRate.setValueAtTime).toHaveBeenCalledWith(1.15, 10);
    expect(src.start).toHaveBeenCalledTimes(1);

    // Exact buffer duration now drives duration estimation
    expect(
      announcer.estimateDurationSec(6, 1.0, 'Key of C major'),
    ).toBeCloseTo(0.9, 5);

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
  it('exposes all 14 instrument presets (Velvet Pad default, 10 real-sample acoustics, and 4 synths)', () => {
    expect(INSTRUMENT_PRESETS).toHaveLength(14);
    const ids = INSTRUMENT_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'velvet-pad',
      'grand-piano',
      'warm-strings',
      'chamber-cello',
      'satb-choir',
      'french-horn',
      'concert-harp',
      'nylon-guitar',
      'clean-guitar',
      'harmonium',
      'pipe-organ',
      'felt-piano',
      'warm-rhodes',
      'soft-vibes',
    ]);
    for (const preset of INSTRUMENT_PRESETS) {
      expect(preset.defaultReleaseSec).toBeGreaterThan(0);
      expect(preset.rollStepSec).toBeGreaterThanOrEqual(0);
    }
  });

  it('lazy-loads acoustic sample packs on demand and maps every note in E2..G5 cleanly', async () => {
    const maxAllowedShift: Record<string, number> = {
      'french-horn': 7,
      'chamber-cello': 4,
    };
    for (const [id, cfg] of Object.entries(ACOUSTIC_PACK_CONFIGS)) {
      const limit = maxAllowedShift[id] ?? 2;
      for (let midi = 40; midi <= 76; midi++) {
        const { anchorMidi, playbackRate } = findNearestAnchor(
          cfg.anchors,
          midi,
        );
        expect(Math.abs(midi - anchorMidi)).toBeLessThanOrEqual(limit);
        expect(playbackRate).toBeCloseTo(
          Math.pow(2, (midi - anchorMidi) / 12),
          6,
        );
      }
      expect(
        getAcousticSampleUrl(
          id as keyof typeof ACOUSTIC_PACK_CONFIGS,
          cfg.anchors[0],
        ),
      ).toMatch(new RegExp(`samples/${id}/${cfg.anchors[0]}\\.mp3\\?v=\\d+$`));
    }

    const fakeBuf = { duration: 3.8 } as AudioBuffer;
    const fakeCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(fakeBuf),
    } as unknown as AudioContext;
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }) as unknown as typeof fetch;

    const bank = new AcousticSampleBank(fetcher);
    expect(bank.isPackLoaded('grand-piano')).toBe(false);
    await bank.preload(fakeCtx, 'grand-piano');
    expect(bank.isPackLoaded('grand-piano')).toBe(true);
    expect(bank.isPackLoaded('concert-harp')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(
      ACOUSTIC_PACK_CONFIGS['grand-piano'].anchors.length,
    );

    const note = bank.getSample('grand-piano', 61);
    expect(note).not.toBeNull();
    expect(note!.buffer).toBe(fakeBuf);
    expect(note!.sustained).toBe(false);
  });

  it('maps any chord MIDI note in E2..G5 to the nearest choir anchor within +/-2 semitones and decodes Ooh/Ahh samples', async () => {
    expect(CHOIR_ANCHOR_MIDIS).toHaveLength(10);
    for (let midi = 40; midi <= 76; midi++) {
      const { anchorMidi, playbackRate } = findNearestChoirAnchor(midi);
      expect(Math.abs(midi - anchorMidi)).toBeLessThanOrEqual(2);
      expect(playbackRate).toBeCloseTo(Math.pow(2, (midi - anchorMidi) / 12), 6);
    }
    expect(getChoirSampleUrl('ooh', 60)).toMatch(/choir\/ooh-60\.mp3\?v=\d+$/);
    expect(getChoirSampleUrl('ahh', 40)).toMatch(/choir\/ahh-40\.mp3\?v=\d+$/);

    const fakeBuf = { duration: 4.22 } as AudioBuffer;
    const fakeCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(fakeBuf),
    } as unknown as AudioContext;
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }) as unknown as typeof fetch;

    const bank = new ChoirSampleBank(fetcher);
    await bank.preload(fakeCtx);
    expect(bank.isLoaded()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(20);

    const sample = bank.getSample('ahh', 62); // D4 -> nearest anchor C4 (60) or E4 (64), +2/-2 semitones
    expect(sample).not.toBeNull();
    expect(sample!.buffer).toBe(fakeBuf);
    expect(Math.abs(Math.log2(sample!.playbackRate) * 12)).toBeLessThanOrEqual(2.001);
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

  it('defaults fresh settings to velvet-pad + warm-room, 80% mix, final replay ON, length 4 (max 8), and force-resets legacy v1 storage', () => {
    const fresh = sanitizeSettings(null);
    expect(fresh.timbre).toBe('velvet-pad');
    expect(fresh.ambience).toBe('warm-room');
    expect(fresh.voicePanning).toBe(true);
    expect(fresh.voicePanningMode).toBe('left-to-right');
    expect(fresh.announceTriadQuality).toBe(false);
    expect(fresh.playChordsBehindAnswer).toBe(true);
    expect(fresh.playFinalReplayAfterAnswer).toBe(true);
    expect(fresh.progressionLength).toBe(4);
    expect(fresh.bpm).toBe(120);
    expect(fresh.chordVolume).toBe(0.8);
    expect(fresh.voiceVolume).toBe(0.8);

    // Legacy v1 storage is discarded and cleared in favor of fresh v2 defaults
    window.localStorage.clear();
    window.localStorage.setItem(
      LEGACY_SETTINGS_STORAGE_KEY,
      JSON.stringify({ timbre: 'felt-piano', chordVolume: 0.5, bpm: 90 }),
    );
    const migrated = loadSettings();
    expect(migrated.timbre).toBe('velvet-pad');
    expect(migrated.chordVolume).toBe(0.8);
    expect(migrated.bpm).toBe(120);
    expect(window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY)).toBeNull();

    // New v2 settings persist normally after reset
    saveSettings({ ...migrated, bpm: 96, timbre: 'felt-piano' });
    const reloaded = loadSettings();
    expect(reloaded.bpm).toBe(96);
    expect(reloaded.timbre).toBe('felt-piano');
    window.localStorage.clear();

    expect(sanitizeSettings({ bpm: 40 }).bpm).toBe(60);
    expect(sanitizeSettings({ bpm: 240 }).bpm).toBe(240);
    expect(sanitizeSettings({ bpm: 300 }).bpm).toBe(240);

    expect(sanitizeSettings({ announceTriadQuality: true }).announceTriadQuality).toBe(true);
    expect(sanitizeSettings({ progressionLength: 8 }).progressionLength).toBe(8);
    expect(sanitizeSettings({ progressionLength: 1 }).progressionLength).toBe(2);
    expect(sanitizeSettings({ progressionLength: 12 }).progressionLength).toBe(8);

    // Removed legacy classic timbres fall back cleanly to velvet-pad default
    expect(sanitizeSettings({ timbre: 'electric-piano' }).timbre).toBe(
      'velvet-pad',
    );
    expect(sanitizeSettings({ timbre: 'soft-pad' }).timbre).toBe('velvet-pad');
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

      synth.setDucked(false, 6.0, 0.006);
      expect(chordBus.gain.setTargetAtTime).toHaveBeenCalledWith(1.0, 6.0, 0.006);
      expect(pocketFilter!.gain.setTargetAtTime).toHaveBeenCalledWith(
        0,
        6.0,
        0.006,
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
