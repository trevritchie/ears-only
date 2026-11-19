import { describe, expect, it, vi } from 'vitest';
import type { DroneEngine } from '../../audio/drone';
import type { ChordVoiceHandle, SynthEngine } from '../../audio/synth';
import type { ScheduledNote } from '../../music/arrangement';
import {
  DEFAULT_SETTINGS,
  type AmbienceMode,
  type DroneOctave,
  type PitchClass,
  type SessionSettings,
  type TimbreId,
} from '../../types/settings';
import type { PocketController, PocketHandlers } from '../pocketManager';
import {
  SessionController,
  type SessionSnapshot,
} from '../sessionController';
import type { SpeakOptions, VoiceAnnouncer } from '../speech';
import type { SchedulerClock } from '../workerTimer';

interface RecordedChord {
  notes: readonly ScheduledNote[];
  startTime: number;
  timbre: TimbreId;
  releasedAt: number | null;
  duckedWhenStarted: boolean;
}

class FakeSynth implements SynthEngine {
  currentTime = 0;
  ducked = false;
  chordVolume = 0.75;
  voiceVolume = 0.65;
  ambience: AmbienceMode = 'warm-room';
  chords: RecordedChord[] = [];
  releaseAllCount = 0;
  private stateListeners = new Set<(s: string) => void>();

  async ensureContext(): Promise<void> {}

  getCurrentTime(): number {
    return this.currentTime;
  }

  getContextState(): string {
    return 'running';
  }

  playChord(
    notes: readonly ScheduledNote[],
    startTime: number,
    timbre: TimbreId,
  ): ChordVoiceHandle {
    const entry: RecordedChord = {
      notes,
      startTime,
      timbre,
      releasedAt: null,
      duckedWhenStarted: this.ducked,
    };
    this.chords.push(entry);
    return {
      release: (atTime: number) => {
        if (entry.releasedAt === null) {
          entry.releasedAt = atTime;
        }
      },
    };
  }

  releaseAll(): void {
    this.releaseAllCount++;
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
  }

  setChordVolume(volume: number): void {
    this.chordVolume = volume;
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = volume;
  }

  setAmbience(mode: AmbienceMode): void {
    this.ambience = mode;
  }

  onStateChange(cb: (state: string) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  dispose(): void {}
}

class FakeDrone implements DroneEngine {
  active = false;
  pitch: PitchClass = 0;
  octave: DroneOctave = 0;
  volume = 0;
  pitchHistory: PitchClass[] = [];

  start(pitch: PitchClass, volume: number, octave: DroneOctave = 0): void {
    this.active = true;
    this.pitch = pitch;
    this.octave = octave;
    this.volume = volume;
    this.pitchHistory.push(pitch);
  }

  stop(): void {
    this.active = false;
  }

  setPitch(pitch: PitchClass, octave: DroneOctave = this.octave): void {
    this.pitch = pitch;
    this.octave = octave;
    this.pitchHistory.push(pitch);
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  dispose(): void {}
}

interface PendingSpeech {
  text: string;
  options: SpeakOptions;
  cancelled: boolean;
  finished: boolean;
}

class FakeAnnouncer implements VoiceAnnouncer {
  available = true;
  unlockCalls = 0;
  cancelCalls = 0;
  spoken: PendingSpeech[] = [];
  customEstimateSec: number | null = null;

  isAvailable(): boolean {
    return this.available;
  }

  unlock(): void {
    this.unlockCalls++;
  }

  getVoices() {
    return [];
  }

  onVoicesChanged(): () => void {
    return () => {};
  }

  estimateDurationSec(syllables: number, rate: number): number {
    if (this.customEstimateSec !== null) return this.customEstimateSec;
    return (0.24 + syllables * 0.19) / rate;
  }

  speak(text: string, options: SpeakOptions): void {
    this.spoken.push({
      text,
      options,
      cancelled: false,
      finished: false,
    });
  }

  finishLatest(): PendingSpeech | undefined {
    const latest = this.spoken[this.spoken.length - 1];
    if (latest && !latest.finished) {
      latest.finished = true;
      latest.options.onStart?.();
      latest.options.onEnd?.();
    }
    return latest;
  }

  cancel(): void {
    this.cancelCalls++;
    const latest = this.spoken[this.spoken.length - 1];
    if (latest && !latest.finished) {
      latest.cancelled = true;
    }
  }

  dispose(): void {}
}

class FakeClock implements SchedulerClock {
  running = false;
  private onTick: (() => void) | null = null;

  start(onTick: () => void): void {
    this.running = true;
    this.onTick = onTick;
  }

  stop(): void {
    this.running = false;
    this.onTick = null;
  }

  tick(): void {
    if (this.running) {
      this.onTick?.();
    }
  }

  dispose(): void {
    this.stop();
  }
}

class FakePocket implements PocketController {
  active = false;
  handlers: PocketHandlers | null = null;
  recoverCalls = 0;
  metadataTitles: string[] = [];

  activate(handlers: PocketHandlers): void {
    this.active = true;
    this.handlers = handlers;
  }

  deactivate(): void {
    this.active = false;
  }

  updateMetadata(metadata: { title: string }): void {
    this.metadataTitles.push(metadata.title);
  }

  recoverAudioSession(): void {
    this.recoverCalls++;
  }

  isWakeLockActive(): boolean {
    return this.active;
  }

  onWakeLockChange(): () => void {
    return () => {};
  }

  dispose(): void {}
}

function advanceAndTick(
  synth: FakeSynth,
  clock: FakeClock,
  totalSec: number,
  stepSec = 0.05,
): void {
  const steps = Math.ceil(totalSec / stepSec);
  for (let i = 0; i < steps; i++) {
    synth.currentTime += stepSec;
    clock.tick();
  }
}

function createHarness(
  overrides: Partial<SessionSettings> = {},
  rngSeq?: number[],
) {
  let rngIdx = 0;
  const rng = rngSeq
    ? () => {
        const val = rngSeq[rngIdx % rngSeq.length];
        rngIdx++;
        return val;
      }
    : () => 0.2;

  const settings: SessionSettings = {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
  const synth = new FakeSynth();
  const drone = new FakeDrone();
  const announcer = new FakeAnnouncer();
  const clock = new FakeClock();
  const pocket = new FakePocket();

  const controller = new SessionController(settings, {
    synth,
    drone,
    announcer,
    clock,
    pocket,
    rng,
  });

  const snapshots: SessionSnapshot[] = [];
  controller.subscribe((s) => snapshots.push(s));

  return { controller, synth, drone, announcer, clock, pocket, snapshots };
}

describe('SessionController state machine & scheduler', () => {
  it('runs the complete hands-free loop: orientation -> N repeats -> answer reveal -> auto-advance', () => {
    const { controller, synth, announcer, clock, pocket } = createHarness({
      allowedChords: ['I', 'IV', 'V', 'vi'],
      bpm: 80, // 1.5s per chord
      progressionLength: 2,
      questionRepeats: 2,
      repeatPauseSec: 1.0,
      keyMode: 'fixed',
      fixedKey: 0,
      keyOrientation: 'cadence',
    });

    controller.start();
    expect(announcer.unlockCalls).toBe(1);
    expect(pocket.active).toBe(true);
    expect(controller.getSnapshot().phase).toBe('orienting_voice');
    expect(announcer.spoken[0].text).toBe('Key of C');

    // Finish orientation speech
    announcer.finishLatest();
    advanceAndTick(synth, clock, 0.25);
    expect(controller.getSnapshot().phase).toBe('orienting_cadence');

    // Finish I-IV-V-I cadence (4 chords: 3 * 0.75 + 1.125 = 3.375s)
    advanceAndTick(synth, clock, 3.6);
    expect(controller.getSnapshot().phase).toBe('inter_phase_pause');

    // Finish inter-phase pause -> Pass 1
    advanceAndTick(synth, clock, 0.8);
    expect(controller.getSnapshot().phase).toBe('question_playing');
    expect(controller.getSnapshot().currentPass).toBe(1);
    expect(controller.getSnapshot().revealedCount).toBe(0);

    // Finish Pass 1 (2 chords * 1.5s = 3.0s)
    advanceAndTick(synth, clock, 3.2);
    expect(controller.getSnapshot().phase).toBe('repeat_pause');

    // Finish repeat pause (1.0s) -> Pass 2
    advanceAndTick(synth, clock, 1.1);
    expect(controller.getSnapshot().phase).toBe('question_playing');
    expect(controller.getSnapshot().currentPass).toBe(2);

    // Finish Pass 2 -> pre_answer_pause -> answer_revealing
    advanceAndTick(synth, clock, 3.8);
    expect(controller.getSnapshot().phase).toBe('answer_revealing');
    expect(synth.ducked).toBe(true);
    expect(controller.getSnapshot().revealedCount).toBe(1);

    // Finish 1st answer chord speech & grid wait
    announcer.finishLatest();
    advanceAndTick(synth, clock, 1.6);
    expect(controller.getSnapshot().revealedCount).toBe(2);

    // Finish 2nd answer chord speech & grid wait
    announcer.finishLatest();
    advanceAndTick(synth, clock, 1.6);
    expect(controller.getSnapshot().phase).toBe('next_question_pause');
    expect(synth.ducked).toBe(false);

    // Auto-advance to Question 2 directly (no orientation on fixed key)
    advanceAndTick(synth, clock, 1.2);
    expect(controller.getSnapshot().questionNumber).toBe(2);
    expect(controller.getSnapshot().phase).toBe('question_playing');
    expect(controller.getSnapshot().revealedCount).toBe(0);
  });

  it('locks Answer Reveal to the tempo grid when speech finishes early', () => {
    const { controller, synth, announcer, clock } = createHarness({
      allowedChords: ['I', 'IV'],
      bpm: 80, // 1.5s slot
      progressionLength: 2,
      questionRepeats: 1,
      keyOrientation: 'none',
    });

    controller.start();
    // Skip straight to answer at t = 0
    controller.skipToAnswer();
    expect(controller.getSnapshot().phase).toBe('answer_revealing');
    expect(controller.getSnapshot().revealedCount).toBe(1);

    const revealChordsBefore = synth.chords.length;
    const firstRevealStart = synth.chords[revealChordsBefore - 1].startTime;

    // Speech finishes early at 0.4s (< 1.5s grid)
    synth.currentTime += 0.4;
    announcer.finishLatest();
    clock.tick();

    // Should still be on chord 1 at t = 1.4s
    synth.currentTime = firstRevealStart + 1.4;
    clock.tick();
    expect(controller.getSnapshot().revealedCount).toBe(1);

    // Advances cleanly once t >= firstRevealStart + 1.5s
    synth.currentTime = firstRevealStart + 1.55;
    clock.tick();
    expect(controller.getSnapshot().revealedCount).toBe(2);
    expect(synth.chords[revealChordsBefore - 1].releasedAt).toBeCloseTo(
      synth.currentTime + 0.04,
      2,
    );
  });

  it('extends chord sustain until long speech completes without clipping', () => {
    const { controller, synth, announcer, clock } = createHarness({
      allowedChords: ['viihalfdim7'],
      bpm: 120, // 1.0s slot
      progressionLength: 2,
      questionRepeats: 1,
      keyOrientation: 'none',
      halfDimNaming: 'minor-seven-flat-five',
    });

    controller.start();
    controller.skipToAnswer();
    expect(announcer.spoken[announcer.spoken.length - 1].text).toBe(
      'Seven minor seven flat five',
    );
    expect(controller.getSnapshot().revealedCount).toBe(1);

    // Past the 1.0s musical beat, speech is still running -> must NOT advance yet
    advanceAndTick(synth, clock, 1.5);
    expect(controller.getSnapshot().revealedCount).toBe(1);
    const heldChord = synth.chords[synth.chords.length - 1];
    expect(heldChord.releasedAt).toBeNull();

    // Speech finally ends at t = 1.6s -> waits 0.12s breathing room then advances
    announcer.finishLatest();
    clock.tick();
    expect(controller.getSnapshot().revealedCount).toBe(1);

    advanceAndTick(synth, clock, 0.15);
    expect(controller.getSnapshot().revealedCount).toBe(2);
  });

  it('omits accompaniment chords in Answer Reveal when playChordsBehindAnswer is false', () => {
    const { controller, synth } = createHarness({
      allowedChords: ['I', 'V'],
      progressionLength: 2,
      questionRepeats: 1,
      keyOrientation: 'none',
      playChordsBehindAnswer: false,
    });

    controller.start();
    const countBeforeAnswer = synth.chords.length;
    controller.skipToAnswer();
    expect(synth.chords.length).toBe(countBeforeAnswer);
    expect(synth.ducked).toBe(false);
  });

  it('plays optional post-answer replay when playFinalReplayAfterAnswer is true', () => {
    const { controller, synth, announcer, clock } = createHarness({
      allowedChords: ['I', 'IV'],
      bpm: 120, // 1.0s per chord
      progressionLength: 2,
      questionRepeats: 1,
      keyOrientation: 'none',
      playFinalReplayAfterAnswer: true,
    });

    controller.start();
    controller.skipToAnswer();
    announcer.finishLatest();
    advanceAndTick(synth, clock, 1.15);
    announcer.finishLatest();
    advanceAndTick(synth, clock, 1.15);

    expect(controller.getSnapshot().phase).toBe('post_answer_pause');
    advanceAndTick(synth, clock, 0.6);
    expect(controller.getSnapshot().phase).toBe('post_answer_replay');
    expect(synth.ducked).toBe(false);
    expect(controller.getSnapshot().revealedCount).toBe(2);
  });

  it('auto-rotates key every K questions, updates scale-tone drone, and applies mix volumes', () => {
    const { controller, synth, drone, announcer, clock } = createHarness(
      {
        rotateEveryNQuestions: 2,
        keyOrientation: 'cadence',
        droneEnabled: true,
        droneScaleDegree: 5, // 5th (+7 semitones) of active key
        droneOctave: 2,
        chordVolume: 0.6,
        voiceVolume: 0.95,
      },
      [0.0, 0.2, 0.4, 0.6, 0.8],
    );

    expect(DEFAULT_SETTINGS.keyMode).toBe('auto-rotate');

    controller.start();
    const initialKey = controller.getSnapshot().activeKey;
    expect(synth.chordVolume).toBe(0.6);
    expect(synth.voiceVolume).toBe(0.95);
    expect(drone.active).toBe(true);
    expect(drone.pitch).toBe((initialKey + 7) % 12);
    expect(drone.octave).toBe(2);

    // Live mix volume and drone octave updates propagate immediately
    controller.updateSettings({
      ...DEFAULT_SETTINGS,
      rotateEveryNQuestions: 2,
      keyOrientation: 'cadence',
      droneEnabled: true,
      droneScaleDegree: 5,
      droneOctave: -1,
      chordVolume: 0.4,
      voiceVolume: 1.0,
    });
    expect(synth.chordVolume).toBe(0.4);
    expect(synth.voiceVolume).toBe(1.0);
    expect(drone.octave).toBe(-1);

    // Complete Q1 via skip-through-answer -> next
    controller.skipToAnswer();
    controller.skipToAnswer();
    expect(controller.getSnapshot().questionNumber).toBe(2);
    expect(controller.getSnapshot().activeKey).toBe(initialKey);

    // Complete Q2 -> rotates on Q3 and shifts drone to 5th of new key!
    controller.skipToAnswer();
    controller.skipToAnswer();
    const q3Snap = controller.getSnapshot();
    expect(q3Snap.questionNumber).toBe(3);
    expect(q3Snap.activeKey).not.toBe(initialKey);
    expect(q3Snap.phase).toBe('orienting_voice');
    expect(drone.pitch).toBe((q3Snap.activeKey + 7) % 12);

    // Finish orientation speech cleanly
    announcer.finishLatest();
    advanceAndTick(synth, clock, 0.2);
    expect(controller.getSnapshot().phase).toBe('orienting_cadence');
  });

  it('ignores stale speech callbacks after Replay, Skip, and Stop via epoch guard', () => {
    const { controller, announcer } = createHarness({
      allowedChords: ['I', 'IV', 'V'],
      progressionLength: 3,
      questionRepeats: 2,
      keyOrientation: 'none',
    });

    controller.start();
    controller.skipToAnswer();
    const staleSpoken = announcer.spoken[announcer.spoken.length - 1];
    expect(controller.getSnapshot().phase).toBe('answer_revealing');
    expect(controller.getSnapshot().revealedCount).toBe(1);

    // Replay resets to Pass 1 with revealedCount 0
    controller.replayQuestion();
    expect(controller.getSnapshot().phase).toBe('question_playing');
    expect(controller.getSnapshot().currentPass).toBe(1);
    expect(controller.getSnapshot().revealedCount).toBe(0);

    // Stale speech callback firing late must NOT mutate state
    staleSpoken.options.onEnd?.();
    expect(controller.getSnapshot().phase).toBe('question_playing');

    // Stop shuts down everything cleanly
    controller.stop();
    expect(controller.getSnapshot().phase).toBe('idle');
    expect(controller.getSnapshot().isRunning).toBe(false);
    expect(vi.isMockFunction(announcer.cancel)).toBe(false);
    expect(announcer.cancelCalls).toBeGreaterThanOrEqual(2);
  });

  it('auditions a warm preview chord while idle, replaces prior preview, and skips while running', () => {
    const { controller, synth } = createHarness({
      timbre: 'felt-piano',
      ambience: 'warm-room',
    });

    controller.previewSound('warm-rhodes', 'lush-hall');
    expect(synth.chords).toHaveLength(1);
    expect(synth.chords[0].timbre).toBe('warm-rhodes');
    expect(synth.ambience).toBe('lush-hall');

    // Second preview cleanly releases first preview chord
    controller.previewSound('soft-vibes', 'dry');
    expect(synth.chords).toHaveLength(2);
    expect(synth.chords[0].releasedAt).not.toBeNull();
    expect(synth.chords[1].timbre).toBe('soft-vibes');
    expect(synth.ambience).toBe('dry');

    // While running, previewSound is a no-op
    controller.start();
    const countWhileRunning = synth.chords.length;
    controller.previewSound('velvet-pad', 'warm-room');
    expect(synth.chords).toHaveLength(countWhileRunning);
  });
});
