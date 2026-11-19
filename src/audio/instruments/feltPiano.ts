import type {
  BuiltVoiceNodes,
  InstrumentPresetMeta,
  VoiceBuildParams,
} from './types';

export const FELT_PIANO_META: InstrumentPresetMeta = {
  id: 'felt-piano',
  label: 'Felt Piano',
  subtitle: 'Soft & intimate',
  defaultReleaseSec: 0.3,
  rollStepSec: 0.011,
};

export function buildFeltPianoVoice({
  ctx,
  now,
  t0,
  freq,
  peakGain,
  note,
  envGain,
  shared,
}: VoiceBuildParams): BuiltVoiceNodes {
  const isBass = note.role === 'bass';
  const attackSec = 0.016;
  const highSoften = Math.max(0.75, 1 - Math.max(0, note.midi - 66) * 0.025);

  const noteFilter = ctx.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.6;
  const startCutoff = isBass ? 2200 : 3600 * highSoften;
  const endCutoff = isBass ? 1050 : 1650 * highSoften;
  noteFilter.frequency.setValueAtTime(startCutoff, now);
  noteFilter.frequency.setValueAtTime(startCutoff, t0);
  noteFilter.frequency.exponentialRampToValueAtTime(endCutoff, t0 + 1.4);

  const oscs: OscillatorNode[] = [];
  const bufferSources: AudioBufferSourceNode[] = [];
  const auxNodes: AudioNode[] = [noteFilter];

  // Primary felt piano harmonic body
  const mainOsc = ctx.createOscillator();
  if (shared.feltPeriodicWave) {
    mainOsc.setPeriodicWave(shared.feltPeriodicWave);
  } else {
    mainOsc.type = 'triangle';
  }
  mainOsc.frequency.setValueAtTime(freq, t0);
  const mainGain = ctx.createGain();
  mainGain.gain.value = 0.72;
  mainOsc.connect(mainGain);
  mainGain.connect(noteFilter);
  oscs.push(mainOsc);
  auxNodes.push(mainGain);

  // Gently detuned unison string for acoustic piano warmth
  const unisonOsc = ctx.createOscillator();
  unisonOsc.type = 'sine';
  unisonOsc.frequency.setValueAtTime(freq, t0);
  unisonOsc.detune.setValueAtTime(1.8, t0);
  const unisonGain = ctx.createGain();
  unisonGain.gain.value = 0.34;
  unisonOsc.connect(unisonGain);
  unisonGain.connect(noteFilter);
  oscs.push(unisonOsc);
  auxNodes.push(unisonGain);

  // Soft felt hammer-on-string transient
  const hammerSrc = ctx.createBufferSource();
  hammerSrc.buffer = shared.noiseBurstBuffer;
  const hammerFilter = ctx.createBiquadFilter();
  hammerFilter.type = 'bandpass';
  const hammerCenter = Math.max(360, Math.min(920, freq * 1.35));
  hammerFilter.frequency.setValueAtTime(hammerCenter, now);
  hammerFilter.Q.value = 1.6;
  const hammerGain = ctx.createGain();
  hammerGain.gain.setValueAtTime(0, now);
  hammerGain.gain.setValueAtTime(0, t0);
  hammerGain.gain.linearRampToValueAtTime(isBass ? 0.06 : 0.09, t0 + 0.005);
  hammerGain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.036);
  hammerSrc.connect(hammerFilter);
  hammerFilter.connect(hammerGain);
  hammerGain.connect(noteFilter);
  bufferSources.push(hammerSrc);
  auxNodes.push(hammerFilter, hammerGain);

  noteFilter.connect(envGain);

  envGain.gain.linearRampToValueAtTime(peakGain * 1.04, t0 + attackSec);
  envGain.gain.setTargetAtTime(peakGain * 0.48, t0 + attackSec, 0.72);

  return {
    oscs,
    bufferSources,
    auxNodes,
    defaultReleaseSec: FELT_PIANO_META.defaultReleaseSec,
  };
}
