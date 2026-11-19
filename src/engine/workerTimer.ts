export interface SchedulerClock {
  start(onTick: () => void): void;
  stop(): void;
  dispose(): void;
}

export class WorkerClock implements SchedulerClock {
  private worker: Worker | null = null;
  private fallbackTimer: number | null = null;
  private tickCallback: (() => void) | null = null;
  private readonly intervalMs: number;

  constructor(intervalMs = 25) {
    this.intervalMs = intervalMs;
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;

    try {
      const worker = new Worker(new URL('./timerWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = () => {
        this.tickCallback?.();
      };
      this.worker = worker;
      return worker;
    } catch {
      return null;
    }
  }

  start(onTick: () => void): void {
    this.stop();
    this.tickCallback = onTick;

    const worker = this.ensureWorker();
    if (worker) {
      worker.postMessage({ type: 'start', intervalMs: this.intervalMs });
      return;
    }

    if (typeof window !== 'undefined') {
      this.fallbackTimer = window.setInterval(() => {
        this.tickCallback?.();
      }, this.intervalMs);
    }
  }

  stop(): void {
    this.tickCallback = null;
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
    }
    if (this.fallbackTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  dispose(): void {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
