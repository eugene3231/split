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
import {
  exportDraftToJson,
  importDraftFromJson,
} from '@features/split-workspace/logic/draftStorage';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';

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
  it('restores every receipt setting after export and import', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const people = [alice, bob];
    const receipts = [
      makeReceipt({
        id: 'lunch',
        name: 'Lunch',
        items: [
          makeItem({
            id: 'noodles',
            name: 'Noodles',
            amountInput: '10.00',
            discountPercentInput: '50',
            assignment: equalShares([alice.id]),
          }),
          makeItem({
            id: 'platter',
            name: 'Platter',
            amountInput: '30.00',
            assignment: makeAssignment({ [alice.id]: 2, [bob.id]: 1 }),
          }),
        ],
        serviceCharge: percentCharge('10'),
        gst: percentCharge('9'),
        receiptTotalInput: '45.00',
        roundingInput: '0.05',
      }),
      makeReceipt({
        id: 'dinner',
        name: 'Dinner',
        currency: 'USD',
        exchangeRateOverride: 1.5,
        items: [
          makeItem({
            id: 'cake',
            name: 'Cake',
            amountInput: '6.00',
            assignment: makeAssignment({ [alice.id]: 1 }, 1),
          }),
        ],
        discount: amountCharge('5.00'),
        serviceCharge: amountCharge('2.00'),
      }),
    ];
    seedStore(people, receipts, { activeReceiptId: 'dinner' });
    useReceiptStore.getState().setPayerMobile('91234567');
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    const restored = useReceiptStore.getState();
    expect(restored.people).toEqual(people);
    expect(restored.receipts).toEqual(receipts);
    expect(restored.activeReceiptId).toBe('dinner');
    expect(restored.payerMobile).toBe('91234567');
  });

  it('gives a receipt with no items one blank item after import', () => {
    const alice = makePerson('Alice');
    seedStore([alice], [makeReceipt({ id: 'empty', items: [] })]);
    const json = exportDraftToJson(useReceiptStore.getState());

    resetAllStores();
    importWorkspaceJson(json);

    expect(useReceiptStore.getState().receipts[0].items).toEqual([
      {
        id: expect.any(String),
        name: '',
        amountInput: '',
        discountPercentInput: '',
        assignment: NOBODY,
      },
    ]);
  });
});
