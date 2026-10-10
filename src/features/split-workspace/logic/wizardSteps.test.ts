import { describe, expect, it } from 'vitest';
import { getContinueLabel, STEP_LABELS } from './wizardSteps';

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

describe('STEP_LABELS', () => {
  it('has labels for all four steps', () => {
    expect(STEP_LABELS.people).toBe('People');
    expect(STEP_LABELS.receipt).toBe('Receipt');
    expect(STEP_LABELS.items).toBe('Assign');
    expect(STEP_LABELS.final).toBe('Summary');
  });
});
