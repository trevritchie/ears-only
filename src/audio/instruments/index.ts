import type { TimbreId } from '../../types/settings';
import {
  buildClassicElectricPianoVoice,
  buildClassicSoftPadVoice,
  CLASSIC_ELECTRIC_PIANO_META,
  CLASSIC_SOFT_PAD_META,
} from './classicVoices';
import { buildFeltPianoVoice, FELT_PIANO_META } from './feltPiano';
import { buildSoftVibesVoice, SOFT_VIBES_META } from './softVibes';
import type {
  BuiltVoiceNodes,
  InstrumentPresetMeta,
  InstrumentVoiceBuilder,
  VoiceBuildParams,
} from './types';
import { buildVelvetPadVoice, VELVET_PAD_META } from './velvetPad';
import { buildWarmRhodesVoice, WARM_RHODES_META } from './warmRhodes';

export const INSTRUMENT_PRESETS: readonly InstrumentPresetMeta[] = [
  FELT_PIANO_META,
  WARM_RHODES_META,
  VELVET_PAD_META,
  SOFT_VIBES_META,
  CLASSIC_ELECTRIC_PIANO_META,
  CLASSIC_SOFT_PAD_META,
];

const META_BY_ID: Record<TimbreId, InstrumentPresetMeta> = {
  'felt-piano': FELT_PIANO_META,
  'warm-rhodes': WARM_RHODES_META,
  'velvet-pad': VELVET_PAD_META,
  'soft-vibes': SOFT_VIBES_META,
  'electric-piano': CLASSIC_ELECTRIC_PIANO_META,
  'soft-pad': CLASSIC_SOFT_PAD_META,
};

const BUILDER_BY_ID: Record<TimbreId, InstrumentVoiceBuilder> = {
  'felt-piano': buildFeltPianoVoice,
  'warm-rhodes': buildWarmRhodesVoice,
  'velvet-pad': buildVelvetPadVoice,
  'soft-vibes': buildSoftVibesVoice,
  'electric-piano': buildClassicElectricPianoVoice,
  'soft-pad': buildClassicSoftPadVoice,
};

export function getInstrumentPreset(id: TimbreId): InstrumentPresetMeta {
  return META_BY_ID[id] ?? FELT_PIANO_META;
}

export function buildInstrumentVoice(
  id: TimbreId,
  params: VoiceBuildParams,
): BuiltVoiceNodes {
  const builder = BUILDER_BY_ID[id] ?? buildFeltPianoVoice;
  return builder(params);
}
