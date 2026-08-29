import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditableItem, Person, Receipt } from '@shared/types';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { saveWizardState } from '@features/split-workspace/logic/persistence';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { resolveWizardState } from '../logic/wizardState';
import { useWizard } from './useWizard';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

function makeItem(id: string): EditableItem {
  return {
    id,
    name: `Item ${id}`,
    amountInput: '10.00',
    discountPercentInput: '',
    assignment: {
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2'],
    },
  };
}

function makeReceipt(id: string, itemIds: string[]): Receipt {
  return {
    id,
    name: `Receipt ${id}`,
    items: itemIds.map(makeItem),
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
  };
}

describe('useWizard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGeminiStore.setState({
      geminiApiKeyInput: 'test-key',
      rememberGeminiApiKey: false,
      geminiModel: DEFAULT_GEMINI_MODEL,
      showApiKeyModal: false,
    });
    useReceiptStore.setState({
      peopleInput: '',
      initialized: true,
      people: [],
      receipts: [],
      activeReceiptId: '',
      payerMobile: '',
    });
  });

  it('advances to the next receipt before entering review, then enters review on the last receipt', () => {
    saveWizardState({ step: 'items', itemsSubPhase: 'assign', activeItemIndex: 0 });

    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    let activeReceiptId = 'r1';
    const setActiveReceiptId = vi.fn((nextId: string) => {
      activeReceiptId = nextId;
    });

    const { result, rerender } = renderHook(() =>
      useWizard(
        receipts.find((receipt) => receipt.id === activeReceiptId)?.items ?? [],
        people,
        vi.fn(),
        receipts,
        activeReceiptId,
        setActiveReceiptId,
      ),
    );

    act(() => {
      result.current.handleNext();
    });

    expect(setActiveReceiptId).toHaveBeenCalledWith('r2');
    expect(result.current.itemsSubPhase).toBe('assign');
    expect(result.current.safeActiveItemIndex).toBe(0);

    rerender();

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.itemsSubPhase).toBe('review');
  });

  it('blocks review continuation while any receipt has an unassigned item', () => {
    saveWizardState({ step: 'items', itemsSubPhase: 'assign', activeItemIndex: 0 });

    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    receipts[1].items[0].assignment.personIds = [];
    const activeReceiptId = 'r1';

    const { result } = renderHook(() =>
      useWizard(receipts[0].items, people, vi.fn(), receipts, activeReceiptId, vi.fn()),
    );

    act(() => {
      result.current.setItemsSubPhase('review');
    });

    expect(result.current.canContinue).toBe(false);
    expect(result.current.stepReachability.final).toBe(false);
    expect(result.current.canContinue).toBe(result.current.stepReachability.final);

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.activeStep).toBe('items');
  });

  it('allows review continuation once every receipt is assigned', () => {
    saveWizardState({ step: 'items', itemsSubPhase: 'assign', activeItemIndex: 0 });

    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    const activeReceiptId = 'r1';

    const { result } = renderHook(() =>
      useWizard(receipts[0].items, people, vi.fn(), receipts, activeReceiptId, vi.fn()),
    );

    act(() => {
      result.current.setItemsSubPhase('review');
    });

    expect(result.current.canContinue).toBe(true);
    expect(result.current.stepReachability.final).toBe(true);

    act(() => {
      result.current.handleNext();
    });

    expect(result.current.activeStep).toBe('final');
  });
});

describe('resolveWizardState', () => {
  it('evicts final when any receipt has an unassigned item, even if the active receipt is valid', () => {
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    receipts[1].items[0].assignment.personIds = [];

    const resolved = resolveWizardState(
      'final',
      'review',
      receipts[0].items,
      receipts.flatMap((receipt) => receipt.items),
      people,
    );

    expect(resolved).toEqual({ activeStep: 'items', itemsSubPhase: 'assign' });
  });

  it('keeps final when every receipt is assigned', () => {
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];

    const resolved = resolveWizardState(
      'final',
      'review',
      receipts[0].items,
      receipts.flatMap((receipt) => receipt.items),
      people,
    );

    expect(resolved).toEqual({ activeStep: 'final', itemsSubPhase: 'review' });
  });
});
