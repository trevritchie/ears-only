import type {
  BuiltVoiceNodes,
  InstrumentPresetMeta,
  VoiceBuildParams,
} from './types';

export const VELVET_PAD_META: InstrumentPresetMeta = {
  id: 'velvet-pad',
  label: 'Velvet Pad',
  subtitle: 'Ambient swell',
  defaultReleaseSec: 0.55,
  rollStepSec: 0.0,
};

export function buildVelvetPadVoice({
  ctx,
  now,
  t0,
  freq,
  peakGain,
  note,
  envGain,
}: VoiceBuildParams): BuiltVoiceNodes {
  const isBass = note.role === 'bass';
  const attackSec = 0.18;

  // Breathing filter swell: starts warm, opens gently, then settles into velvet
  const noteFilter = ctx.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.6;
  const startCutoff = isBass ? 650 : 780;
  const bloomCutoff = isBass ? 1400 : 2200;
  const settleCutoff = isBass ? 950 : 1350;
  noteFilter.frequency.setValueAtTime(startCutoff, now);
  noteFilter.frequency.setValueAtTime(startCutoff, t0);
  noteFilter.frequency.exponentialRampToValueAtTime(bloomCutoff, t0 + 0.65);
  noteFilter.frequency.setTargetAtTime(settleCutoff, t0 + 0.65, 0.85);

  const oscs: OscillatorNode[] = [];
  const auxNodes: AudioNode[] = [noteFilter];

  // Warm chorus sawtooth layer
  const sawOsc = ctx.createOscillator();
  sawOsc.type = 'sawtooth';
  sawOsc.frequency.setValueAtTime(freq, t0);
  sawOsc.detune.setValueAtTime(-7, t0);
  const sawGain = ctx.createGain();
  sawGain.gain.value = isBass ? 0.18 : 0.22;
  sawOsc.connect(sawGain);
  sawGain.connect(noteFilter);
  oscs.push(sawOsc);
  auxNodes.push(sawGain);

  // Center triangle core
  const triOsc = ctx.createOscillator();
  triOsc.type = 'triangle';
  triOsc.frequency.setValueAtTime(freq, t0);
  const triGain = ctx.createGain();
  triGain.gain.value = 0.48;
  triOsc.connect(triGain);
  triGain.connect(noteFilter);
  oscs.push(triOsc);
  auxNodes.push(triGain);

  // Detuned sine shimmer
  const sineOsc = ctx.createOscillator();
  sineOsc.type = 'sine';
  sineOsc.frequency.setValueAtTime(freq, t0);
  sineOsc.detune.setValueAtTime(7, t0);
  const sineGain = ctx.createGain();
  sineGain.gain.value = 0.46;
  sineOsc.connect(sineGain);
  sineGain.connect(noteFilter);
  oscs.push(sineOsc);
  auxNodes.push(sineGain);

  // Subtle airy upper octave on harmony voices
  if (!isBass) {
    const airOsc = ctx.createOscillator();
    airOsc.type = 'sine';
    airOsc.frequency.setValueAtTime(freq * 2, t0);
    const airGain = ctx.createGain();
    airGain.gain.value = 0.09;
    airOsc.connect(airGain);
    airGain.connect(noteFilter);
    oscs.push(airOsc);
    auxNodes.push(airGain);
  }

  noteFilter.connect(envGain);

  envGain.gain.linearRampToValueAtTime(peakGain * 0.84, t0 + attackSec);

  return {
    oscs,
    bufferSources: [],
    auxNodes,
    defaultReleaseSec: VELVET_PAD_META.defaultReleaseSec,
  };
}
