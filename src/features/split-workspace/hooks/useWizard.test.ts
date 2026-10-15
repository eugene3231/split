import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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
import { NOBODY, equalShares } from '@features/split-workspace/logic/assignment';

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
    assignment: equalShares(['p1', 'p2']),
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
    useReceiptStore.getState().resetSplit();
    useScanStore.setState({ scanStateByReceipt: {} });
  });

  function renderWizard(receipts: Receipt[], activeReceiptId = receipts[0].id) {
    return renderHook(() =>
      useWizard(
        receipts.find((receipt) => receipt.id === activeReceiptId)?.items ?? [],
        people,
        receipts,
      ),
    );
  }

  it('starts claiming with the first person when entering from the receipt step', () => {
    saveWizardState({ step: 'receipt', activePersonId: 'p2', assignMode: 'person' });
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    act(() => result.current.handleNext());

    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p1');
    expect(result.current.continueLabel).toBe('Next: Bob');
  });

  it('moves to the next person, then the summary once everything is claimed', () => {
    saveWizardState({ step: 'items', activePersonId: 'p1', assignMode: 'person' });
    const { result } = renderWizard([makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])]);

    act(() => result.current.handleNext());
    expect(result.current.activePersonId).toBe('p2');
    expect(result.current.activeStep).toBe('items');
    expect(result.current.continueLabel).toBe('See summary');

    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe('final');
  });

  it('splits leftovers on every receipt evenly from the last person, then shows the summary', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'person' });
    const receipts: [Receipt, Receipt] = [
      makeReceipt('r1', ['i1']),
      makeReceipt('r2', ['i2', 'i3']),
    ];
    receipts[0].items[0].assignment = NOBODY;
    receipts[1].items[1].assignment = NOBODY;
    useReceiptStore.setState({ people, receipts, activeReceiptId: 'r1' });

    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(state.receipts[0].items, state.people, state.receipts);
    });

    expect(result.current.canContinue).toBe(true);
    expect(result.current.stepReachability.final).toBe(false);
    expect(result.current.continueLabel).toBe('Split 2 left evenly');

    act(() => result.current.handleNext());

    expect(result.current.activeStep).toBe('items');
    expect(result.current.leftoversToSplit?.map((item) => item.id)).toEqual(['i1', 'i3']);
    expect(useReceiptStore.getState().receipts[0].items[0].assignment).toEqual(NOBODY);

    act(() => result.current.confirmSplitLeftovers());

    const state = useReceiptStore.getState();
    expect(state.receipts[0].items[0].assignment).toEqual(equalShares(['p1', 'p2']));
    expect(state.receipts[1].items[1].assignment).toEqual(equalShares(['p1', 'p2']));
    expect(result.current.activeStep).toBe('final');
  });

  it('leaves leftovers alone and stays on the last person when the split is cancelled', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2' });
    const receipts: [Receipt] = [makeReceipt('r1', ['i1'])];
    receipts[0].items[0].assignment = NOBODY;
    useReceiptStore.setState({ people, receipts, activeReceiptId: 'r1' });

    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(state.receipts[0].items, state.people, state.receipts);
    });

    act(() => result.current.handleNext());
    act(() => result.current.cancelSplitLeftovers());

    expect(result.current.leftoversToSplit).toBeNull();
    expect(result.current.activeStep).toBe('items');
    expect(result.current.activePersonId).toBe('p2');
    expect(useReceiptStore.getState().receipts[0].items[0].assignment).toEqual(NOBODY);
  });

  it('falls back to the first person when the saved person was removed', () => {
    saveWizardState({ step: 'items', activePersonId: 'gone', assignMode: 'person' });
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
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'items',
      activePersonId: 'p1',
      assignMode: 'person',
    });
  });

  it('goes back from the summary to the last person, through each person, then to the receipt', () => {
    saveWizardState({ step: 'final', activePersonId: 'p2', assignMode: 'person' });
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

  it('assigns by item without stepping through people, and goes back to the receipt', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'item' });
    const receipts: [Receipt] = [makeReceipt('r1', ['i1', 'i2'])];
    receipts[0].items[1].assignment = NOBODY;
    useReceiptStore.setState({ people, receipts, activeReceiptId: 'r1' });
    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(state.receipts[0].items, state.people, state.receipts);
    });

    expect(result.current.assignMode).toBe('item');
    expect(result.current.continueLabel).toBe('Split 1 left evenly');

    act(() => result.current.handleBack());
    expect(result.current.activeStep).toBe('receipt');

    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe('items');
    expect(result.current.assignMode).toBe('item');

    act(() => result.current.handleNext());
    expect(useReceiptStore.getState().receipts[0].items[1].assignment).toEqual(
      equalShares(['p1', 'p2']),
    );
    expect(result.current.activeStep).toBe('final');
  });

  it('switches to by person for the person picked while assigning by item', () => {
    saveWizardState({ step: 'items', activePersonId: 'p1', assignMode: 'item' });
    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);

    act(() => result.current.selectPerson('p2'));

    expect(result.current.assignMode).toBe('person');
    expect(result.current.activePersonId).toBe('p2');
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'items',
      activePersonId: 'p2',
      assignMode: 'person',
    });
  });

  it('remembers the assign mode across a reload and a reset', () => {
    const first = renderWizard([makeReceipt('r1', ['i1'])]);
    act(() => first.result.current.setAssignMode('item'));
    first.unmount();

    const { result } = renderWizard([makeReceipt('r1', ['i1'])]);
    expect(result.current.assignMode).toBe('item');

    act(() => result.current.handleResetSplit());
    expect(result.current.assignMode).toBe('item');
    expect(loadWizardState()?.assignMode).toBe('item');
  });

  it('keeps a blank row on another receipt from completing an unassigned purchase', () => {
    saveWizardState({ step: 'items', activePersonId: 'p1', assignMode: 'person' });
    const receipts = [makeReceipt('r1', ['meal']), makeReceipt('r2', ['blank'])];
    receipts[0].items[0].assignment = NOBODY;
    receipts[1].items[0].amountInput = '';

    const { result } = renderWizard(receipts);

    expect(result.current.stepReachability.final).toBe(false);
    act(() => result.current.handleStepSelect('final'));
    expect(result.current.activeStep).toBe('items');
  });

  it('evicts a restored summary with an unassigned purchase and an assigned blank row', () => {
    saveWizardState({ step: 'final', activePersonId: 'p1', assignMode: 'person' });
    const receipts = [makeReceipt('r1', ['meal', 'blank'])];
    receipts[0].items[0].assignment = NOBODY;
    receipts[0].items[1].amountInput = '';

    const { result } = renderWizard(receipts);

    expect(result.current.activeStep).toBe('items');
    expect(result.current.stepReachability.final).toBe(false);
  });

  it('allows summary after claiming the priced item while a blank claimed row remains', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'person' });
    const receipt = makeReceipt('r1', ['i1', 'i2']);
    receipt.items[1].amountInput = '';

    const { result } = renderWizard([receipt]);

    expect(result.current.canContinue).toBe(true);
    expect(result.current.stepReachability.final).toBe(true);
    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe('final');
  });

  it('blocks summary when only the blank row is claimed', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'person' });
    const receipt = makeReceipt('r1', ['i1', 'i2']);
    receipt.items[0].assignment = NOBODY;
    receipt.items[1].amountInput = '';

    const { result } = renderWizard([receipt]);

    expect(result.current.stepReachability.final).toBe(false);
    act(() => result.current.handleStepSelect('final'));
    expect(result.current.activeStep).toBe('items');
  });

  it('starts a blank split and resets navigation without changing Gemini settings', () => {
    saveWizardState({ step: 'final', activePersonId: 'p2', assignMode: 'person' });
    useReceiptStore.setState({
      people,
      receipts: [makeReceipt('r1', ['meal'])],
      activeReceiptId: 'r1',
      payerMobile: '91234567',
    });
    useScanStore.getState().startScan('r1');
    useGeminiStore.setState({ showApiKeyModal: true });
    const { result } = renderHook(() => {
      const state = useReceiptStore();
      return useWizard(
        state.receipts.find((receipt) => receipt.id === state.activeReceiptId)?.items ?? [],
        state.people,
        state.receipts,
      );
    });

    act(() => result.current.handleResetSplit());

    const state = useReceiptStore.getState();
    expect(state.people).toEqual([]);
    expect(state.payerMobile).toBe('');
    expect(state.receipts).toHaveLength(1);
    expect(state.receipts[0].id).not.toBe('r1');
    expect(state.activeReceiptId).toBe(state.receipts[0].id);
    expect(state.receipts[0].items[0].amountInput).toBe('');
    expect(state.receipts[0].currency).toBe('SGD');
    expect(result.current.activeStep).toBe('people');
    expect(loadWizardState()).toEqual({
      version: 1,
      step: 'people',
      activePersonId: '',
      assignMode: 'person',
    });
    expect(useScanStore.getState().scanStateByReceipt).toEqual({});
    expect(useGeminiStore.getState().geminiApiKeyInput).toBe('test-key');
    expect(useGeminiStore.getState().geminiModel).toBe(DEFAULT_GEMINI_MODEL);
    expect(useGeminiStore.getState().showApiKeyModal).toBe(false);
  });
});

describe('resolveWizardStep', () => {
  it('evicts final when any receipt has an unassigned item, even if the active receipt is valid', () => {
    const receipts = [makeReceipt('r1', ['i1']), makeReceipt('r2', ['i2'])];
    receipts[1].items[0].assignment = NOBODY;

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
