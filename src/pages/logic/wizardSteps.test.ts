import { describe, expect, it } from 'vitest';
import {
  getContinueLabel,
  getStepNumber,
  isStepCompleted,
  STEP_LABELS,
} from '@pages/logic/wizardSteps';

describe('getContinueLabel', () => {
  it('returns "Add Receipts" for people step', () => {
    expect(getContinueLabel('people', 'assign', false)).toBe('Add Receipts');
  });

  it('returns "Assign Items" for receipt step', () => {
    expect(getContinueLabel('receipt', 'assign', false)).toBe('Assign Items');
  });

  it('returns "Next Item" when on items assign step and not last item', () => {
    expect(getContinueLabel('items', 'assign', false)).toBe('Next Item');
  });

  it('returns "Review Items" when on items assign step and last item', () => {
    expect(getContinueLabel('items', 'assign', true)).toBe('Review Items');
  });

  it('returns "Summary" for items review sub-phase', () => {
    expect(getContinueLabel('items', 'review', false)).toBe('Summary');
  });

  it('returns "Summary" for final step', () => {
    expect(getContinueLabel('final', 'assign', false)).toBe('Summary');
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
    expect(STEP_LABELS.items).toBe('Assign');
    expect(STEP_LABELS.final).toBe('Summary');
  });
});
