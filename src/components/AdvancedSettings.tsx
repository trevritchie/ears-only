import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { INSTRUMENT_PRESETS } from '../audio/instruments';
import { AMBIENCE_OPTIONS } from '../audio/reverb';
import type { SpeechVoiceOption } from '../engine/speech';
import {
  getMajorKeyInfo,
  getScaleDegreePitchClass,
  MAJOR_KEYS,
} from '../music/chords';
import type {
  AmbienceMode,
  PitchClass,
  ScaleDegree,
  SessionSettings,
  TimbreId,
} from '../types/settings';

const SCALE_DEGREES: readonly ScaleDegree[] = [1, 2, 3, 4, 5, 6, 7];

interface AdvancedSettingsProps {
  settings: SessionSettings;
  activeKey: PitchClass;
  isRunning: boolean;
  voices: SpeechVoiceOption[];
  onUpdate: (patch: Partial<SessionSettings>) => void;
  onPreviewSound: (timbre?: TimbreId, ambience?: AmbienceMode) => void;
}

interface SwitchRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-[#F3EFE6]">
          {label}
        </label>
        {description && (
          <p className="text-xs text-[#9CA3AE]">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
          checked
            ? 'border-[#E5A93C] bg-[#E5A93C]'
            : 'border-[#343C47] bg-[#252B33]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
            checked
              ? 'translate-x-6 bg-[#121417]'
              : 'translate-x-1 bg-[#9CA3AE]'
          }`}
        />
      </button>
    </div>
  );
}

export function AdvancedSettings({
  settings,
  activeKey,
  isRunning,
  voices,
  onUpdate,
  onPreviewSound,
}: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const droneResolvedPitch = getMajorKeyInfo(
    getScaleDegreePitchClass(activeKey, settings.droneScaleDegree),
  ).shortName;
  const showResolvedDroneNote = isRunning || settings.keyMode === 'fixed';

  return (
    <section
      aria-label="Advanced settings"
      className="mt-3 rounded-2xl border border-[#2B323B] bg-[#1B1F24]"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="advanced-settings-panel"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#F3EFE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] rounded-2xl"
      >
        <span>Advanced settings</span>
        <ChevronDown
          className={`h-4 w-4 text-[#9CA3AE] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id="advanced-settings-panel"
          className="space-y-6 border-t border-[#2B323B] px-4 pb-5 pt-4"
        >
          {/* 1. Answer & Sound */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#9CA3AE]">
              Answer &amp; sound
            </h3>

            <SwitchRow
              id="toggle-chords-behind-answer"
              label="Play chords behind answer voice"
              description="Carves a gentle midrange EQ pocket behind the narrator"
              checked={settings.playChordsBehindAnswer}
              onChange={(checked) =>
                onUpdate({ playChordsBehindAnswer: checked })
              }
            />

            <SwitchRow
              id="toggle-final-replay"
              label="Play progression one final time after answer"
              description="Adds an instrumental pass after the spoken answer"
              checked={settings.playFinalReplayAfterAnswer}
              onChange={(checked) =>
                onUpdate({ playFinalReplayAfterAnswer: checked })
              }
            />

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="block text-sm font-medium text-[#F3EFE6]">
                  Sound
                </span>
                {!isRunning && (
                  <span className="text-xs text-[#9CA3AE]">Tap to preview</span>
                )}
              </div>
              <div
                className="mt-1.5 grid grid-cols-2 gap-1.5"
                role="group"
                aria-label="Synth sound"
              >
                {INSTRUMENT_PRESETS.map((option) => {
                  const active = settings.timbre === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        onUpdate({ timbre: option.id });
                        onPreviewSound(option.id, settings.ambience);
                      }}
                      className={`flex min-h-[52px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                        active
                          ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                          : 'border-[#343C47] bg-[#252B33] text-[#F3EFE6] hover:border-[#495463]'
                      }`}
                    >
                      <span className="text-xs font-semibold leading-tight">
                        {option.label}
                      </span>
                      <span
                        className={`mt-0.5 text-[11px] leading-tight ${
                          active ? 'text-[#E5A93C]/85' : 'text-[#9CA3AE]'
                        }`}
                      >
                        {option.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-[#F3EFE6]">
                Space
              </span>
              <div
                className="mt-1.5 grid grid-cols-3 gap-1.5"
                role="group"
                aria-label="Room ambience"
              >
                {AMBIENCE_OPTIONS.map((option) => {
                  const active = settings.ambience === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        onUpdate({ ambience: option.id });
                        onPreviewSound(settings.timbre, option.id);
                      }}
                      className={`min-h-[40px] rounded-xl border px-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                        active
                          ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="chords-volume-slider"
                    className="text-sm font-medium text-[#F3EFE6]"
                  >
                    Chords volume
                  </label>
                  <span className="text-sm font-semibold text-[#E5A93C] tabular-nums">
                    {Math.round(settings.chordVolume * 100)}%
                  </span>
                </div>
                <input
                  id="chords-volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.chordVolume}
                  onChange={(e) =>
                    onUpdate({ chordVolume: Number(e.target.value) })
                  }
                  className="studio-slider mt-1"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="voice-volume-slider"
                    className="text-sm font-medium text-[#F3EFE6]"
                  >
                    Voice volume
                  </label>
                  <span className="text-sm font-semibold text-[#4FB3A4] tabular-nums">
                    {Math.round(settings.voiceVolume * 100)}%
                  </span>
                </div>
                <input
                  id="voice-volume-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.voiceVolume}
                  onChange={(e) =>
                    onUpdate({ voiceVolume: Number(e.target.value) })
                  }
                  className="studio-slider mt-1"
                />
              </div>
            </div>
          </div>

          {/* 2. Key & Modulation */}
          <div className="space-y-3 border-t border-[#2B323B] pt-4">
            <h3 className="text-xs font-semibold text-[#9CA3AE]">
              Key &amp; modulation
            </h3>

            <div
              className="grid grid-cols-2 gap-1.5"
              role="group"
              aria-label="Key mode"
            >
              {(
                [
                  { id: 'fixed', label: 'Fixed key' },
                  { id: 'auto-rotate', label: 'Auto-rotate' },
                ] as const
              ).map((option) => {
                const active = settings.keyMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onUpdate({ keyMode: option.id })}
                    className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                      active
                        ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                        : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {settings.keyMode === 'fixed' ? (
              <div>
                <span className="block text-xs font-medium text-[#9CA3AE]">
                  Major key
                </span>
                <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                  {MAJOR_KEYS.map((key) => {
                    const active = settings.fixedKey === key.pitchClass;
                    return (
                      <button
                        key={key.pitchClass}
                        type="button"
                        aria-pressed={active}
                        aria-label={key.displayName}
                        onClick={() => onUpdate({ fixedKey: key.pitchClass })}
                        className={`flex min-h-[40px] items-center justify-center rounded-xl border text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                          active
                            ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                            : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                        }`}
                      >
                        {key.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="rotate-every-slider"
                    className="text-sm font-medium text-[#F3EFE6]"
                  >
                    Rotate key every
                  </label>
                  <span className="text-sm font-semibold text-[#E5A93C] tabular-nums">
                    {settings.rotateEveryNQuestions} question
                    {settings.rotateEveryNQuestions === 1 ? '' : 's'}
                  </span>
                </div>
                <input
                  id="rotate-every-slider"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={settings.rotateEveryNQuestions}
                  onChange={(e) =>
                    onUpdate({ rotateEveryNQuestions: Number(e.target.value) })
                  }
                  className="studio-slider mt-1"
                />
              </div>
            )}

            <div>
              <span className="block text-sm font-medium text-[#F3EFE6]">
                Key orientation
              </span>
              <div
                className="mt-1.5 grid grid-cols-3 gap-1.5"
                role="group"
                aria-label="Key orientation"
              >
                {(
                  [
                    { id: 'cadence', label: 'I–IV–V–I' },
                    { id: 'tonic', label: 'Tonic I' },
                    { id: 'none', label: 'None' },
                  ] as const
                ).map((option) => {
                  const active = settings.keyOrientation === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdate({ keyOrientation: option.id })}
                      className={`min-h-[40px] rounded-xl border px-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C] ${
                        active
                          ? 'border-[#E5A93C] bg-[#E5A93C]/20 text-[#E5A93C]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Drone */}
          <div className="space-y-3 border-t border-[#2B323B] pt-4">
            <h3 className="text-xs font-semibold text-[#9CA3AE]">Drone</h3>

            <SwitchRow
              id="toggle-drone"
              label="Enable drone"
              description="Warm reference tone matched to the active key"
              checked={settings.droneEnabled}
              onChange={(checked) => onUpdate({ droneEnabled: checked })}
            />

            <div>
              <div className="flex items-baseline justify-between">
                <span className="block text-sm font-medium text-[#F3EFE6]">
                  Scale tone
                </span>
                <span className="text-xs font-medium text-[#4FB3A4] tabular-nums">
                  {showResolvedDroneNote
                    ? `Degree ${settings.droneScaleDegree} · ${droneResolvedPitch}`
                    : `Degree ${settings.droneScaleDegree}`}
                </span>
              </div>
              <div
                className="mt-1.5 grid grid-cols-7 gap-1.5"
                role="group"
                aria-label="Drone scale tone"
              >
                {SCALE_DEGREES.map((degree) => {
                  const active = settings.droneScaleDegree === degree;
                  return (
                    <button
                      key={degree}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Scale tone ${degree}`}
                      onClick={() => onUpdate({ droneScaleDegree: degree })}
                      className={`flex min-h-[42px] items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                        active
                          ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {degree}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="drone-volume-slider"
                  className="text-sm font-medium text-[#F3EFE6]"
                >
                  Drone volume
                </label>
                <span className="text-sm font-semibold text-[#4FB3A4] tabular-nums">
                  {Math.round(settings.droneVolume * 100)}%
                </span>
              </div>
              <input
                id="drone-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.droneVolume}
                onChange={(e) =>
                  onUpdate({ droneVolume: Number(e.target.value) })
                }
                className="studio-slider mt-1"
              />
            </div>
          </div>

          {/* 4. Timing & Speech */}
          <div className="space-y-3.5 border-t border-[#2B323B] pt-4">
            <h3 className="text-xs font-semibold text-[#9CA3AE]">
              Timing &amp; speech
            </h3>

            <div>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="repeat-pause-slider"
                  className="text-sm font-medium text-[#F3EFE6]"
                >
                  Pause between repeats
                </label>
                <span className="text-sm font-semibold text-[#E5A93C] tabular-nums">
                  {settings.repeatPauseSec.toFixed(1)}s
                </span>
              </div>
              <input
                id="repeat-pause-slider"
                type="range"
                min={0.4}
                max={3.0}
                step={0.1}
                value={settings.repeatPauseSec}
                onChange={(e) =>
                  onUpdate({ repeatPauseSec: Number(e.target.value) })
                }
                className="studio-slider mt-1"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="speech-rate-slider"
                  className="text-sm font-medium text-[#F3EFE6]"
                >
                  Speech rate
                </label>
                <span className="text-sm font-semibold text-[#E5A93C] tabular-nums">
                  {settings.speechRate.toFixed(2)}×
                </span>
              </div>
              <input
                id="speech-rate-slider"
                type="range"
                min={0.7}
                max={1.4}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) =>
                  onUpdate({ speechRate: Number(e.target.value) })
                }
                className="studio-slider mt-1"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-[#F3EFE6]">
                viiø7 spoken naming
              </span>
              <div
                className="mt-1.5 grid grid-cols-2 gap-1.5"
                role="group"
                aria-label="Half-diminished chord naming"
              >
                {(
                  [
                    { id: 'half-diminished', label: 'Half diminished' },
                    { id: 'minor-seven-flat-five', label: 'Minor 7♭5' },
                  ] as const
                ).map((option) => {
                  const active = settings.halfDimNaming === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdate({ halfDimNaming: option.id })}
                      className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                        active
                          ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-[#9CA3AE]">
                Speaks &ldquo;
                {settings.halfDimNaming === 'minor-seven-flat-five'
                  ? 'Seven minor seven flat five'
                  : 'Seven half diminished'}
                &rdquo;
              </p>
            </div>

            <div>
              <span className="block text-sm font-medium text-[#F3EFE6]">
                Voice source
              </span>
              <div
                className="mt-1.5 grid grid-cols-2 gap-1.5"
                role="group"
                aria-label="Voice source"
              >
                {(
                  [
                    { id: 'recorded', label: 'Built-in (Pocket)' },
                    { id: 'speech-synthesis', label: 'Browser TTS' },
                  ] as const
                ).map((option) => {
                  const active = settings.voiceSource === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdate({ voiceSource: option.id })}
                      className={`min-h-[42px] rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB3A4] ${
                        active
                          ? 'border-[#4FB3A4] bg-[#4FB3A4]/20 text-[#4FB3A4]'
                          : 'border-[#343C47] bg-[#252B33] text-[#9CA3AE] hover:text-[#F3EFE6]'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {settings.voiceSource === 'recorded' && (
                <p className="mt-1.5 text-xs text-[#9CA3AE]">
                  Plays through Web Audio — works when your iPhone screen is
                  locked.
                </p>
              )}
            </div>

            {settings.voiceSource === 'speech-synthesis' && (
              <div>
                <label
                  htmlFor="speech-voice-select"
                  className="block text-sm font-medium text-[#F3EFE6]"
                >
                  Voice
                </label>
                <select
                  id="speech-voice-select"
                  value={settings.speechVoiceURI ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      speechVoiceURI: e.target.value ? e.target.value : null,
                    })
                  }
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#343C47] bg-[#252B33] px-3 text-sm text-[#F3EFE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
                >
                  <option value="">Auto (system default)</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
