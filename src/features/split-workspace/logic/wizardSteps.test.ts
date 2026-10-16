import { describe, expect, it } from 'vitest';
import { getContinueLabel } from './wizardSteps';

describe('getContinueLabel', () => {
  it('names the next step before assigning items', () => {
    expect(getContinueLabel('people', '')).toBe('Add receipts');
    expect(getContinueLabel('receipt', '')).toBe('Who had what');
  });

  it('uses the claim label while claiming', () => {
    expect(getContinueLabel('items', 'Next: Mei')).toBe('Next: Mei');
  });

  it('returns "Summary" for the final step', () => {
    expect(getContinueLabel('final', '')).toBe('Summary');
  });
});
