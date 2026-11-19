import { getVoiceClipUrl } from '../audio/voiceClips';
import type { SpeakOptions } from './speech';

export interface VoiceSynthHost {
  getAudioContext(): AudioContext | null;
  getVoiceInput(): AudioNode | null;
}

export class AudioBufferAnnouncer {
  private readonly host: VoiceSynthHost;
  private readonly fetcher: typeof fetch;
  private readonly rawCache = new Map<string, ArrayBuffer>();
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly fetchPromises = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly decodePromises = new Map<string, Promise<AudioBuffer | null>>();

  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;
  private watchdogTimer: number | null = null;
  private speechToken = 0;

  constructor(host: VoiceSynthHost, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.host = host;
    this.fetcher = fetcher;
  }

  private async fetchRaw(url: string): Promise<ArrayBuffer | null> {
    const cached = this.rawCache.get(url);
    if (cached) return cached;

    const inflight = this.fetchPromises.get(url);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        const res = await this.fetcher(url);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        this.rawCache.set(url, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.fetchPromises.delete(url);
      }
    })();

    this.fetchPromises.set(url, promise);
    return promise;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const ctx = this.host.getAudioContext();
    if (!ctx) return null;

    const inflight = this.decodePromises.get(url);
    if (inflight) return inflight;

    const promise = (async () => {
      try {
        const raw = await this.fetchRaw(url);
        if (!raw) return null;
        // Clone ArrayBuffer because decodeAudioData detaches the buffer it receives.
        const decoded = await ctx.decodeAudioData(raw.slice(0));
        this.bufferCache.set(url, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.decodePromises.delete(url);
      }
    })();

    this.decodePromises.set(url, promise);
    return promise;
  }

  preload(texts: readonly string[]): void {
    const ctx = this.host.getAudioContext();
    for (const text of texts) {
      const url = getVoiceClipUrl(text);
      if (!url) continue;
      if (ctx) {
        void this.loadBuffer(url);
      } else {
        void this.fetchRaw(url);
      }
    }
  }

  estimateDurationSec(syllables: number, rate: number, text?: string): number {
    const safeRate = Math.max(0.5, rate);
    if (text) {
      const url = getVoiceClipUrl(text);
      const buf = url ? this.bufferCache.get(url) : undefined;
      if (buf) {
        return buf.duration / safeRate;
      }
    }
    return (0.18 + syllables * 0.17) / safeRate;
  }

  private stopActiveSource(): void {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    const source = this.activeSource;
    const gain = this.activeGain;
    this.activeSource = null;
    this.activeGain = null;

    if (source) {
      source.onended = null;
      try {
        const ctx = this.host.getAudioContext();
        const now = ctx ? ctx.currentTime : 0;
        if (gain && ctx) {
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.03);
          source.stop(now + 0.035);
        } else {
          source.stop();
        }
      } catch {
        // Ignore already stopped source.
      }
    }
  }

  async trySpeak(text: string, options: SpeakOptions): Promise<boolean> {
    const url = getVoiceClipUrl(text);
    if (!url) return false;

    this.speechToken++;
    const token = this.speechToken;
    this.stopActiveSource();

    const ctx = this.host.getAudioContext();
    const voiceInput = this.host.getVoiceInput();
    if (!ctx || !voiceInput) return false;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    let buffer = this.bufferCache.get(url) ?? null;
    if (!buffer) {
      buffer = await this.loadBuffer(url);
      if (token !== this.speechToken) {
        // Cancelled while awaiting fetch/decode; treat as handled cleanly.
        return true;
      }
      if (!buffer) {
        return false;
      }
    }

    const rate = Math.max(0.7, Math.min(1.4, options.rate));
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, now);

    const clipGain = ctx.createGain();
    clipGain.gain.setValueAtTime(1.0, now);

    source.connect(clipGain);
    clipGain.connect(voiceInput);

    this.activeSource = source;
    this.activeGain = clipGain;

    let settled = false;
    const finish = () => {
      if (settled || token !== this.speechToken) return;
      settled = true;
      if (this.watchdogTimer !== null) {
        window.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      if (this.activeSource === source) {
        this.activeSource = null;
        this.activeGain = null;
      }
      source.onended = null;
      try {
        source.disconnect();
        clipGain.disconnect();
      } catch {
        // Ignore
      }
      options.onEnd?.();
    };

    source.onended = finish;
    const expectedMs = Math.ceil((buffer.duration / rate) * 1000);
    this.watchdogTimer = window.setTimeout(finish, expectedMs + 800);

    try {
      source.start(now + 0.008);
      options.onStart?.();
      return true;
    } catch {
      this.stopActiveSource();
      return false;
    }
  }

  cancel(): void {
    this.speechToken++;
    this.stopActiveSource();
  }

  dispose(): void {
    this.cancel();
    this.bufferCache.clear();
    this.rawCache.clear();
  }
}
