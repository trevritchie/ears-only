import type { ScheduledNote } from '../music/arrangement';
import { midiToFreq } from '../music/voicing';
import type { TimbreId } from '../types/settings';
import { chordSliderToGain, voiceSliderToGain } from './volume';

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
  setChordVolume(volume: number): void;
  setVoiceVolume(volume: number): void;
  onStateChange(cb: (state: string) => void): () => void;
  dispose(): void;
}

interface InternalVoiceEntry {
  release: (atTime: number, customFadeSec?: number) => void;
}

function createRoomImpulseResponse(ctx: AudioContext): AudioBuffer {
  const durationSec = 0.55;
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = buffer.getChannelData(ch);
    let prev = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const decay = Math.pow(1 - progress, 3.2);
      const white = Math.random() * 2 - 1;
      // Lighter, natural room air without muffled mud.
      const filtered = prev * 0.42 + white * 0.58;
      prev = filtered;
      channelData[i] = filtered * decay * 0.35;
    }
  }
  return buffer;
}

export class PolySynth implements SynthEngine {
  private ctx: AudioContext | null = null;
  private chordBus: GainNode | null = null;
  private chordLevelGain: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private graphNodes: AudioNode[] = [];

  private activeVoices = new Set<InternalVoiceEntry>();
  private stateListeners = new Set<(state: string) => void>();
  private isDucked = false;
  private chordVolume = 0.75;
  private voiceVolume = 0.65;
  private stateChangeBound: (() => void) | null = null;

  private initGraph(): AudioContext {
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const ctx = new AudioCtx({ latencyHint: 'playback' });

    const chordBus = ctx.createGain();
    chordBus.gain.value = this.isDucked ? 0.38 : 1.0;

    const chordLevelGain = ctx.createGain();
    chordLevelGain.gain.value = chordSliderToGain(this.chordVolume);

    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = 6500;
    warmthFilter.Q.value = 0.5;

    const presenceShelf = ctx.createBiquadFilter();
    presenceShelf.type = 'highshelf';
    presenceShelf.frequency.value = 1600;
    presenceShelf.gain.value = 1.5;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.92;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.1;

    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulseResponse(ctx);

    const voiceBus = ctx.createGain();
    voiceBus.gain.value = voiceSliderToGain(this.voiceVolume);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;

    chordBus.connect(chordLevelGain);
    chordLevelGain.connect(warmthFilter);
    warmthFilter.connect(presenceShelf);
    presenceShelf.connect(dryGain);
    presenceShelf.connect(convolver);
    convolver.connect(wetGain);

    dryGain.connect(compressor);
    wetGain.connect(compressor);
    voiceBus.connect(compressor);
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
    this.chordLevelGain = chordLevelGain;
    this.voiceBus = voiceBus;
    this.compressor = compressor;
    this.graphNodes = [
      chordBus,
      chordLevelGain,
      warmthFilter,
      presenceShelf,
      dryGain,
      wetGain,
      convolver,
      voiceBus,
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
    return this.ctx ?? this.initGraph();
  }

  getCompressorInput(): AudioNode | null {
    if (!this.ctx) this.initGraph();
    return this.compressor;
  }

  getVoiceInput(): AudioNode | null {
    if (!this.ctx) this.initGraph();
    return this.voiceBus;
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
    const target = ducked ? 0.38 : 1.0;
    this.chordBus.gain.setTargetAtTime(target, t, 0.06);
  }

  setChordVolume(volume: number): void {
    this.chordVolume = Math.max(0, Math.min(1, volume));
    if (!this.ctx || !this.chordLevelGain) return;
    this.chordLevelGain.gain.setTargetAtTime(
      chordSliderToGain(this.chordVolume),
      this.ctx.currentTime,
      0.04,
    );
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
    if (!this.ctx || !this.voiceBus) return;
    this.voiceBus.gain.setTargetAtTime(
      voiceSliderToGain(this.voiceVolume),
      this.ctx.currentTime,
      0.04,
    );
  }

  playChord(
    notes: readonly ScheduledNote[],
    startTime: number,
    timbre: TimbreId,
  ): ChordVoiceHandle {
    const ctx = this.initGraph();
    const bus = this.chordBus!;

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
    const now = ctx.currentTime;
    const t0 = Math.max(now + 0.004, chordStart + note.offsetSec);
    const freq = midiToFreq(note.midi);
    const peakGain = note.velocity * countScale * 0.44;

    // Dual-gain architecture: envGain handles attack/decay undisturbed while
    // releaseGain stays strictly at 1.0 until linear fade-out to zero.
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.setValueAtTime(0, t0);

    const releaseGain = ctx.createGain();
    releaseGain.gain.setValueAtTime(1.0, now);

    const noteFilter = ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';
    noteFilter.Q.value = 0.65;

    const oscs: OscillatorNode[] = [];
    const auxNodes: AudioNode[] = [noteFilter, envGain, releaseGain];

    let defaultReleaseSec = 0.15;

    if (timbre === 'electric-piano') {
      defaultReleaseSec = 0.15;
      const attackSec = 0.014;
      const sustainRatio = 0.56;

      const startCutoff = note.role === 'bass' ? 2400 : 5200;
      const endCutoff = note.role === 'bass' ? 1300 : 2500;
      noteFilter.frequency.setValueAtTime(startCutoff, now);
      noteFilter.frequency.setValueAtTime(startCutoff, t0);
      noteFilter.frequency.exponentialRampToValueAtTime(endCutoff, t0 + 1.4);

      // Fundamental sine
      const fundOsc = ctx.createOscillator();
      fundOsc.type = 'sine';
      fundOsc.frequency.setValueAtTime(freq, t0);
      const fundGain = ctx.createGain();
      fundGain.gain.value = 0.78;
      fundOsc.connect(fundGain);
      fundGain.connect(noteFilter);
      oscs.push(fundOsc);
      auxNodes.push(fundGain);

      // Warm sustained triangle body
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(freq, t0);
      const bodyGain = ctx.createGain();
      bodyGain.gain.value = 0.26;
      bodyOsc.connect(bodyGain);
      bodyGain.connect(noteFilter);
      oscs.push(bodyOsc);
      auxNodes.push(bodyGain);

      // Rhodes 2nd-harmonic bell tine
      const tineOsc = ctx.createOscillator();
      tineOsc.type = 'sine';
      tineOsc.frequency.setValueAtTime(freq * 2, t0);
      const tineGain = ctx.createGain();
      const tineInit = note.role === 'bass' ? 0.14 : 0.28;
      tineGain.gain.setValueAtTime(tineInit, now);
      tineGain.gain.setValueAtTime(tineInit, t0);
      tineGain.gain.setTargetAtTime(
        note.role === 'bass' ? 0.04 : 0.09,
        t0 + attackSec,
        0.25,
      );
      tineOsc.connect(tineGain);
      tineGain.connect(noteFilter);
      oscs.push(tineOsc);
      auxNodes.push(tineGain);

      // 3rd harmonic clarity
      const thirdOsc = ctx.createOscillator();
      thirdOsc.type = 'sine';
      thirdOsc.frequency.setValueAtTime(freq * 3, t0);
      const thirdGain = ctx.createGain();
      const thirdInit = note.role === 'bass' ? 0.05 : 0.11;
      thirdGain.gain.setValueAtTime(thirdInit, now);
      thirdGain.gain.setValueAtTime(thirdInit, t0);
      thirdGain.gain.setTargetAtTime(
        note.role === 'bass' ? 0.01 : 0.025,
        t0 + attackSec,
        0.16,
      );
      thirdOsc.connect(thirdGain);
      thirdGain.connect(noteFilter);
      oscs.push(thirdOsc);
      auxNodes.push(thirdGain);

      // Subtle 4th-harmonic chime on harmony attack
      if (note.role !== 'bass') {
        const chimeOsc = ctx.createOscillator();
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(freq * 4, t0);
        const chimeGain = ctx.createGain();
        chimeGain.gain.setValueAtTime(0.05, now);
        chimeGain.gain.setValueAtTime(0.05, t0);
        chimeGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.16);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(noteFilter);
        oscs.push(chimeOsc);
        auxNodes.push(chimeGain);
      }

      envGain.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
      envGain.gain.setTargetAtTime(
        peakGain * sustainRatio,
        t0 + attackSec,
        0.55,
      );
    } else {
      // Clear, airy Soft Pad timbre
      defaultReleaseSec = 0.26;
      const attackSec = 0.11;

      const cutoff = note.role === 'bass' ? 1800 : 3000;
      noteFilter.frequency.setValueAtTime(cutoff, now);
      noteFilter.frequency.setValueAtTime(cutoff, t0);

      const oscA = ctx.createOscillator();
      oscA.type = 'triangle';
      oscA.frequency.setValueAtTime(freq, t0);
      oscA.detune.setValueAtTime(-4, t0);
      const gainA = ctx.createGain();
      gainA.gain.value = 0.48;
      oscA.connect(gainA);
      gainA.connect(noteFilter);
      oscs.push(oscA);
      auxNodes.push(gainA);

      const oscB = ctx.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.setValueAtTime(freq, t0);
      oscB.detune.setValueAtTime(4, t0);
      const gainB = ctx.createGain();
      gainB.gain.value = 0.48;
      oscB.connect(gainB);
      gainB.connect(noteFilter);
      oscs.push(oscB);
      auxNodes.push(gainB);

      if (note.role !== 'bass') {
        const airOsc = ctx.createOscillator();
        airOsc.type = 'sine';
        airOsc.frequency.setValueAtTime(freq * 2, t0);
        const airGain = ctx.createGain();
        airGain.gain.value = 0.12;
        airOsc.connect(airGain);
        airGain.connect(noteFilter);
        oscs.push(airOsc);
        auxNodes.push(airGain);
      }

      envGain.gain.linearRampToValueAtTime(peakGain * 0.85, t0 + attackSec);
    }

    noteFilter.connect(envGain);
    envGain.connect(releaseGain);
    releaseGain.connect(destination);

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

      releaseGain.gain.setValueAtTime(1.0, releaseStart);
      releaseGain.gain.linearRampToValueAtTime(0, releaseStart + fadeSec);

      const stopAt = releaseStart + fadeSec + 0.04;
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
    this.chordLevelGain = null;
    this.voiceBus = null;
    this.compressor = null;
  }
}
