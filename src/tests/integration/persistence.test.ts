import { beforeEach, describe, expect, it } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  percentCharge,
  amountCharge,
  makePerson,
  makeItem,
  makeReceipt,
  resetAllStores,
  seedStore,
} from './testHelpers';
import { loadWizardState, saveWizardState } from '@features/split-workspace/logic/persistence';
import {
  exportDraftToJson,
  importDraftFromJson,
} from '@features/split-workspace/logic/draftStorage';
import { equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';

/** What the workspace menu does with a chosen file: parse it, then swap it into the store. */
function importWorkspaceJson(json: string) {
  const draft = importDraftFromJson(json);
  if (!draft) throw new Error('Workspace JSON did not parse');
  useReceiptStore.getState().loadWorkspace(draft);
}

beforeEach(() => {
  resetAllStores();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Persistence integration', () => {
  it('multi-receipt with charges — full state round-trips via store export/import', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
      serviceCharge: percentCharge('10'),
      gst: percentCharge('9'),
    });
    const r2 = makeReceipt({
      items: [
        makeItem({
          amountInput: '20.00',
          assignment: equalShares([alice.id, bob.id]),
        }),
      ],
      discount: amountCharge('5.00'),
    });

    seedStore([alice, bob], [r1, r2]);
    const json = exportDraftToJson(useReceiptStore.getState());
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json);
    expect(parsed.people).toHaveLength(2);
    expect(parsed.receipts).toHaveLength(2);
    expect(parsed.receipts[0].serviceCharge.enabled).toBe(true);
    expect(parsed.receipts[0].serviceCharge.percentInput).toBe('10');
    expect(parsed.receipts[0].gst.enabled).toBe(true);
    expect(parsed.receipts[1].discount.enabled).toBe(true);
    expect(parsed.receipts[1].discount.amountInput).toBe('5.00');

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.people).toHaveLength(2);
    expect(restored.receipts).toHaveLength(2);
    expect(restored.receipts[0].serviceCharge.enabled).toBe(true);
    expect(restored.receipts[1].discount.enabled).toBe(true);
  });

  it('currency overrides survive save/load', () => {
    const alice = makePerson('Alice');
    const r1 = makeReceipt({
      currency: 'USD',
      exchangeRateOverride: 1.5,
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
    });

    seedStore([alice], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].currency).toBe('USD');
    expect(restored.receipts[0].exchangeRateOverride).toBe(1.5);
  });

  it('item-level discount preserves via round-trip', () => {
    const alice = makePerson('Alice');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          discountPercentInput: '50',
          assignment: equalShares([alice.id]),
        }),
      ],
    });

    seedStore([alice], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].items[0].discountPercentInput).toBe('50');
  });

  it('charge mode=amount preserves via round-trip', () => {
    const alice = makePerson('Alice');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
      serviceCharge: amountCharge('5.00'),
    });

    seedStore([alice], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].serviceCharge.enabled).toBe(true);
    expect(restored.receipts[0].serviceCharge.mode).toBe('amount');
    expect(restored.receipts[0].serviceCharge.amountInput).toBe('5.00');
  });

  it('assignments round-trip — the people on each item survive export and import', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
        makeItem({
          amountInput: '20.00',
          assignment: equalShares([alice.id, bob.id]),
        }),
      ],
    });

    seedStore([alice, bob], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].items).toHaveLength(2);
    expect(restored.receipts[0].items[0].assignment).toEqual(equalShares([alice.id]));
    expect(restored.receipts[0].items[1].assignment).toEqual(equalShares([alice.id, bob.id]));
  });

  it('empty items fallback — receipt with no valid items gets a fallback item', () => {
    const alice = makePerson('Alice');
    const r1 = makeReceipt({ items: [] });
    const r2 = makeReceipt({
      items: [
        makeItem({
          amountInput: '5.00',
          assignment: equalShares([alice.id]),
        }),
      ],
    });

    seedStore([alice], [r1, r2], { activeReceiptId: r2.id });

    useReceiptStore.getState().setActiveReceiptId(r1.id);
    const state = useReceiptStore.getState();
    expect(state.receipts.find((r) => r.id === r1.id)!.items).toHaveLength(0);

    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    const restoredR1 = restored.receipts.find((r) => r.id === r1.id)!;
    expect(restoredR1.items.length).toBeGreaterThanOrEqual(1);
  });

  it('weighted assignment survives export/import round-trip', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '30.00',
          assignment: makeAssignment({ [alice.id]: 2, [bob.id]: 1 }),
        }),
      ],
    });

    seedStore([alice, bob], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.receipts[0].items[0].assignment).toEqual(
      makeAssignment({ [alice.id]: 2, [bob.id]: 1 }),
    );
  });

  it('a half-claimed item keeps its unassigned share through export and import', () => {
    const alice = makePerson('Alice');
    const r1 = makeReceipt({
      items: [
        makeItem({
          amountInput: '6.00',
          assignment: makeAssignment({ [alice.id]: 1 }, 1),
        }),
      ],
    });

    seedStore([alice], [r1]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState().receipts[0].items[0].assignment;
    expect(restored).toEqual({ shares: { [alice.id]: 1 }, unassignedShare: 1 });
  });

  it('wizard state persists and restores via localStorage', () => {
    saveWizardState({ step: 'items', activePersonId: 'p2', assignMode: 'person' });
    const loaded = loadWizardState();

    expect(loaded).toEqual({
      version: 1,
      step: 'items',
      activePersonId: 'p2',
      assignMode: 'person',
    });
  });

  it('wizard state handles invalid data gracefully', () => {
    window.localStorage.setItem('split:simple-wizard-state:v1', '{broken json');
    const loaded = loadWizardState();
    expect(loaded).toBeNull();

    window.localStorage.setItem('split:simple-wizard-state:v1', JSON.stringify({ version: 999 }));
    const loaded2 = loadWizardState();
    expect(loaded2).toBeNull();
  });
});
