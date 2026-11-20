# Paws Off

Hands-free, pocket-ready chord progression ear trainer built with React, TypeScript, Vite, Tailwind CSS, and the Web Audio API.

**Live App:** https://trevritchie.github.io/paws-off/

## Features (v1)

- **Major Scale Harmony:** All 14 diatonic chords across 12 major keys — Triads (`I`, `ii`, `iii`, `IV`, `V`, `vi`, `vii°`) and Seventh Chords (`Imaj7`, `ii7`, `iii7`, `IVmaj7`, `V7`, `vi7`, `viiø7`), with quick-select presets.
- **Voice-Led Web Audio Synthesis:** Warm Electric Piano (default) and Soft Pad timbres with root-bass + Viterbi DP-smoothed upper voices, soft room reverb, ducking during speech, and an optional Chromatic Drone.
- **Drift-Free Hands-Free Loop:** Web Worker lookahead scheduler (`AudioContext.currentTime`) running orientation (`"Key of X"` + `I–IV–V–I` cadence), question repeats, hybrid tempo-grid / speech-priority Answer Reveal (`"Seven half diminished"` or `"Seven minor seven flat five"`), optional post-answer replay, and automatic key rotation.
- **Pocket-Ready Mobile Support:** Silent PCM WAV keep-alive, `navigator.mediaSession` lock-screen metadata & headphone transport controls, Screen Wake Lock, and PWA Home Screen installability.

## Development

```bash
npm install
npm run dev      # Start local dev server
npm test         # Run Vitest unit & UI suites
npm run build    # Type-check and build production bundle
```

See [ROADMAP.md](./ROADMAP.md) for post-v1 plans (variable rhythms, inversions, drum grooves, top-line melodies, and pre-rendered voice clips).

## Audio Assets & Mastering

Spoken announcements (`public/voice/`), SATB choir multi-samples (`public/choir/`), and acoustic instrument multi-samples (`public/samples/`) are built and verified with reproducible scripts documented in [docs/AUDIO_PIPELINE.md](./docs/AUDIO_PIPELINE.md):

```bash
python3 scripts/generate_voice_clips.py --verify   # Verify all 49 TTS voice MP3s
python3 scripts/process_samples.py --verify        # Verify all 123 choir + instrument MP3s

# Regenerate or add voice clips via Microsoft Edge AvaNeural TTS + broadcast mastering
uvx --from edge-tts python scripts/generate_voice_clips.py --only bass-3 bass-5 bass-7
```

## Credits

- **Grand Piano** samples derived from Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0).
- **Concert Harp** samples derived from VSCO 2 Community Edition (Versilian Studios, CC0 1.0 Public Domain).
- **Chamber Cello**, **French Horn**, **Nylon Guitar**, **Clean Guitar**, and **Harmonium** samples derived from `tonejs-instruments` (CC-BY 3.0).
- **SATB Choir** (`voice_oohs`, `choir_aahs`), **Warm Strings** (`string_ensemble_1`), and **Pipe Organ** (`church_organ`) multi-samples derived from FluidR3_GM (Frank Wen / midi-js-soundfonts, CC-BY 3.0).
