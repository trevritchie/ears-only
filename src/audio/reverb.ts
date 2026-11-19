import type { AmbienceMode } from '../types/settings';

export interface AmbienceConfig {
  id: AmbienceMode;
  label: string;
  dryGain: number;
  wetGain: number;
  durationSec: number;
  preDelaySec: number;
  damping: number;
  decayPower: number;
  level: number;
}

export const AMBIENCE_CONFIGS: Record<AmbienceMode, AmbienceConfig> = {
  dry: {
    id: 'dry',
    label: 'Dry',
    dryGain: 1.0,
    wetGain: 0.0,
    durationSec: 0,
    preDelaySec: 0,
    damping: 0,
    decayPower: 1,
    level: 0,
  },
  'warm-room': {
    id: 'warm-room',
    label: 'Warm Room',
    dryGain: 0.9,
    wetGain: 0.16,
    durationSec: 0.95,
    preDelaySec: 0.012,
    damping: 0.52,
    decayPower: 3.0,
    level: 0.36,
  },
  'lush-hall': {
    id: 'lush-hall',
    label: 'Lush Hall',
    dryGain: 0.84,
    wetGain: 0.28,
    durationSec: 1.85,
    preDelaySec: 0.024,
    damping: 0.62,
    decayPower: 2.6,
    level: 0.34,
  },
};

export const AMBIENCE_OPTIONS: readonly AmbienceConfig[] = [
  AMBIENCE_CONFIGS.dry,
  AMBIENCE_CONFIGS['warm-room'],
  AMBIENCE_CONFIGS['lush-hall'],
];

/**
 * Generates a stereo-decorrelated, pre-delayed, progressively damped room/hall
 * impulse response so chords stay clear on onset while blooming warmly behind.
 */
export function createAmbienceImpulseResponse(
  ctx: BaseAudioContext,
  mode: Exclude<AmbienceMode, 'dry'>,
): AudioBuffer {
  const cfg = AMBIENCE_CONFIGS[mode];
  const sampleRate = ctx.sampleRate;
  const preDelaySamples = Math.floor(cfg.preDelaySec * sampleRate);
  const tailSamples = Math.max(1, Math.floor(cfg.durationSec * sampleRate));
  const totalSamples = preDelaySamples + tailSamples;
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = buffer.getChannelData(ch);
    // Pre-delay window stays strictly silent for crisp harmonic clarity.
    for (let i = 0; i < preDelaySamples; i++) {
      channelData[i] = 0;
    }

    let prev = 0;
    const attackSamples = Math.min(tailSamples, Math.floor(0.014 * sampleRate));
    for (let i = 0; i < tailSamples; i++) {
      const progress = i / tailSamples;
      const envelope = Math.pow(1 - progress, cfg.decayPower);
      const attackFade =
        i < attackSamples ? i / Math.max(1, attackSamples) : 1.0;
      const white = Math.random() * 2 - 1;
      // Progressive HF damping: tail warms smoothly as it decays.
      const damp = Math.min(0.86, cfg.damping + progress * 0.24);
      const filtered = prev * damp + white * (1 - damp);
      prev = filtered;
      channelData[preDelaySamples + i] =
        filtered * envelope * attackFade * cfg.level;
    }
  }

  return buffer;
}
