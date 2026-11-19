# Ears Only

Hands-free, pocket-ready chord progression ear trainer built with React, TypeScript, Vite, Tailwind CSS, and the Web Audio API.

**Live App:** https://trevritchie.github.io/ears-only/

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
