import type { TimbreId } from '../../types/settings';
import { isAcousticSampleTimbre } from '../sampleBank';
import { buildFeltPianoVoice, FELT_PIANO_META } from './feltPiano';
import {
  buildConcertHarpVoice,
  buildGrandPianoVoice,
  buildNylonGuitarVoice,
  buildPipeOrganVoice,
  buildWarmStringsVoice,
  CONCERT_HARP_META,
  GRAND_PIANO_META,
  NYLON_GUITAR_META,
  PIPE_ORGAN_META,
  WARM_STRINGS_META,
} from './sampledVoices';
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
  GRAND_PIANO_META,
  WARM_STRINGS_META,
  SATB_CHOIR_META,
  CONCERT_HARP_META,
  NYLON_GUITAR_META,
  PIPE_ORGAN_META,
  FELT_PIANO_META,
  WARM_RHODES_META,
  SOFT_VIBES_META,
];

const META_BY_ID: Record<TimbreId, InstrumentPresetMeta> = {
  'velvet-pad': VELVET_PAD_META,
  'grand-piano': GRAND_PIANO_META,
  'warm-strings': WARM_STRINGS_META,
  'satb-choir': SATB_CHOIR_META,
  'concert-harp': CONCERT_HARP_META,
  'nylon-guitar': NYLON_GUITAR_META,
  'pipe-organ': PIPE_ORGAN_META,
  'felt-piano': FELT_PIANO_META,
  'warm-rhodes': WARM_RHODES_META,
  'soft-vibes': SOFT_VIBES_META,
};

const BUILDER_BY_ID: Record<TimbreId, InstrumentVoiceBuilder> = {
  'velvet-pad': buildVelvetPadVoice,
  'grand-piano': buildGrandPianoVoice,
  'warm-strings': buildWarmStringsVoice,
  'satb-choir': buildSatbChoirVoice,
  'concert-harp': buildConcertHarpVoice,
  'nylon-guitar': buildNylonGuitarVoice,
  'pipe-organ': buildPipeOrganVoice,
  'felt-piano': buildFeltPianoVoice,
  'warm-rhodes': buildWarmRhodesVoice,
  'soft-vibes': buildSoftVibesVoice,
};

export function isSampledTimbre(id: TimbreId): boolean {
  return id === 'satb-choir' || isAcousticSampleTimbre(id);
}

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
