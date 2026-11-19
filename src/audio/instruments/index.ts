import type { TimbreId } from '../../types/settings';
import { buildFeltPianoVoice, FELT_PIANO_META } from './feltPiano';
import { buildSatbChoirVoice, SATB_CHOIR_META } from './satbChoir';
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
  VELVET_PAD_META,
  FELT_PIANO_META,
  WARM_RHODES_META,
  SOFT_VIBES_META,
  SATB_CHOIR_META,
];

const META_BY_ID: Record<TimbreId, InstrumentPresetMeta> = {
  'felt-piano': FELT_PIANO_META,
  'warm-rhodes': WARM_RHODES_META,
  'velvet-pad': VELVET_PAD_META,
  'soft-vibes': SOFT_VIBES_META,
  'satb-choir': SATB_CHOIR_META,
};

const BUILDER_BY_ID: Record<TimbreId, InstrumentVoiceBuilder> = {
  'felt-piano': buildFeltPianoVoice,
  'warm-rhodes': buildWarmRhodesVoice,
  'velvet-pad': buildVelvetPadVoice,
  'soft-vibes': buildSoftVibesVoice,
  'satb-choir': buildSatbChoirVoice,
};

export function getInstrumentPreset(id: TimbreId): InstrumentPresetMeta {
  return META_BY_ID[id] ?? VELVET_PAD_META;
}

export function buildInstrumentVoice(
  id: TimbreId,
  params: VoiceBuildParams,
): BuiltVoiceNodes {
  const builder = BUILDER_BY_ID[id] ?? buildVelvetPadVoice;
  return builder(params);
}
