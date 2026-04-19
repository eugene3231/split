import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom doesn't implement IntersectionObserver, ResizeObserver, or matchMedia — all required by embla-carousel
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement scrollTo
window.scrollTo = () => {};

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
