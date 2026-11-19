import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

if (
  typeof window !== 'undefined' &&
  typeof window.localStorage?.getItem !== 'function'
) {
  const mem = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', {
    value: mem,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: mem,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
