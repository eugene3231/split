import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Person, SplitResult } from '@shared/types';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_WIZARD_STATE_KEY,
} from '@features/split-workspace/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { quickSplitStore } from '@features/split-workspace/stores/receiptStore';
import { NOBODY } from '@features/split-workspace/logic/assignment';
import { makeItem, makeReceipt } from '../../../tests/integration/testHelpers';
import {
  ReceiptEditor,
  computeSplit,
  discardReceiptDraft,
  isEveryPricedItemAssigned,
  type SavedReceipt,
} from '@features/split-workspace';

const people: Person[] = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
];

const dinner: SavedReceipt = makeReceipt({
  id: 'dinner',
  name: 'Dinner',
  items: [
    makeItem({ id: 'noodles', name: 'Noodles', amountInput: '12.00', assignment: NOBODY }),
    makeItem({ id: 'rice', name: 'Rice', amountInput: '8.00', assignment: NOBODY }),
  ],
});

const DRAFT_KEY = 'test:group-receipt';

function renderEditor(props: Partial<Parameters<typeof ReceiptEditor>[0]> = {}) {
  const renderSave = vi.fn((receipt: SavedReceipt, split: SplitResult) => (
    <button type="button" data-testid="save-to-group">
      Save {receipt.name} {split.totals.totalCents}
    </button>
  ));
  const onCancel = vi.fn();
  render(
    <ReceiptEditor
      people={people}
      initial={dinner}
      draftKey={DRAFT_KEY}
      renderSave={renderSave}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { renderSave, onCancel };
}

function clickContinue() {
  fireEvent.click(screen.getByTestId('wizard-continue-btn'));
}

function assignEveryItem() {
  clickContinue();
  fireEvent.click(screen.getByTestId('claim-item-toggle-noodles'));
  clickContinue();
  fireEvent.click(screen.getByTestId('claim-item-toggle-rice'));
  clickContinue();
}

beforeEach(() => {
  window.localStorage.clear();
  quickSplitStore.getState().resetSplit();
  useGeminiStore.setState({
    geminiApiKeyInput: 'test-key',
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
});

describe('ReceiptEditor', () => {
  it('opens on the receipt with no people step and no second receipt to add', () => {
    renderEditor();

    expect(screen.getByTestId('wizard-step-nav-receipt')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByTestId('wizard-step-nav-people')).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt-add-receipt-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wizard-back-btn')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Noodles')).toBeInTheDocument();
  });

  it('assigns items between the fixed people and offers the save with the split', () => {
    const { renderSave } = renderEditor();

    clickContinue();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('claim-item-toggle-noodles'));
    clickContinue();
    fireEvent.click(screen.getByTestId('claim-item-toggle-rice'));
    clickContinue();

    expect(screen.getByTestId('wizard-step-nav-final')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('save-to-group')).toBeInTheDocument();
    expect(screen.queryByTestId('summary-add-receipt-btn')).not.toBeInTheDocument();

    const [receipt, split] = renderSave.mock.lastCall!;
    expect(receipt).not.toHaveProperty('receiptFile');
    expect(isEveryPricedItemAssigned(receipt.items, people)).toBe(true);
    expect(split).toEqual(computeSplit(receipt, people));
    expect(split.byPerson.alice.subtotalCents).toBe(1200);
    expect(split.byPerson.bob.subtotalCents).toBe(800);
  });

  it('leaves the quick split draft and wizard untouched', () => {
    quickSplitStore.getState().addPeople(['Quinn']);
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'people', activePersonId: '', assignMode: 'person' }),
    );
    const quickSplitDraft = window.localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY);
    const quickSplitWizard = window.localStorage.getItem(LOCAL_STORAGE_WIZARD_STATE_KEY);
    const quickSplitState = quickSplitStore.getState();

    renderEditor();
    fireEvent.change(screen.getByDisplayValue('Noodles'), { target: { value: 'Laksa' } });
    assignEveryItem();

    expect(window.localStorage.getItem(LOCAL_STORAGE_DRAFT_KEY)).toBe(quickSplitDraft);
    expect(window.localStorage.getItem(LOCAL_STORAGE_WIZARD_STATE_KEY)).toBe(quickSplitWizard);
    expect(quickSplitStore.getState()).toBe(quickSplitState);
    expect(window.localStorage.getItem(DRAFT_KEY)).toContain('Laksa');
  });

  it('resumes its own draft on the step it was left on', () => {
    renderEditor();
    assignEveryItem();
    screen.getByTestId('save-to-group');

    document.body.innerHTML = '';
    renderEditor({ initial: undefined });

    expect(screen.getByTestId('wizard-step-nav-final')).toHaveAttribute('aria-current', 'step');
  });

  it('cancels from the top bar', () => {
    const { onCancel } = renderEditor();

    fireEvent.click(screen.getByTestId('receipt-editor-cancel-btn'));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('starts from a blank receipt when given none', () => {
    renderEditor({ initial: undefined });

    expect(screen.getByTestId('wizard-step-nav-receipt')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
  });

  it('starts over once its draft is discarded', () => {
    renderEditor();
    assignEveryItem();
    discardReceiptDraft(DRAFT_KEY);

    document.body.innerHTML = '';
    renderEditor({ initial: undefined });

    expect(screen.getByTestId('wizard-step-nav-receipt')).toHaveAttribute('aria-current', 'step');
  });
});
