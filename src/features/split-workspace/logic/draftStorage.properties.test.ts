import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ChargeState, Receipt } from '@shared/types';
import { CURRENCY_CODES } from '@shared/constants';
import type { WorkspaceState } from '@features/split-workspace/types';
import { makeAssignment } from './assignment';
import { exportDraftToJson, importDraftFromJson } from './draftStorage';

/** What a person could type: a name already trimmed, as the app stores it. */
const nameArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

const inputArb = fc.oneof(
  fc.constant(''),
  fc.integer({ min: 0, max: 99_999 }).map((cents) => (cents / 100).toFixed(2)),
);

const chargeArb: fc.Arbitrary<ChargeState> = fc.record({
  enabled: fc.boolean(),
  mode: fc.constantFrom('percent' as const, 'amount' as const),
  amountInput: inputArb,
  percentInput: fc.integer({ min: 0, max: 30 }).map(String),
  detectedConfidence: fc.option(fc.double({ min: 0, max: 1, noNaN: true })),
  detectedSource: fc.option(fc.string({ maxLength: 10 })),
});

function receiptArb(personIds: string[]): fc.Arbitrary<Omit<Receipt, 'id'>> {
  const item = fc.record({
    name: fc.string({ maxLength: 12 }),
    amountInput: inputArb,
    discountPercentInput: fc.oneof(fc.constant(''), fc.integer({ min: 0, max: 100 }).map(String)),
    assignment: fc
      .tuple(
        personIds.length > 0
          ? fc.dictionary(fc.constantFrom(...personIds), fc.integer({ min: 0, max: 12 }))
          : fc.constant({}),
        fc.integer({ min: 0, max: 6 }),
      )
      .map(([shares, unassignedShare]) => makeAssignment(shares, unassignedShare)),
  });
  return fc.record({
    name: nameArb,
    items: fc
      .array(item, { minLength: 1, maxLength: 5 })
      .map((items) => items.map((value, index) => ({ ...value, id: `i${index}` }))),
    discount: chargeArb,
    serviceCharge: chargeArb,
    gst: chargeArb,
    tip: chargeArb,
    receiptTotalInput: inputArb,
    roundingInput: fc.oneof(fc.constant(''), fc.constantFrom('0.02', '-0.03')),
    currency: fc.constantFrom(...CURRENCY_CODES),
    exchangeRateOverride: fc.option(fc.double({ min: 0.0001, max: 50, noNaN: true })),
  });
}

const workspaceArb: fc.Arbitrary<WorkspaceState> = fc
  .uniqueArray(nameArb, { maxLength: 6, comparator: (a, b) => a.toLowerCase() === b.toLowerCase() })
  .map((names) => names.map((name, index) => ({ id: `p${index}`, name })))
  .chain((people) => {
    const receipt = receiptArb(people.map((person) => person.id));
    return fc
      .tuple(
        receipt,
        fc.array(receipt, { maxLength: 2 }),
        fc.nat(),
        fc.oneof(fc.constant(''), fc.stringMatching(/^[89]\d{7}$/)),
      )
      .map(([first, rest, activeIndex, payerMobile]): WorkspaceState => ({
        people,
        receipts: [
          { ...first, id: 'r0' },
          ...rest.map((receipt, index) => ({ ...receipt, id: `r${index + 1}` })),
        ],
        activeReceiptId: `r${activeIndex % (rest.length + 1)}`,
        payerMobile,
      }));
  });

describe('workspace file invariants', () => {
  it('reads back every workspace it writes, exactly', () => {
    fc.assert(
      fc.property(workspaceArb, (workspace) => {
        const imported = importDraftFromJson(exportDraftToJson(workspace));

        expect(imported).toEqual({
          ...workspace,
          version: 3,
          savedAt: expect.any(String),
        });
      }),
    );
  });
});
