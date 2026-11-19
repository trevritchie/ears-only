import type { VoiceSource } from '../types/settings';
import { AudioBufferAnnouncer, type VoiceSynthHost } from './audioAnnouncer';
import {
  type SpeakOptions,
  type SpeechVoiceOption,
  type VoiceAnnouncer,
  WebSpeechAnnouncer,
} from './speech';

export class HybridVoiceAnnouncer implements VoiceAnnouncer {
  private readonly audioAnnouncer: AudioBufferAnnouncer;
  private readonly webSpeech: WebSpeechAnnouncer;
  private mode: VoiceSource;
  private speakGen = 0;

  constructor(host: VoiceSynthHost, initialMode: VoiceSource = 'recorded') {
    this.audioAnnouncer = new AudioBufferAnnouncer(host);
    this.webSpeech = new WebSpeechAnnouncer();
    this.mode = initialMode;
  }

  setMode(mode: VoiceSource): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.cancel();
  }

  isAvailable(): boolean {
    if (this.mode === 'recorded') {
      return true;
    }
    return this.webSpeech.isAvailable();
  }

  unlock(): void {
    if (this.mode === 'speech-synthesis') {
      this.webSpeech.unlock();
    }
  }

  preload(texts: readonly string[]): void {
    this.audioAnnouncer.preload(texts);
  }

  getVoices(): SpeechVoiceOption[] {
    return this.webSpeech.getVoices();
  }

  onVoicesChanged(cb: () => void): () => void {
    return this.webSpeech.onVoicesChanged(cb);
  }

  estimateDurationSec(syllables: number, rate: number, text?: string): number {
    if (this.mode === 'recorded') {
      return this.audioAnnouncer.estimateDurationSec(syllables, rate, text);
    }
    return this.webSpeech.estimateDurationSec(syllables, rate);
  }

  speak(text: string, options: SpeakOptions): void {
    this.speakGen++;
    const gen = this.speakGen;

    if (this.mode === 'speech-synthesis') {
      this.webSpeech.speak(text, options);
      return;
    }

    void this.audioAnnouncer.trySpeak(text, options).then((played) => {
      if (!played && gen === this.speakGen) {
        this.webSpeech.speak(text, options);
      }
    });
  }

  cancel(): void {
    this.speakGen++;
    this.audioAnnouncer.cancel();
    this.webSpeech.cancel();
  }

  dispose(): void {
    this.cancel();
    this.audioAnnouncer.dispose();
    this.webSpeech.dispose();
  }
}
