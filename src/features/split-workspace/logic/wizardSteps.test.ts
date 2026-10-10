import { describe, expect, it } from 'vitest';
import { getContinueLabel, STEP_LABELS } from './wizardSteps';

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

describe('STEP_LABELS', () => {
  it('has labels for all four steps', () => {
    expect(STEP_LABELS.people).toBe('People');
    expect(STEP_LABELS.receipt).toBe('Receipt');
    expect(STEP_LABELS.items).toBe('Items');
    expect(STEP_LABELS.final).toBe('Summary');
  });
});
