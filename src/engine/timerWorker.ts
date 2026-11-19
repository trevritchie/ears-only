let timerId: number | null = null;

self.onmessage = (event: MessageEvent<{ type: string; intervalMs?: number } | string>) => {
  const msgType = typeof event.data === 'string' ? event.data : event.data?.type;
  if (msgType === 'start') {
    const intervalMs =
      typeof event.data === 'object' && event.data?.intervalMs
        ? event.data.intervalMs
        : 25;
    if (timerId !== null) {
      self.clearInterval(timerId);
    }
    timerId = self.setInterval(() => {
      self.postMessage('tick');
    }, intervalMs);
  } else if (msgType === 'stop') {
    if (timerId !== null) {
      self.clearInterval(timerId);
      timerId = null;
    }
  }
};
