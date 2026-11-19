# ears-only — Architecture & Post-v1 Roadmap

## v1 Architecture Boundaries

`ears-only` separates music theory, real-time synthesis, voice announcing, and session orchestration behind small interfaces so advanced musical features can be added without rewriting the lookahead scheduler or UI:

| Abstraction | File | v1 Implementation | Post-v1 Extension Point |
| :--- | :--- | :--- | :--- |
| `VoicingStrategy` | `src/music/voicing.ts` | `RootBassVoiceLedStrategy` (root in bass `[E2, G3]` + DP-smoothed 3-note upper structure) | Chord inversions / slash chords, Drop-2 voicings, open quartal voicings, spread jazz voicings |
| `ArrangementStrategy` | `src/music/arrangement.ts` | `WarmBlockArrangement` (2-beat block chords with 10ms micro-roll) | Variable harmonic rhythms, rhythmic comping patterns, arpeggiated accompaniments, bass+melody layering |
| `SynthEngine` | `src/audio/synth.ts` | `PolySynth` (Electric Piano + Soft Pad, ducking bus, room IR, compressor) | Additional timbres (acoustic piano, Rhodes tremolo, organ), dedicated drum & melody sub-buses |
| `VoiceAnnouncer` | `src/engine/speech.ts` | `WebSpeechAnnouncer` (browser TTS with gesture unlock & watchdog) | `AudioBufferAnnouncer` using bundled `.opus`/`.mp3` clips scheduled directly on `AudioContext.currentTime` |

---

## Planned Post-v1 Features

### 1. Variable Rhythms & Comping Patterns
- Implement new `ArrangementStrategy` classes returning multi-hit `ScheduledNote[]` events per chord slot (e.g., syncopated Bossa/Pop pushes, 3/4 waltz pulse, half-time & double-time harmonic changes).
- Extend `generator.ts` to pair progressions with rhythmic bar lengths (`1`, `2`, `4` beats per chord or mixed durations).

### 2. Chord Inversions & Advanced Voicings
- Extend `VoicedChord` / `VoicingStrategy` with bass degree constraints (`root`, `1st inversion`, `2nd inversion`, `3rd inversion`) and wider Drop-2 / open-position spreads.
- Add slash-chord Roman numeral notation (`I6`, `V6/4`, `V4/2`) and spoken phrasing options in `src/music/chords.ts`.

### 3. Drum Grooves & Metronome Feel
- Add a lightweight Web Audio drum synthesizer (`DrumEngine`: kick, snare/cross-stick, brushed hi-hat) driven directly by the existing `200ms` Web Worker lookahead clock and `AudioContext.currentTime`.
- Include groove presets (Dry, Simple Click, Brushed Swing, Pop Pocket) with an independent volume fader and automatic ducking during Answer Reveal.

### 4. Random Diatonic Melodies Over Progressions
- Add a melody generator constrained to chord tones on strong beats and passing/neighbor scale tones on offbeats, emitted as `role: 'melody'` events in `ArrangementStrategy` and rendered via a dedicated bell/lead voice in `PolySynth`.

### 5. Zero-Latency Pre-Rendered Voice Clips & Native Mobile Shell
- Implement `AudioBufferAnnouncer` behind `VoiceAnnouncer` with ~28 pre-recorded harmonic phrases (`"One"`, `"Six minor"`, `"Seven minor seven flat five"`, `"Key of E flat"`, etc.) scheduled sample-accurately via `AudioBufferSourceNode` — eliminating OS TTS jitter and iOS locked-screen TTS blocks.
- Optional Capacitor wrapper for App Store / Play Store background audio guarantees while reusing 100% of the TypeScript music engine, Web Audio synth, and React UI.

### 6. Expanded Harmony & Ear Training Modes
- Natural/harmonic/melodic minor scales and diatonic modes (Dorian, Mixolydian, Lydian).
- Secondary dominants (`V/V`, `V/vi`), modal interchange (`♭VII`, `iv`, `♭VI`), and custom chord-progression templates.
