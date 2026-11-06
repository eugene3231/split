import { describe, expect, it } from 'vitest';
import { firstName, formatMoney } from './prototypeFormat';

describe('formatMoney', () => {
  it('groups thousands so large bills stay readable', () => {
    expect(formatMoney(128800)).toBe('$1,288.00');
  });

  it('keeps two decimals for small amounts', () => {
    expect(formatMoney(30)).toBe('$0.30');
  });
});

describe('firstName', () => {
  it('shortens a full name to its first word', () => {
    expect(firstName('Alexandra Konstantinopoulou')).toBe('Alexandra');
  });

  it('keeps hyphenated first names whole', () => {
    expect(firstName('François-Xavier')).toBe('François-Xavier');
  });
});
