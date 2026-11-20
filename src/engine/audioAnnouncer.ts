import { getVoiceClipUrlsForPhrase } from '../audio/voiceClips';
import type { SpeakOptions } from './speech';

export interface VoiceSynthHost {
  getAudioContext(): AudioContext | null;
  getVoiceInput(): AudioNode | null;
}

/** Trim trailing fade/guard silence + lead-in when chaining two voice clips. */
const CHAIN_OVERLAP_SEC = 0.19;

interface ActiveVoiceNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioBufferAnnouncer {
  private readonly host: VoiceSynthHost;
  private readonly fetcher: typeof fetch;
  private readonly rawCache = new Map<string, ArrayBuffer>();
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly fetchPromises = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly decodePromises = new Map<string, Promise<AudioBuffer | null>>();

  private activeChain: ActiveVoiceNode[] = [];
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
    const seenUrls = new Set<string>();
    for (const text of texts) {
      const urls = getVoiceClipUrlsForPhrase(text);
      if (!urls) continue;
      for (const url of urls) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        if (ctx) {
          void this.loadBuffer(url);
        } else {
          void this.fetchRaw(url);
        }
      }
    }
  }

  estimateDurationSec(syllables: number, rate: number, text?: string): number {
    const safeRate = Math.max(0.5, rate);
    if (text) {
      const urls = getVoiceClipUrlsForPhrase(text);
      if (urls && urls.length > 0) {
        const bufs = urls.map((u) => this.bufferCache.get(u));
        if (bufs.every((b): b is AudioBuffer => b !== undefined)) {
          let totalSec = 0;
          for (let i = 0; i < bufs.length; i++) {
            const clipSec = bufs[i].duration / safeRate;
            if (i < bufs.length - 1) {
              totalSec += Math.max(
                0.15,
                (bufs[i].duration - CHAIN_OVERLAP_SEC) / safeRate,
              );
            } else {
              totalSec += clipSec;
            }
          }
          return totalSec;
        }
      }
    }
    return (0.18 + syllables * 0.17) / safeRate;
  }

  private stopActiveSource(): void {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    const chain = this.activeChain;
    this.activeChain = [];
    if (chain.length === 0) return;

    const ctx = this.host.getAudioContext();
    const now = ctx ? ctx.currentTime : 0;

    for (const { source, gain } of chain) {
      source.onended = null;
      try {
        if (ctx) {
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
    const urls = getVoiceClipUrlsForPhrase(text);
    if (!urls || urls.length === 0) return false;

    this.speechToken++;
    const token = this.speechToken;
    this.stopActiveSource();

    const ctx = this.host.getAudioContext();
    const voiceInput = this.host.getVoiceInput();
    if (!ctx || !voiceInput) return false;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const buffers = await Promise.all(
      urls.map((url) => this.bufferCache.get(url) ?? this.loadBuffer(url)),
    );
    if (token !== this.speechToken) {
      // Cancelled while awaiting fetch/decode; treat as handled cleanly.
      return true;
    }
    if (buffers.some((b) => !b)) {
      return false;
    }
    const validBuffers = buffers as AudioBuffer[];

    const rate = Math.max(0.7, Math.min(1.4, options.rate));
    const now = ctx.currentTime;
    const scheduledNodes: ActiveVoiceNode[] = [];
    const startTimes: number[] = [];
    let cursor = now + 0.008;
    let totalDurationSec = 0;

    for (let i = 0; i < validBuffers.length; i++) {
      const buf = validBuffers[i];
      const paramTime = i === 0 ? now : cursor;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.setValueAtTime(rate, paramTime);

      const clipGain = ctx.createGain();
      clipGain.gain.setValueAtTime(1.0, paramTime);

      source.connect(clipGain);
      clipGain.connect(voiceInput);

      const nodeEntry: ActiveVoiceNode = { source, gain: clipGain };
      scheduledNodes.push(nodeEntry);
      startTimes.push(cursor);

      if (i < validBuffers.length - 1) {
        source.onended = () => {
          source.onended = null;
          try {
            source.disconnect();
            clipGain.disconnect();
          } catch {
            // Ignore
          }
        };
        const advanceSec = Math.max(
          0.15,
          (buf.duration - CHAIN_OVERLAP_SEC) / rate,
        );
        cursor += advanceSec;
        totalDurationSec += advanceSec;
      } else {
        totalDurationSec += buf.duration / rate;
      }
    }

    this.activeChain = scheduledNodes;
    const lastEntry = scheduledNodes[scheduledNodes.length - 1];

    let settled = false;
    const finish = () => {
      if (settled || token !== this.speechToken) return;
      settled = true;
      if (this.watchdogTimer !== null) {
        window.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      if (this.activeChain === scheduledNodes) {
        this.activeChain = [];
      }
      for (const { source, gain } of scheduledNodes) {
        source.onended = null;
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Ignore
        }
      }
      options.onEnd?.();
    };

    lastEntry.source.onended = finish;
    const expectedMs = Math.ceil(totalDurationSec * 1000);
    this.watchdogTimer = window.setTimeout(finish, expectedMs + 800);

    try {
      for (let i = 0; i < scheduledNodes.length; i++) {
        scheduledNodes[i].source.start(startTimes[i]);
      }
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
