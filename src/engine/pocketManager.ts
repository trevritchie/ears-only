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

export function createArtworkDataUrl(): string | null {
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
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 232, 232);

    const toes: readonly [number, number, number, number, number][] = [
      [66, 116, 16, 22, (-22 * Math.PI) / 180],
      [104, 82, 17, 24, (-8 * Math.PI) / 180],
      [152, 82, 17, 24, (8 * Math.PI) / 180],
      [190, 116, 16, 22, (22 * Math.PI) / 180],
    ];
    ctx.fillStyle = '#E5A93C';
    for (const [x, y, rx, ry, rot] of toes) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#4FB3A4';
    if (typeof Path2D !== 'undefined') {
      ctx.fill(
        new Path2D(
          'M128 122 C102 122 82 146 82 170 C82 188 96 198 112 195 C119 193 123 190 128 190 C133 190 137 193 144 195 C160 198 174 188 174 170 C174 146 154 122 128 122 Z',
        ),
      );
    } else {
      ctx.beginPath();
      ctx.arc(128, 160, 40, 0, Math.PI * 2);
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
        artist: metadata.artist ?? 'Paws Off',
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
