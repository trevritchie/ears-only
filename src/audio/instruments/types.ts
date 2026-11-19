import type { NoteRole, ScheduledNote } from '../../music/arrangement';
import type { TimbreId } from '../../types/settings';
import type { ChoirSampleBank } from '../choirSamples';
import type { AcousticSampleBank } from '../sampleBank';

export interface InstrumentPresetMeta {
  id: TimbreId;
  label: string;
  subtitle: string;
  defaultReleaseSec: number;
  rollStepSec: number;
}

export interface VoiceSharedResources {
  feltPeriodicWave: PeriodicWave | null;
  choirPeriodicWave: PeriodicWave | null;
  noiseBurstBuffer: AudioBuffer;
  warmTubeCurve: Float32Array<ArrayBuffer>;
}

export interface VoiceBuildParams {
  ctx: AudioContext;
  now: number;
  t0: number;
  freq: number;
  peakGain: number;
  note: ScheduledNote;
  voiceIndex: number;
  envGain: GainNode;
  shared: VoiceSharedResources;
  choirBank?: ChoirSampleBank;
  sampleBank?: AcousticSampleBank;
}

export interface BuiltVoiceNodes {
  oscs: OscillatorNode[];
  bufferSources: AudioBufferSourceNode[];
  auxNodes: AudioNode[];
  defaultReleaseSec: number;
}

export type InstrumentVoiceBuilder = (
  params: VoiceBuildParams,
) => BuiltVoiceNodes;

export function createVoiceSharedResources(
  ctx: AudioContext,
): VoiceSharedResources {
  // Warm upright felt piano harmonic partials + glottal choir harmonic rolloff
  let feltPeriodicWave: PeriodicWave | null = null;
  let choirPeriodicWave: PeriodicWave | null = null;
  if (typeof ctx.createPeriodicWave === 'function') {
    const real = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const imag = new Float32Array([0, 1.0, 0.42, 0.22, 0.1, 0.045, 0.02, 0.008]);
    feltPeriodicWave = ctx.createPeriodicWave(real, imag, {
      disableNormalization: false,
    });

    const choirReal = new Float32Array(12);
    const choirImag = new Float32Array([
      0, 1.0, 0.62, 0.38, 0.24, 0.16, 0.11, 0.075, 0.05, 0.032, 0.02, 0.012,
    ]);
    choirPeriodicWave = ctx.createPeriodicWave(choirReal, choirImag, {
      disableNormalization: false,
    });
  }

  // Reusable 50ms smooth white-noise buffer for organic felt/mallet transients
  const burstSamples = Math.max(1, Math.floor(ctx.sampleRate * 0.05));
  const noiseBurstBuffer = ctx.createBuffer(1, burstSamples, ctx.sampleRate);
  const burstData = noiseBurstBuffer.getChannelData(0);
  for (let i = 0; i < burstSamples; i++) {
    const window = Math.sin((Math.PI * i) / (burstSamples - 1));
    burstData[i] = (Math.random() * 2 - 1) * window;
  }

  // Subtle warm saturation curve for vintage Rhodes
  const curveLen = 512;
  const warmTubeCurve = new Float32Array(new ArrayBuffer(curveLen * 4));
  const norm = Math.tanh(1.35);
  for (let i = 0; i < curveLen; i++) {
    const x = (i * 2) / (curveLen - 1) - 1;
    warmTubeCurve[i] = Math.tanh(1.35 * x) / norm;
  }

  return {
    feltPeriodicWave,
    choirPeriodicWave,
    noiseBurstBuffer,
    warmTubeCurve,
  };
}

/**
 * Anchors bass near center and spreads upper voices softly across the stereo
 * field to reduce mono "in-head" headphone fatigue while staying mono-safe.
 */
export function computeVoicePan(
  noteIndex: number,
  totalNotes: number,
  role: NoteRole,
): number {
  if (role === 'bass') {
    return -0.04;
  }
  const upperCount = Math.max(1, totalNotes - 1);
  const upperIdx = Math.max(0, noteIndex - 1);
  if (upperCount === 3) {
    const spread = [-0.26, 0.04, 0.26];
    return spread[upperIdx] ?? 0;
  }
  if (upperCount === 1) return 0;
  return -0.26 + (upperIdx / (upperCount - 1)) * 0.52;
}
