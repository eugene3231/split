import { describe, expect, it } from 'vitest';
import { readPrototypeSelection, toPrototypeSearch } from './prototypeNames';

describe('readPrototypeSelection', () => {
  it('opens a known prototype on the dinner receipt by default', () => {
    expect(readPrototypeSelection('?prototype=ledger')).toEqual({
      name: 'ledger',
      receipt: 'dinner',
    });
  });

  it('switches to the stress receipt when asked', () => {
    expect(readPrototypeSelection('?prototype=claim&receipt=stress')?.receipt).toBe('stress');
  });

  it('rejects unknown or missing prototypes so the real app renders', () => {
    expect(readPrototypeSelection('?prototype=nope')).toBeNull();
    expect(readPrototypeSelection('')).toBeNull();
  });

  it('round-trips a selection through the query string', () => {
    const selection = { name: 'plate', receipt: 'stress' } as const;
    expect(readPrototypeSelection(toPrototypeSearch(selection))).toEqual(selection);
  });
});
