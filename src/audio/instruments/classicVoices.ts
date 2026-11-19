import type {
  BuiltVoiceNodes,
  InstrumentPresetMeta,
  VoiceBuildParams,
} from './types';

export const CLASSIC_ELECTRIC_PIANO_META: InstrumentPresetMeta = {
  id: 'electric-piano',
  label: 'Electric Piano',
  subtitle: 'Classic clean',
  defaultReleaseSec: 0.15,
  rollStepSec: 0.008,
};

export const CLASSIC_SOFT_PAD_META: InstrumentPresetMeta = {
  id: 'soft-pad',
  label: 'Soft Pad',
  subtitle: 'Classic airy',
  defaultReleaseSec: 0.26,
  rollStepSec: 0.008,
};

export function buildClassicElectricPianoVoice({
  ctx,
  now,
  t0,
  freq,
  peakGain,
  note,
  envGain,
}: VoiceBuildParams): BuiltVoiceNodes {
  const isBass = note.role === 'bass';
  const attackSec = 0.014;
  const sustainRatio = 0.56;

  const noteFilter = ctx.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.65;
  const startCutoff = isBass ? 2400 : 5200;
  const endCutoff = isBass ? 1300 : 2500;
  noteFilter.frequency.setValueAtTime(startCutoff, now);
  noteFilter.frequency.setValueAtTime(startCutoff, t0);
  noteFilter.frequency.exponentialRampToValueAtTime(endCutoff, t0 + 1.4);

  const oscs: OscillatorNode[] = [];
  const auxNodes: AudioNode[] = [noteFilter];

  const fundOsc = ctx.createOscillator();
  fundOsc.type = 'sine';
  fundOsc.frequency.setValueAtTime(freq, t0);
  const fundGain = ctx.createGain();
  fundGain.gain.value = 0.78;
  fundOsc.connect(fundGain);
  fundGain.connect(noteFilter);
  oscs.push(fundOsc);
  auxNodes.push(fundGain);

  const bodyOsc = ctx.createOscillator();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(freq, t0);
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.26;
  bodyOsc.connect(bodyGain);
  bodyGain.connect(noteFilter);
  oscs.push(bodyOsc);
  auxNodes.push(bodyGain);

  const tineOsc = ctx.createOscillator();
  tineOsc.type = 'sine';
  tineOsc.frequency.setValueAtTime(freq * 2, t0);
  const tineGain = ctx.createGain();
  const tineInit = isBass ? 0.14 : 0.28;
  tineGain.gain.setValueAtTime(tineInit, now);
  tineGain.gain.setValueAtTime(tineInit, t0);
  tineGain.gain.setTargetAtTime(isBass ? 0.04 : 0.09, t0 + attackSec, 0.25);
  tineOsc.connect(tineGain);
  tineGain.connect(noteFilter);
  oscs.push(tineOsc);
  auxNodes.push(tineGain);

  const thirdOsc = ctx.createOscillator();
  thirdOsc.type = 'sine';
  thirdOsc.frequency.setValueAtTime(freq * 3, t0);
  const thirdGain = ctx.createGain();
  const thirdInit = isBass ? 0.05 : 0.11;
  thirdGain.gain.setValueAtTime(thirdInit, now);
  thirdGain.gain.setValueAtTime(thirdInit, t0);
  thirdGain.gain.setTargetAtTime(isBass ? 0.01 : 0.025, t0 + attackSec, 0.16);
  thirdOsc.connect(thirdGain);
  thirdGain.connect(noteFilter);
  oscs.push(thirdOsc);
  auxNodes.push(thirdGain);

  if (!isBass) {
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

  noteFilter.connect(envGain);
  envGain.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
  envGain.gain.setTargetAtTime(peakGain * sustainRatio, t0 + attackSec, 0.55);

  return {
    oscs,
    bufferSources: [],
    auxNodes,
    defaultReleaseSec: CLASSIC_ELECTRIC_PIANO_META.defaultReleaseSec,
  };
}

export function buildClassicSoftPadVoice({
  ctx,
  now,
  t0,
  freq,
  peakGain,
  note,
  envGain,
}: VoiceBuildParams): BuiltVoiceNodes {
  const isBass = note.role === 'bass';
  const attackSec = 0.11;

  const noteFilter = ctx.createBiquadFilter();
  noteFilter.type = 'lowpass';
  noteFilter.Q.value = 0.65;
  const cutoff = isBass ? 1800 : 3000;
  noteFilter.frequency.setValueAtTime(cutoff, now);
  noteFilter.frequency.setValueAtTime(cutoff, t0);

  const oscs: OscillatorNode[] = [];
  const auxNodes: AudioNode[] = [noteFilter];

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

  if (!isBass) {
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

  noteFilter.connect(envGain);
  envGain.gain.linearRampToValueAtTime(peakGain * 0.85, t0 + attackSec);

  return {
    oscs,
    bufferSources: [],
    auxNodes,
    defaultReleaseSec: CLASSIC_SOFT_PAD_META.defaultReleaseSec,
  };
}
