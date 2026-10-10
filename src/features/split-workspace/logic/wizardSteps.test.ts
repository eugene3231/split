import { describe, expect, it } from 'vitest';
import { getContinueLabel, getStepNumber, isStepCompleted, STEP_LABELS } from './wizardSteps';

describe('getContinueLabel', () => {
  it('names the next step before claiming', () => {
    expect(getContinueLabel('people', '')).toBe('Add receipts');
    expect(getContinueLabel('receipt', '')).toBe('Claim items');
  });

  it('uses the claim label while claiming', () => {
    expect(getContinueLabel('items', 'Next: Mei')).toBe('Next: Mei');
  });

  it('returns "Summary" for the final step', () => {
    expect(getContinueLabel('final', '')).toBe('Summary');
  });
});

describe('getStepNumber', () => {
  it('returns 1-based step numbers', () => {
    expect(getStepNumber('people')).toBe(1);
    expect(getStepNumber('receipt')).toBe(2);
    expect(getStepNumber('items')).toBe(3);
    expect(getStepNumber('final')).toBe(4);
  });
});

describe('isStepCompleted', () => {
  it('marks earlier steps as completed', () => {
    expect(isStepCompleted('people', 'receipt')).toBe(true);
    expect(isStepCompleted('people', 'items')).toBe(true);
    expect(isStepCompleted('receipt', 'items')).toBe(true);
  });

  it('marks later steps as not completed', () => {
    expect(isStepCompleted('receipt', 'people')).toBe(false);
    expect(isStepCompleted('items', 'receipt')).toBe(false);
    expect(isStepCompleted('final', 'items')).toBe(false);
  });

  it('marks same step as not completed', () => {
    expect(isStepCompleted('people', 'people')).toBe(false);
    expect(isStepCompleted('items', 'items')).toBe(false);
  });
});

describe('STEP_LABELS', () => {
  it('has labels for all four steps', () => {
    expect(STEP_LABELS.people).toBe('People');
    expect(STEP_LABELS.receipt).toBe('Receipt');
    expect(STEP_LABELS.items).toBe('Claim');
    expect(STEP_LABELS.final).toBe('Summary');
  });
});
