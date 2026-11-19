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

function getArtworkUrl(): string {
  const rawBase =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  return `${base}icon-512.png`;
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
      this.artworkUrl = getArtworkUrl();
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist ?? 'Ears Only',
        album: metadata.album,
        artwork: this.artworkUrl
          ? [{ src: this.artworkUrl, sizes: '512x512', type: 'image/png' }]
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
