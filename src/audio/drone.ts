import { midiToFreq } from '../music/voicing';
import type { PitchClass } from '../types/settings';
import type { PolySynth } from './synth';

export interface DroneEngine {
  start(pitch: PitchClass, volume: number): void;
  stop(): void;
  setPitch(pitch: PitchClass): void;
  setVolume(volume: number): void;
  dispose(): void;
}

interface DroneLayer {
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  nodes: AudioNode[];
  layerGain: GainNode;
  fadeOut: (fadeSec: number) => void;
}

function pitchClassToDroneMidi(pitch: PitchClass): number {
  // Maps all 12 pitch classes smoothly into warm cello range [A2 (45), G#3 (56)].
  return 45 + ((pitch - 9 + 12) % 12);
}

export class ChromaticDrone implements DroneEngine {
  private synth: PolySynth;
  private masterGain: GainNode | null = null;
  private activeLayer: DroneLayer | null = null;
  private running = false;
  private currentPitch: PitchClass = 0;
  private currentVolume = 0.35;

  constructor(synth: PolySynth) {
    this.synth = synth;
  }

  private ensureMasterGain(): { ctx: AudioContext; masterGain: GainNode; target: AudioNode } | null {
    const ctx = this.synth.getAudioContext();
    const target = this.synth.getCompressorInput();
    if (!ctx || !target) return null;

    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.scaledVolume(this.currentVolume);
      this.masterGain.connect(target);
    }
    return { ctx, masterGain: this.masterGain, target };
  }

  private scaledVolume(volume: number): number {
    // Keep drone conservative (max 0.24 effective gain) so it stays a calm halo.
    return Math.max(0, Math.min(1, volume)) * 0.24;
  }

  private spawnLayer(
    ctx: AudioContext,
    masterGain: GainNode,
    pitch: PitchClass,
    fadeInSec: number,
  ): DroneLayer {
    const midi = pitchClassToDroneMidi(pitch);
    const freq = midiToFreq(midi);
    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.Q.value = 0.65;

    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.0001, now);
    layerGain.gain.linearRampToValueAtTime(1.0, now + fadeInSec);

    // Subtle slow breathing LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, now);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.05;
    lfo.connect(lfoDepth);
    lfoDepth.connect(layerGain.gain);

    // Fundamental sine + warm triangle + soft octave + subtle pure 5th
    const fundOsc = ctx.createOscillator();
    fundOsc.type = 'sine';
    fundOsc.frequency.setValueAtTime(freq, now);
    const fundGain = ctx.createGain();
    fundGain.gain.value = 0.72;
    fundOsc.connect(fundGain);
    fundGain.connect(filter);

    const warmOsc = ctx.createOscillator();
    warmOsc.type = 'triangle';
    warmOsc.frequency.setValueAtTime(freq, now);
    const warmGain = ctx.createGain();
    warmGain.gain.value = 0.18;
    warmOsc.connect(warmGain);
    warmGain.connect(filter);

    const octOsc = ctx.createOscillator();
    octOsc.type = 'sine';
    octOsc.frequency.setValueAtTime(freq * 2, now);
    const octGain = ctx.createGain();
    octGain.gain.value = 0.16;
    octOsc.connect(octGain);
    octGain.connect(filter);

    const fifthOsc = ctx.createOscillator();
    fifthOsc.type = 'sine';
    fifthOsc.frequency.setValueAtTime(freq * 1.5, now);
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.05;
    fifthOsc.connect(fifthGain);
    fifthGain.connect(filter);

    filter.connect(layerGain);
    layerGain.connect(masterGain);

    const oscs = [fundOsc, warmOsc, octOsc, fifthOsc];
    const nodes: AudioNode[] = [
      filter,
      layerGain,
      lfoDepth,
      fundGain,
      warmGain,
      octGain,
      fifthGain,
    ];

    const cleanup = () => {
      for (const osc of oscs) {
        try {
          osc.disconnect();
        } catch {
          // Ignore
        }
      }
      try {
        lfo.disconnect();
      } catch {
        // Ignore
      }
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Ignore
        }
      }
    };

    fundOsc.onended = cleanup;
    for (const osc of oscs) {
      osc.start(now);
    }
    lfo.start(now);

    let faded = false;
    const fadeOut = (fadeSec: number) => {
      if (faded) return;
      faded = true;
      const t = ctx.currentTime;
      layerGain.gain.cancelScheduledValues(t);
      layerGain.gain.setValueAtTime(Math.max(0.0001, layerGain.gain.value), t);
      layerGain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
      const stopAt = t + fadeSec + 0.03;
      for (const osc of oscs) {
        try {
          osc.stop(stopAt);
        } catch {
          // Ignore
        }
      }
      try {
        lfo.stop(stopAt);
      } catch {
        // Ignore
      }
    };

    return { oscs, lfo, nodes, layerGain, fadeOut };
  }

  start(pitch: PitchClass, volume: number): void {
    this.currentPitch = pitch;
    this.currentVolume = volume;
    const setup = this.ensureMasterGain();
    if (!setup) return;

    const { ctx, masterGain } = setup;
    masterGain.gain.setTargetAtTime(
      this.scaledVolume(volume),
      ctx.currentTime,
      0.04,
    );

    if (this.running && this.activeLayer) {
      this.setPitch(pitch);
      return;
    }

    this.running = true;
    this.activeLayer = this.spawnLayer(ctx, masterGain, pitch, 0.55);
  }

  stop(): void {
    this.running = false;
    if (this.activeLayer) {
      this.activeLayer.fadeOut(0.45);
      this.activeLayer = null;
    }
  }

  setPitch(pitch: PitchClass): void {
    const changed = pitch !== this.currentPitch;
    this.currentPitch = pitch;
    if (!this.running || !changed) return;

    const setup = this.ensureMasterGain();
    if (!setup) return;

    const oldLayer = this.activeLayer;
    this.activeLayer = this.spawnLayer(setup.ctx, setup.masterGain, pitch, 0.35);
    if (oldLayer) {
      oldLayer.fadeOut(0.35);
    }
  }

  setVolume(volume: number): void {
    this.currentVolume = volume;
    const ctx = this.synth.getAudioContext();
    if (!ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      this.scaledVolume(volume),
      ctx.currentTime,
      0.05,
    );
  }

  dispose(): void {
    this.stop();
    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignore
      }
      this.masterGain = null;
    }
  }
}
