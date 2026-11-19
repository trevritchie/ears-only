import type { ScheduledNote } from '../music/arrangement';
import { midiToFreq } from '../music/voicing';
import type { TimbreId } from '../types/settings';

export interface ChordVoiceHandle {
  release(atTime: number, customFadeSec?: number): void;
}

export interface SynthEngine {
  ensureContext(): Promise<void>;
  getCurrentTime(): number;
  getContextState(): string;
  playChord(
    notes: readonly ScheduledNote[],
    startTime: number,
    timbre: TimbreId,
  ): ChordVoiceHandle;
  releaseAll(fadeSec?: number): void;
  setDucked(ducked: boolean, atTime?: number): void;
  onStateChange(cb: (state: string) => void): () => void;
  dispose(): void;
}

interface InternalVoiceEntry {
  release: (atTime: number, customFadeSec?: number) => void;
}

function cancelFutureAutomation(
  param: AudioParam,
  atTime: number,
  fallbackValue: number,
): void {
  const extended = param as AudioParam & {
    cancelAndHoldAtTime?: (cancelTime: number) => void;
  };
  if (typeof extended.cancelAndHoldAtTime === 'function') {
    try {
      extended.cancelAndHoldAtTime(atTime);
      return;
    } catch {
      // Fallback below for engines where cancelAndHoldAtTime rejects.
    }
  }
  param.cancelScheduledValues(atTime);
  param.setValueAtTime(fallbackValue, atTime);
}

function createRoomImpulseResponse(ctx: AudioContext): AudioBuffer {
  const durationSec = 1.1;
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = buffer.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const decay = Math.pow(1 - progress, 2.8);
      const white = Math.random() * 2 - 1;
      // Gentle one-pole lowpass to warm up the early room reflections.
      const filtered = prev * 0.68 + white * 0.32;
      prev = filtered;
      channelData[i] = filtered * decay * 0.45;
    }
  }
  return buffer;
}

export class PolySynth implements SynthEngine {
  private ctx: AudioContext | null = null;
  private chordBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private graphNodes: AudioNode[] = [];

  private activeVoices = new Set<InternalVoiceEntry>();
  private stateListeners = new Set<(state: string) => void>();
  private isDucked = false;
  private stateChangeBound: (() => void) | null = null;

  private initGraph(): AudioContext {
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const ctx = new AudioCtx({ latencyHint: 'interactive' });

    const chordBus = ctx.createGain();
    chordBus.gain.value = 1.0;

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 3200;
    warmthFilter.Q.value = 0.6;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.88;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.14;

    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulseResponse(ctx);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;

    chordBus.connect(warmthFilter);
    warmthFilter.connect(dryGain);
    warmthFilter.connect(convolver);
    convolver.connect(wetGain);

    dryGain.connect(compressor);
    wetGain.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    const onStateChange = () => {
      const state = ctx.state as string;
      for (const listener of this.stateListeners) {
        listener(state);
      }
    };
    ctx.addEventListener('statechange', onStateChange);

    this.ctx = ctx;
    this.chordBus = chordBus;
    this.compressor = compressor;
    this.graphNodes = [
      chordBus,
      warmthFilter,
      dryGain,
      wetGain,
      convolver,
      compressor,
      masterGain,
    ];
    this.stateChangeBound = onStateChange;

    return ctx;
  }

  async ensureContext(): Promise<void> {
    const ctx = this.initGraph();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        // Browsers may reject if called outside gesture; handled on state checks.
      }
    }
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  getCompressorInput(): AudioNode | null {
    return this.compressor;
  }

  getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  getContextState(): string {
    return this.ctx ? (this.ctx.state as string) : 'suspended';
  }

  onStateChange(cb: (state: string) => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  setDucked(ducked: boolean, atTime?: number): void {
    this.isDucked = ducked;
    if (!this.ctx || !this.chordBus) return;
    const t = Math.max(this.ctx.currentTime, atTime ?? this.ctx.currentTime);
    const target = ducked ? 0.32 : 1.0;
    this.chordBus.gain.setTargetAtTime(target, t, 0.08);
  }

  playChord(
    notes: readonly ScheduledNote[],
    startTime: number,
    timbre: TimbreId,
  ): ChordVoiceHandle {
    const ctx = this.initGraph();
    const bus = this.chordBus!;
    if (this.isDucked) {
      bus.gain.setValueAtTime(0.32, Math.max(ctx.currentTime, startTime));
    }

    const baseStart = Math.max(ctx.currentTime + 0.005, startTime);
    const countScale = 1 / Math.sqrt(Math.max(1, notes.length));
    const noteReleases: ((atTime: number, customFadeSec?: number) => void)[] = [];

    for (const note of notes) {
      const releaseFn = this.scheduleSingleNote(
        ctx,
        bus,
        note,
        baseStart,
        countScale,
        timbre,
      );
      noteReleases.push(releaseFn);
    }

    let released = false;
    const entry: InternalVoiceEntry = {
      release: (atTime: number, customFadeSec?: number) => {
        if (released) return;
        released = true;
        this.activeVoices.delete(entry);
        for (const fn of noteReleases) {
          fn(atTime, customFadeSec);
        }
      },
    };
    this.activeVoices.add(entry);

    return {
      release: (atTime: number, customFadeSec?: number) => {
        entry.release(atTime, customFadeSec);
      },
    };
  }

  private scheduleSingleNote(
    ctx: AudioContext,
    destination: AudioNode,
    note: ScheduledNote,
    chordStart: number,
    countScale: number,
    timbre: TimbreId,
  ): (atTime: number, customFadeSec?: number) => void {
    const t0 = chordStart + note.offsetSec;
    const freq = midiToFreq(note.midi);
    const peakGain = note.velocity * countScale * 0.46;

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, t0);

    const noteFilter = ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';

    const oscs: OscillatorNode[] = [];
    const auxNodes: AudioNode[] = [noteFilter, envGain];

    let defaultReleaseSec = 0.14;
    let sustainRatio = 0.52;

    if (timbre === 'electric-piano') {
      defaultReleaseSec = 0.14;
      sustainRatio = 0.52;

      const attackSec = 0.018;
      noteFilter.frequency.setValueAtTime(note.role === 'bass' ? 1400 : 2300, t0);
      noteFilter.frequency.exponentialRampToValueAtTime(
        note.role === 'bass' ? 700 : 1150,
        t0 + 1.1,
      );
      noteFilter.Q.value = 0.7;

      // Fundamental sine
      const fundOsc = ctx.createOscillator();
      fundOsc.type = 'sine';
      fundOsc.frequency.setValueAtTime(freq, t0);
      const fundGain = ctx.createGain();
      fundGain.gain.value = 1.0;
      fundOsc.connect(fundGain);
      fundGain.connect(noteFilter);
      oscs.push(fundOsc);
      auxNodes.push(fundGain);

      // Gentle 2nd-harmonic bell tine
      const tineOsc = ctx.createOscillator();
      tineOsc.type = 'triangle';
      tineOsc.frequency.setValueAtTime(freq * 2, t0);
      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(note.role === 'bass' ? 0.08 : 0.16, t0);
      tineGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      tineOsc.connect(tineGain);
      tineGain.connect(noteFilter);
      oscs.push(tineOsc);
      auxNodes.push(tineGain);

      // Subtle 3rd harmonic warmth on attack
      const thirdOsc = ctx.createOscillator();
      thirdOsc.type = 'sine';
      thirdOsc.frequency.setValueAtTime(freq * 3, t0);
      const thirdGain = ctx.createGain();
      thirdGain.gain.setValueAtTime(note.role === 'bass' ? 0.02 : 0.04, t0);
      thirdGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.1);
      thirdOsc.connect(thirdGain);
      thirdGain.connect(noteFilter);
      oscs.push(thirdOsc);
      auxNodes.push(thirdGain);

      envGain.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
      envGain.gain.setTargetAtTime(peakGain * sustainRatio, t0 + attackSec, 0.45);
    } else {
      // Soft Pad timbre
      defaultReleaseSec = 0.28;
      sustainRatio = 0.85;

      const attackSec = 0.14;
      noteFilter.frequency.setValueAtTime(note.role === 'bass' ? 900 : 1450, t0);
      noteFilter.Q.value = 0.7;

      const oscA = ctx.createOscillator();
      oscA.type = 'triangle';
      oscA.frequency.setValueAtTime(freq, t0);
      oscA.detune.setValueAtTime(-4, t0);
      const gainA = ctx.createGain();
      gainA.gain.value = 0.52;
      oscA.connect(gainA);
      gainA.connect(noteFilter);
      oscs.push(oscA);
      auxNodes.push(gainA);

      const oscB = ctx.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.setValueAtTime(freq, t0);
      oscB.detune.setValueAtTime(4, t0);
      const gainB = ctx.createGain();
      gainB.gain.value = 0.56;
      oscB.connect(gainB);
      gainB.connect(noteFilter);
      oscs.push(oscB);
      auxNodes.push(gainB);

      envGain.gain.linearRampToValueAtTime(peakGain * 0.85, t0 + attackSec);
    }

    noteFilter.connect(envGain);
    envGain.connect(destination);

    let noteReleased = false;
    const cleanup = () => {
      for (const osc of oscs) {
        try {
          osc.disconnect();
        } catch {
          // Ignore already-disconnected nodes.
        }
      }
      for (const node of auxNodes) {
        try {
          node.disconnect();
        } catch {
          // Ignore already-disconnected nodes.
        }
      }
    };

    if (oscs.length > 0) {
      oscs[0].onended = cleanup;
    }

    for (const osc of oscs) {
      osc.start(t0);
    }

    const triggerRelease = (atTime: number, customFadeSec?: number) => {
      if (noteReleased) return;
      noteReleased = true;

      const fadeSec = customFadeSec ?? defaultReleaseSec;
      const releaseStart = Math.max(atTime, ctx.currentTime, t0 + 0.02);
      const fallbackLevel =
        releaseStart <= ctx.currentTime + 0.01
          ? Math.max(0.0001, envGain.gain.value)
          : Math.max(0.0001, peakGain * sustainRatio);

      cancelFutureAutomation(envGain.gain, releaseStart, fallbackLevel);
      envGain.gain.linearRampToValueAtTime(0.0001, releaseStart + fadeSec);

      const stopAt = releaseStart + fadeSec + 0.025;
      for (const osc of oscs) {
        try {
          osc.stop(stopAt);
        } catch {
          // Ignore if oscillator has not started or already stopped.
        }
      }
    };

    if (note.durationSec !== null) {
      triggerRelease(t0 + note.durationSec);
    }

    return triggerRelease;
  }

  releaseAll(fadeSec = 0.06): void {
    const now = this.getCurrentTime();
    for (const entry of Array.from(this.activeVoices)) {
      entry.release(now, fadeSec);
    }
    this.activeVoices.clear();
  }

  dispose(): void {
    this.releaseAll(0.02);
    if (this.ctx && this.stateChangeBound) {
      this.ctx.removeEventListener('statechange', this.stateChangeBound);
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch(() => {});
    }
    for (const node of this.graphNodes) {
      try {
        node.disconnect();
      } catch {
        // Ignore already-disconnected nodes.
      }
    }
    this.graphNodes = [];
    this.ctx = null;
    this.chordBus = null;
    this.compressor = null;
  }
}
