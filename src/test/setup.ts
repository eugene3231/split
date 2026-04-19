import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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
