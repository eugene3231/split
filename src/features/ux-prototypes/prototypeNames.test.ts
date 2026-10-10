import { describe, expect, it } from 'vitest';
import { toPrototypeName } from './prototypeNames';

describe('toPrototypeName', () => {
  it('accepts a known prototype from the query string', () => {
    expect(toPrototypeName('ledger')).toBe('ledger');
  });

  it('rejects unknown or missing values so the real app renders', () => {
    expect(toPrototypeName('nope')).toBeNull();
    expect(toPrototypeName(null)).toBeNull();
  });
});
