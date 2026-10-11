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
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = window[name];
  if (
    storage &&
    typeof storage.clear === 'function' &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  ) {
    return;
  }

  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
}

// jsdom doesn't implement scrollTo
window.scrollTo = () => {};

ensureStorage('localStorage');
ensureStorage('sessionStorage');

// jsdom doesn't implement HTMLCanvasElement.getContext
const fakeCanvasCtx = {
  fillStyle: '',
  textAlign: '',
  font: '',
  fillRect: () => {},
  drawImage: () => {},
  fillText: () => {},
} as unknown as CanvasRenderingContext2D;

HTMLCanvasElement.prototype.getContext = (() =>
  fakeCanvasCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  cleanup();
});
