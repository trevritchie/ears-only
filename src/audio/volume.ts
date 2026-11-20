/**
 * Maps a normalized 0..1 UI volume slider onto a perceptual audio taper curve
 * so middle slider positions (50%–75%) offer smooth, fine-grained dB control.
 */
export function perceptualTaper(slider: number, exponent = 1.8): number {
  const clamped = Math.max(0, Math.min(1, slider));
  if (clamped === 0) return 0;
  return Math.pow(clamped, exponent);
}

/** Chords bus gain: 75% -> ~0.98 (balanced default), 100% -> 1.65 (+4.3 dB headroom). */
export function chordSliderToGain(slider: number): number {
  return perceptualTaper(slider, 1.8) * 1.65;
}

/** Melody bus gain: matches chordSliderToGain headroom so 75% -> ~0.98. */
export function melodySliderToGain(slider: number): number {
  return perceptualTaper(slider, 1.8) * 1.65;
}

/** Voice bus gain: 65% -> ~0.24 (calm meditation balance), 100% -> 0.52 (+6.7 dB headroom). */
export function voiceSliderToGain(slider: number): number {
  return perceptualTaper(slider, 1.8) * 0.52;
}

/** Drone bus gain: 50% -> ~0.08 (gentle halo default), 100% -> 0.28. */
export function droneSliderToGain(slider: number): number {
  return perceptualTaper(slider, 1.8) * 0.28;
}

/** Browser SpeechSynthesisUtterance volume (0..1) with gentle perceptual taper. */
export function speechSliderToVolume(slider: number): number {
  return perceptualTaper(slider, 1.4);
}
