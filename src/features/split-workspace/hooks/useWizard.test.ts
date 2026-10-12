import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditableItem, Person, Receipt } from '@shared/types';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import {
  LOCAL_STORAGE_WIZARD_STATE_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { resolveWizardStep } from '../logic/wizardState';
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
    roundingInput: '',
    currency: 'SGD',
    exchangeRateOverride: null,
  };
}

describe('useWizard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGeminiStore.setState({
      geminiApiKeyInput: 'test-key',
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
    useScanStore.setState({ scanStateByReceipt: {} });
  });

  function renderWizard(receipts: Receipt[], activeReceiptId = receipts[0].id) {
    return renderHook(() =>
      useWizard(
        receipts.find((receipt) => receipt.id === activeReceiptId)?.items ?? [],
        people,
        vi.fn(),
        receipts,
      ),
    );
  }

  it('starts claiming with the first person when entering from the receipt step', () => {
    saveWizardState({ step: 'receipt', activePersonId: 'p2' });
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    act(() => result.current.handleNext());

    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p1');
    expect(result.current.continueLabel).toBe('Next: Bob');
  });

  it('moves to the next person, then the summary once everything is claimed', () => {
    saveWizardState({ step: 'items', activePersonId: 'p1' });
    const { result } = renderWizard([makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])]);

    act(() => result.current.handleNext());
    expect(result.current.activePersonId).toBe('p2');
    expect(result.current.activeStep).toBe('items');
    expect(result.current.continueLabel).toBe('See summary');

    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe('final');
  });

  it('splits leftovers on every receipt evenly from the last person, then shows the summary', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2' });
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2', 'i3'])];
    receipts[0].items[0].assignment.personIds = [];
    receipts[1].items[1].assignment.personIds = [];
    useReceiptStore.setState({ people, receipts, activeReceiptId: 'r1' });

    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(state.receipts[0].items, state.people, vi.fn(), state.receipts);
    });

    expect(result.current.canContinue).toBe(true);
    expect(result.current.stepReachability.final).toBe(false);
    expect(result.current.continueLabel).toBe('Split 2 left evenly');

    act(() => result.current.handleNext());

    const state = useReceiptStore.getState();
    expect(state.receipts[0].items[0].assignment.personIds).toEqual(['p1', 'p2']);
    expect(state.receipts[1].items[1].assignment.personIds).toEqual(['p1', 'p2']);
    expect(result.current.activeStep).toBe('final');
  });

  it('falls back to the first person when the saved person was removed', () => {
    saveWizardState({ step: 'items', activePersonId: 'gone' });
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    expect(result.current.activePersonId).toBe('p1');
  });

  it('loads an item-by-item save on the claim step without crashing', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_WIZARD_STATE_KEY,
      JSON.stringify({ version: 1, step: 'items', itemsSubPhase: 'review', activeItemIndex: 4 }),
    );
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p1');
    expect(loadWizardState()).toEqual({ version: 1, step: 'items', activePersonId: 'p1' });
  });

  it('goes back from the summary to the last person, through each person, then to the receipt', () => {
    saveWizardState({ step: 'final', activePersonId: 'p2' });
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    act(() => result.current.handleBack());
    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p2');

    act(() => result.current.handleBack());
    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p1');

    act(() => result.current.handleBack());
    expect(result.current.activeStep).toBe('receipt');
  });

  it('keeps a blank row on another receipt from completing an unassigned purchase', () => {
    saveWizardState({ step: 'items', activePersonId: 'p1' });
    const receipts = [makeReceipt('r1', ['meal']), makeReceipt('r2', ['blank'])];
    receipts[0].items[0].assignment.personIds = [];
    receipts[1].items[0].amountInput = '';

    const { result } = renderWizard(receipts);

    expect(result.current.stepReachability.final).toBe(false);
    act(() => result.current.handleStepSelect('final'));
    expect(result.current.activeStep).toBe('items');
  });

  it('evicts a restored summary with an unassigned purchase and an assigned blank row', () => {
    saveWizardState({ step: 'final', activePersonId: 'p1' });
    const receipts = [makeReceipt('r1', ['meal', 'blank'])];
    receipts[0].items[0].assignment.personIds = [];
    receipts[0].items[1].amountInput = '';

    const { result } = renderWizard(receipts);

    expect(result.current.activeStep).toBe('items');
    expect(result.current.stepReachability.final).toBe(false);
  });

  it('allows summary after claiming the priced item while a blank claimed row remains', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2' });
    const receipt = makeReceipt('r1', ['i1', 'i2']);
    receipt.items[1].amountInput = '';

    const { result } = renderWizard([receipt]);

    expect(result.current.canContinue).toBe(true);
    expect(result.current.stepReachability.final).toBe(true);
    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe('final');
  });

  it('blocks summary when only the blank row is claimed', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2' });
    const receipt = makeReceipt('r1', ['i1', 'i2']);
    receipt.items[0].assignment.personIds = [];
    receipt.items[1].amountInput = '';

    const { result } = renderWizard([receipt]);

    expect(result.current.stepReachability.final).toBe(false);
    act(() => result.current.handleStepSelect('final'));
    expect(result.current.activeStep).toBe('items');
  });

  it('starts an initialized blank split and resets navigation without changing Gemini settings', () => {
    saveWizardState({ step: 'final', activePersonId: 'p2' });
    useReceiptStore.setState({
      initialized: true,
      people,
      receipts: [makeReceipt('r1', ['meal'])],
      activeReceiptId: 'r1',
      peopleInput: 'Unsubmitted person',
      payerMobile: '91234567',
    });
    useScanStore.getState().startScan('r1');
    useGeminiStore.setState({ showApiKeyModal: true });
    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(
        state.receipts.find((receipt) => receipt.id === state.activeReceiptId)?.items ?? [],
        state.people,
        state.normalizeItems,
        state.receipts,
      );
    });

    act(() => result.current.handleResetSplit());

    const state = useReceiptStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.people).toEqual([]);
    expect(state.peopleInput).toBe('');
    expect(state.payerMobile).toBe('');
    expect(state.receipts).toHaveLength(1);
    expect(state.receipts[0].id).not.toBe('r1');
    expect(state.activeReceiptId).toBe(state.receipts[0].id);
    expect(state.receipts[0].items[0].amountInput).toBe('');
    expect(state.receipts[0].currency).toBe('SGD');
    expect(result.current.activeStep).toBe('people');
    expect(loadWizardState()).toEqual({ version: 1, step: 'people', activePersonId: '' });
    expect(useScanStore.getState().scanStateByReceipt).toEqual({});
    expect(useGeminiStore.getState().geminiApiKeyInput).toBe('test-key');
    expect(useGeminiStore.getState().geminiModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(useGeminiStore.getState().showApiKeyModal).toBe(false);
  });
});

describe('resolveWizardStep', () => {
  it('evicts final when any receipt has an unassigned item, even if the active receipt is valid', () => {
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    receipts[1].items[0].assignment.personIds = [];

    expect(
      resolveWizardStep(
        'final',
        receipts[0].items,
        receipts.flatMap((receipt) => receipt.items),
        people,
      ),
    ).toBe('items');
  });

  it('keeps final when every receipt is assigned', () => {
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];

    expect(
      resolveWizardStep(
        'final',
        receipts[0].items,
        receipts.flatMap((receipt) => receipt.items),
        people,
      ),
    ).toBe('final');
  });
});
