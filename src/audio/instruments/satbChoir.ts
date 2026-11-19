import type {
  BuiltVoiceNodes,
  InstrumentPresetMeta,
  VoiceBuildParams,
} from './types';

export const SATB_CHOIR_META: InstrumentPresetMeta = {
  id: 'satb-choir',
  label: 'SATB Choir',
  subtitle: 'Vocal harmony',
  defaultReleaseSec: 0.58,
  rollStepSec: 0.0,
};

interface SectionFormants {
  f1: number;
  f2: number;
  f3: number;
  g1: number;
  g2: number;
  g3: number;
  fundMix: number;
  detuneCents: number;
}

// Warm meditative "Ooh / Oh" vocal-tract formants tuned per choral section
const SECTION_FORMANTS: readonly SectionFormants[] = [
  // 0: Bass: deep, round warm "Oh/Ooh"
  { f1: 360, f2: 760, f3: 2300, g1: 0.62, g2: 0.34, g3: 0.06, fundMix: 0.42, detuneCents: 1.6 },
  // 1: Tenor: warm resonant "Oh"
  { f1: 420, f2: 880, f3: 2500, g1: 0.6, g2: 0.36, g3: 0.07, fundMix: 0.36, detuneCents: 2.0 },
  // 2: Alto: rich mellow "Ooh/Oh"
  { f1: 465, f2: 960, f3: 2680, g1: 0.58, g2: 0.36, g3: 0.07, fundMix: 0.34, detuneCents: 2.0 },
  // 3: Soprano: luminous soft "Ooh/Ah"
  { f1: 520, f2: 1080, f3: 2850, g1: 0.56, g2: 0.38, g3: 0.08, fundMix: 0.32, detuneCents: 2.2 },
];

function getSectionFormants(voiceIndex: number, isBass: boolean): SectionFormants {
  if (isBass) return SECTION_FORMANTS[0];
  const clamped = Math.max(1, Math.min(3, voiceIndex));
  return SECTION_FORMANTS[clamped];
}

export function buildSatbChoirVoice({
  ctx,
  now,
  t0,
  freq,
  peakGain,
  note,
  voiceIndex,
  envGain,
  shared,
}: VoiceBuildParams): BuiltVoiceNodes {
  const isBass = note.role === 'bass';
  const section = getSectionFormants(voiceIndex, isBass);
  const attackSec = 0.22;

  const oscs: OscillatorNode[] = [];
  const bufferSources: AudioBufferSourceNode[] = [];
  const auxNodes: AudioNode[] = [];

  // Shared glottal source bus feeding the parallel vocal-tract formants
  const sourceBus = ctx.createGain();
  sourceBus.gain.value = 1.0;
  auxNodes.push(sourceBus);

  // Two tightly detuned singers per section for serene ensemble blend without pitch warble
  for (const detune of [-section.detuneCents, section.detuneCents]) {
    const singerOsc = ctx.createOscillator();
    if (shared.choirPeriodicWave) {
      singerOsc.setPeriodicWave(shared.choirPeriodicWave);
    } else {
      singerOsc.type = 'triangle';
    }
    singerOsc.frequency.setValueAtTime(freq, t0);
    singerOsc.detune.setValueAtTime(detune, t0);

    const singerGain = ctx.createGain();
    singerGain.gain.value = 0.46;
    singerOsc.connect(singerGain);
    singerGain.connect(sourceBus);

    oscs.push(singerOsc);
    auxNodes.push(singerGain);
  }

  // Parallel 3-formant vocal-tract filter bank (F1, F2, F3)
  const formantDefs: readonly [number, number, number][] = [
    [section.f1, 3.6, section.g1],
    [section.f2, 4.8, section.g2],
    [section.f3, 6.2, section.g3],
  ];

  // Warm summing stage with gentle top-end polish
  const voiceOutFilter = ctx.createBiquadFilter();
  voiceOutFilter.type = 'lowpass';
  voiceOutFilter.frequency.setValueAtTime(isBass ? 1800 : 3200, now);
  voiceOutFilter.Q.value = 0.55;
  auxNodes.push(voiceOutFilter);

  for (const [fHz, qVal, level] of formantDefs) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fHz, now);
    bp.Q.value = qVal;

    const fGain = ctx.createGain();
    fGain.gain.value = level * 1.45;

    sourceBus.connect(bp);
    bp.connect(fGain);
    fGain.connect(voiceOutFilter);
    auxNodes.push(bp, fGain);
  }

  // Warm fundamental anchor so pitch center is unmistakably clear in all keys
  const fundOsc = ctx.createOscillator();
  fundOsc.type = 'sine';
  fundOsc.frequency.setValueAtTime(freq, t0);
  const fundGain = ctx.createGain();
  fundGain.gain.value = section.fundMix;
  fundOsc.connect(fundGain);
  fundGain.connect(voiceOutFilter);
  oscs.push(fundOsc);
  auxNodes.push(fundGain);

  // Whisper-soft vocal breath onset (subtle air bloom)
  const breathSrc = ctx.createBufferSource();
  breathSrc.buffer = shared.noiseBurstBuffer;
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.setValueAtTime(section.f2 * 1.35, now);
  breathFilter.Q.value = 2.0;
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0, now);
  breathGain.gain.setValueAtTime(0, t0);
  breathGain.gain.linearRampToValueAtTime(isBass ? 0.012 : 0.018, t0 + 0.018);
  breathGain.gain.exponentialRampToValueAtTime(0.0003, t0 + 0.048);
  breathSrc.connect(breathFilter);
  breathFilter.connect(breathGain);
  breathGain.connect(voiceOutFilter);
  bufferSources.push(breathSrc);
  auxNodes.push(breathFilter, breathGain);

  voiceOutFilter.connect(envGain);

  envGain.gain.linearRampToValueAtTime(peakGain * 0.9, t0 + attackSec);

  return {
    oscs,
    bufferSources,
    auxNodes,
    defaultReleaseSec: SATB_CHOIR_META.defaultReleaseSec,
  };
}
