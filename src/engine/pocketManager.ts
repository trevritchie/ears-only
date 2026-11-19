import { SilentKeepAlive } from '../audio/silentKeepAlive';

export interface PocketHandlers {
  onPlay: () => void;
  onStop: () => void;
  onReplay: () => void;
  onSkip: () => void;
}

export interface PocketMetadata {
  title: string;
  artist?: string;
  album: string;
}

export interface PocketController {
  activate(handlers: PocketHandlers): void;
  deactivate(): void;
  updateMetadata(metadata: PocketMetadata): void;
  recoverAudioSession(): void;
  isWakeLockActive(): boolean;
  onWakeLockChange(cb: (active: boolean) => void): () => void;
  dispose(): void;
}

function createArtworkDataUrl(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#121417';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#2B323B';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 228, 228);

    const bars = [
      { x: 64, y: 96, h: 64, color: '#E5A93C' },
      { x: 98, y: 64, h: 128, color: '#E5A93C' },
      { x: 132, y: 80, h: 96, color: '#4FB3A4' },
      { x: 166, y: 54, h: 148, color: '#E5A93C' },
    ];
    for (const bar of bars) {
      ctx.fillStyle = bar.color;
      ctx.beginPath();
      ctx.roundRect(bar.x, bar.y, 18, bar.h, 9);
      ctx.fill();
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export class PocketManager implements PocketController {
  private keepAlive = new SilentKeepAlive();
  private wakeLock: WakeLockSentinel | null = null;
  private wakeLockListeners = new Set<(active: boolean) => void>();
  private wakeLockState = false;
  private active = false;
  private artworkUrl: string | null = null;
  private visibilityListener: (() => void) | null = null;

  private setWakeLockState(next: boolean): void {
    if (this.wakeLockState === next) return;
    this.wakeLockState = next;
    for (const cb of this.wakeLockListeners) {
      cb(next);
    }
  }

  private async requestWakeLock(): Promise<void> {
    if (
      !this.active ||
      typeof navigator === 'undefined' ||
      !('wakeLock' in navigator)
    ) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!this.active) {
        await sentinel.release().catch(() => {});
        return;
      }
      this.wakeLock = sentinel;
      this.setWakeLockState(true);
      sentinel.addEventListener('release', () => {
        if (this.wakeLock === sentinel) {
          this.wakeLock = null;
          this.setWakeLockState(false);
        }
      });
    } catch {
      this.setWakeLockState(false);
    }
  }

  private releaseWakeLock(): void {
    const sentinel = this.wakeLock;
    this.wakeLock = null;
    this.setWakeLockState(false);
    if (sentinel) {
      void sentinel.release().catch(() => {});
    }
  }

  private registerMediaActions(handlers: PocketHandlers): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;
    const bind = (action: MediaSessionAction, fn: (() => void) | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // Some browsers reject unsupported action names.
      }
    };

    bind('play', handlers.onPlay);
    bind('pause', handlers.onStop);
    bind('stop', handlers.onStop);
    bind('previoustrack', handlers.onReplay);
    bind('nexttrack', handlers.onSkip);
  }

  activate(handlers: PocketHandlers): void {
    this.active = true;
    this.keepAlive.start();
    this.registerMediaActions(handlers);

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // Ignore
      }
    }

    if (typeof document !== 'undefined' && !this.visibilityListener) {
      this.visibilityListener = () => {
        if (this.active && document.visibilityState === 'visible') {
          this.keepAlive.ensurePlaying();
          if (!this.wakeLock) {
            void this.requestWakeLock();
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }

    void this.requestWakeLock();
  }

  updateMetadata(metadata: PocketMetadata): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    if (typeof MediaMetadata === 'undefined') return;

    if (this.artworkUrl === null) {
      this.artworkUrl = createArtworkDataUrl();
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist ?? 'ears-only',
        album: metadata.album,
        artwork: this.artworkUrl
          ? [{ src: this.artworkUrl, sizes: '256x256', type: 'image/png' }]
          : [],
      });
      navigator.mediaSession.playbackState = this.active ? 'playing' : 'paused';
    } catch {
      // Ignore
    }
  }

  recoverAudioSession(): void {
    if (!this.active) return;
    this.keepAlive.ensurePlaying();
  }

  deactivate(): void {
    this.active = false;
    this.keepAlive.stop();
    this.releaseWakeLock();

    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'paused';
      } catch {
        // Ignore
      }
    }
  }

  isWakeLockActive(): boolean {
    return this.wakeLockState;
  }

  onWakeLockChange(cb: (active: boolean) => void): () => void {
    this.wakeLockListeners.add(cb);
    return () => {
      this.wakeLockListeners.delete(cb);
    };
  }

  dispose(): void {
    this.deactivate();
    this.keepAlive.dispose();
    this.wakeLockListeners.clear();
  }
}
