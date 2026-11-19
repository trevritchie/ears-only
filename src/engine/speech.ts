export interface SpeechVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
}

export interface SpeakOptions {
  rate: number;
  voiceURI: string | null;
  estimatedSyllables: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface VoiceAnnouncer {
  isAvailable(): boolean;
  unlock(): void;
  getVoices(): SpeechVoiceOption[];
  onVoicesChanged(cb: () => void): () => void;
  estimateDurationSec(syllables: number, rate: number): number;
  speak(text: string, options: SpeakOptions): void;
  cancel(): void;
  dispose(): void;
}

export class WebSpeechAnnouncer implements VoiceAnnouncer {
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private watchdogTimer: number | null = null;
  private pendingSpeakTimer: number | null = null;
  private speechToken = 0;
  private secPerSyllable = 0.19;
  private readonly overheadSec = 0.24;
  private voiceChangeListeners = new Set<() => void>();
  private boundVoicesChanged: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.boundVoicesChanged = () => {
        for (const cb of this.voiceChangeListeners) {
          cb();
        }
      };
      window.speechSynthesis.addEventListener?.(
        'voiceschanged',
        this.boundVoicesChanged,
      );
    }
  }

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  unlock(): void {
    if (!this.isAvailable()) return;
    try {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.rate = 1.5;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore unlock failures.
    }
  }

  getVoices(): SpeechVoiceOption[] {
    if (!this.isAvailable()) return [];
    const voices = window.speechSynthesis.getVoices() ?? [];
    return voices.map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
    }));
  }

  onVoicesChanged(cb: () => void): () => void {
    this.voiceChangeListeners.add(cb);
    return () => {
      this.voiceChangeListeners.delete(cb);
    };
  }

  estimateDurationSec(syllables: number, rate: number): number {
    const safeRate = Math.max(0.5, rate);
    return (this.overheadSec + syllables * this.secPerSyllable) / safeRate;
  }

  private resolveVoice(voiceURI: string | null): SpeechSynthesisVoice | null {
    if (!this.isAvailable()) return null;
    const voices = window.speechSynthesis.getVoices() ?? [];
    if (voices.length === 0) return null;

    if (voiceURI) {
      const explicit = voices.find((v) => v.voiceURI === voiceURI);
      if (explicit) return explicit;
    }

    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const localEnglish = english.find((v) => v.localService);
    return localEnglish ?? english[0] ?? voices[0];
  }

  private clearTimers(): void {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.pendingSpeakTimer !== null) {
      window.clearTimeout(this.pendingSpeakTimer);
      this.pendingSpeakTimer = null;
    }
  }

  speak(text: string, options: SpeakOptions): void {
    if (!this.isAvailable()) {
      options.onEnd?.();
      return;
    }

    this.speechToken++;
    const token = this.speechToken;
    this.clearTimers();
    this.activeUtterance = null;

    const synth = window.speechSynthesis;
    const needsCancelDelay = synth.speaking || synth.pending;

    if (needsCancelDelay) {
      try {
        synth.cancel();
      } catch {
        // Ignore
      }
      // Avoid Chrome/Safari bug that silently drops speak() called in the same tick as cancel().
      this.pendingSpeakTimer = window.setTimeout(() => {
        this.pendingSpeakTimer = null;
        if (token !== this.speechToken) return;
        this.dispatchUtterance(text, options, token);
      }, 50);
    } else {
      this.dispatchUtterance(text, options, token);
    }
  }

  private dispatchUtterance(
    text: string,
    options: SpeakOptions,
    token: number,
  ): void {
    if (!this.isAvailable() || token !== this.speechToken) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoice = this.resolveVoice(options.voiceURI);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = Math.max(0.5, Math.min(2.0, options.rate));
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Hold a strong reference so browsers do not GC the utterance before onend fires.
    this.activeUtterance = utterance;

    let settled = false;
    let startedAtMs: number | null = null;

    const finish = (observedComplete: boolean) => {
      if (settled || token !== this.speechToken) return;
      settled = true;
      this.clearTimers();
      this.activeUtterance = null;

      if (observedComplete && startedAtMs !== null) {
        const elapsedSec = (performance.now() - startedAtMs) / 1000;
        if (elapsedSec > 0.15 && elapsedSec < 6.0) {
          const rawPerSyllable =
            (elapsedSec * utterance.rate - this.overheadSec) /
            Math.max(1, options.estimatedSyllables);
          const clamped = Math.max(0.11, Math.min(0.35, rawPerSyllable));
          this.secPerSyllable = this.secPerSyllable * 0.75 + clamped * 0.25;
        }
      }

      options.onEnd?.();
    };

    utterance.onstart = () => {
      if (settled || token !== this.speechToken) return;
      startedAtMs = performance.now();
      options.onStart?.();
    };

    utterance.onend = () => {
      finish(true);
    };

    utterance.onerror = () => {
      finish(false);
    };

    const estimatedMs =
      this.estimateDurationSec(options.estimatedSyllables, utterance.rate) * 1000;
    const watchdogMs = Math.max(2600, Math.round(estimatedMs) + 2200);
    this.watchdogTimer = window.setTimeout(() => {
      finish(false);
    }, watchdogMs);

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(false);
    }
  }

  cancel(): void {
    this.speechToken++;
    this.clearTimers();
    if (this.activeUtterance) {
      this.activeUtterance.onstart = null;
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }
    if (!this.isAvailable()) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      try {
        synth.cancel();
      } catch {
        // Ignore
      }
    }
  }

  dispose(): void {
    this.cancel();
    if (
      this.boundVoicesChanged &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.removeEventListener?.(
        'voiceschanged',
        this.boundVoicesChanged,
      );
    }
    this.voiceChangeListeners.clear();
  }
}
