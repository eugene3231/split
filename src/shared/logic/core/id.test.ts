import { describe, expect, it } from 'vitest';
import { createId } from './id';

describe('createId', () => {
  it('generates a unique id using crypto.randomUUID', () => {
    const id1 = createId();
    const id2 = createId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
  });

  it('falls back to timestamp-random when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {},
      writable: true,
      configurable: true,
    });

    const id = createId();
    expect(id).toMatch(/^id-\d+-[0-9a-f]+$/);

    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true,
    });
  });
});
