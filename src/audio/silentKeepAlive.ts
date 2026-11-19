function createSilentWavBlobUrl(): string {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate; // 1 second
  const dataByteSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataByteSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteSize, true);

  // Use an alternating +/-1 LSB (-90 dB) floor rather than digital zeros
  // so mobile OS audio pipelines keep the background playback session active.
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Plays an inaudible looping WAV on an HTMLAudioElement so mobile browsers
 * maintain the audio pipeline and lock-screen Media Session controls when locked.
 */
export class SilentKeepAlive {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private active = false;

  private ensureElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null;
    }
    if (!this.audio) {
      this.objectUrl = createSilentWavBlobUrl();
      const audio = new Audio(this.objectUrl);
      audio.loop = true;
      audio.volume = 0.01;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      this.audio = audio;
    }
    return this.audio;
  }

  private configureAudioSession(): void {
    try {
      const nav = navigator as unknown as {
        audioSession?: { type: string };
      };
      if (nav.audioSession) {
        nav.audioSession.type = 'playback';
      }
    } catch {
      // Ignore if AudioSession API is unavailable or read-only.
    }
  }

  start(): void {
    this.active = true;
    this.configureAudioSession();
    const audio = this.ensureElement();
    if (!audio) return;
    try {
      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        void result.catch(() => {});
      }
    } catch {
      // Ignore autoplay errors in non-gesture test contexts.
    }
  }

  ensurePlaying(): void {
    if (!this.active || !this.audio) return;
    if (this.audio.paused) {
      try {
        const result = this.audio.play();
        if (result && typeof result.catch === 'function') {
          void result.catch(() => {});
        }
      } catch {
        // Ignore
      }
    }
  }

  stop(): void {
    this.active = false;
    if (!this.audio) return;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {
      // Ignore
    }
  }

  dispose(): void {
    this.stop();
    this.audio = null;
    if (this.objectUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
