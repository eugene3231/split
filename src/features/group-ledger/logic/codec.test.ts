import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ChargeState } from '@shared/types';
import type {
  Change,
  EntryId,
  ExpenseEntry,
  LocalDate,
  MemberId,
  OpId,
} from '@features/group-ledger/domain/types';
import {
  confirmedOpSchema,
  groupLogSchema,
  parseChange,
  pendingOpSchema,
} from '@features/group-ledger/logic/codec';

const ana = 'm-ana' as MemberId;
const ben = 'm-ben' as MemberId;

const charge: ChargeState = {
  enabled: false,
  mode: 'percent',
  amountInput: '',
  percentInput: '10',
  detectedConfidence: null,
  detectedSource: null,
};

const receiptExpense: ExpenseEntry = {
  kind: 'expense',
  id: 'e-1' as EntryId,
  title: 'Dinner',
  date: '2026-11-19' as LocalDate,
  currency: 'JPY',
  rate: 0.009,
  owed: { [ana]: 1200, [ben]: 800 },
  payment: { payer: ana, others: { [ben]: 500 } },
  basis: {
    kind: 'receipt',
    receipt: {
      id: 'r-1',
      name: 'Izakaya',
      items: [
        {
          id: 'i-1',
          name: 'Yakitori',
          amountInput: '20.00',
          discountPercentInput: '',
          assignment: { shares: { [ana]: 3, [ben]: 2 }, unassignedShare: 0 },
        },
      ],
      discount: charge,
      serviceCharge: charge,
      gst: charge,
      receiptTotalInput: '20.00',
      roundingInput: '',
      currency: 'JPY',
      exchangeRateOverride: null,
    },
  },
};

const everyKind: Change[] = [
  { kind: 'group.created', name: 'Japan 2026', currency: 'SGD' },
  { kind: 'group.renamed', name: 'Japan' },
  {
    kind: 'member.put',
    member: { id: ana, name: 'Ana', paynowMobile: '91234567', archived: false },
  },
  { kind: 'member.merged', from: ben, into: ana },
  { kind: 'member.claimed', memberId: ana },
  { kind: 'member.claimed', memberId: null },
  { kind: 'entry.put', entry: receiptExpense, base: null },
  {
    kind: 'entry.put',
    entry: {
      kind: 'expense',
      id: 'e-2' as EntryId,
      title: 'Taxi',
      date: '2026-11-19' as LocalDate,
      currency: 'SGD',
      rate: 1,
      owed: { [ana]: 500, [ben]: 0 },
      payment: { payer: ben, others: {} },
      basis: { kind: 'weights', weights: { [ana]: 1 } },
    },
    base: 'op-1' as OpId,
  },
  {
    kind: 'entry.put',
    entry: {
      kind: 'transfer',
      id: 'e-3' as EntryId,
      date: '2026-11-20' as LocalDate,
      from: ben,
      to: ana,
      cents: 1500,
    },
    base: null,
  },
  { kind: 'entry.removed', entryId: 'e-1' as EntryId, base: 'op-1' as OpId },
];

/** Maps keyed by member id, where another key is another member, not another field. */
const RECORDS = new Set(['owed', 'others', 'weights', 'shares']);

/** The payload once for each object in it, with a field this version of Split has never heard of. */
function withAFieldAddedLater(payload: unknown, key = ''): unknown[] {
  if (typeof payload !== 'object' || payload === null || RECORDS.has(key)) return [];
  if (Array.isArray(payload)) {
    return payload.flatMap((item, index) =>
      withAFieldAddedLater(item, key).map((changed) => payload.with(index, changed)),
    );
  }
  return [
    { ...payload, addedLater: 'tip' },
    ...Object.entries(payload).flatMap(([name, value]) =>
      withAFieldAddedLater(value, name).map((changed) => ({ ...payload, [name]: changed })),
    ),
  ];
}

describe('parseChange', () => {
  it.each(everyKind)(
    'cannot read a $kind change that carries a field a newer Split added, at any depth',
    (change) => {
      const newer = withAFieldAddedLater(JSON.parse(JSON.stringify(change)));

      expect(newer.length).toBeGreaterThan(0);
      expect(newer.filter((payload) => parseChange(payload) !== null)).toEqual([]);
    },
  );

  it.each(everyKind)('reads back a $kind change exactly as it was written', (change) => {
    expect(parseChange(JSON.parse(JSON.stringify(change)))).toEqual(change);
  });

  it('reads a change a newer Split wrote as unreadable', () => {
    expect(parseChange({ kind: 'group.archived' })).toBeNull();
  });

  it('refuses an expense nobody owes anything on', () => {
    const entry = { ...receiptExpense, owed: { [ana]: 0, [ben]: 0 } };

    expect(parseChange({ kind: 'entry.put', entry, base: null })).toBeNull();
  });

  it('refuses an expense with fractional or negative cents', () => {
    const fractional = { ...receiptExpense, owed: { [ana]: 10.5 } };
    const negative = { ...receiptExpense, owed: { [ana]: 20, [ben]: -10 } };

    expect(parseChange({ kind: 'entry.put', entry: fractional, base: null })).toBeNull();
    expect(parseChange({ kind: 'entry.put', entry: negative, base: null })).toBeNull();
  });

  it('refuses a payment that lists the payer among the others', () => {
    const entry = { ...receiptExpense, payment: { payer: ana, others: { [ana]: 100 } } };

    expect(parseChange({ kind: 'entry.put', entry, base: null })).toBeNull();
  });

  it('refuses a currency Split does not know and a date that is not a calendar day', () => {
    expect(parseChange({ kind: 'group.created', name: 'Trip', currency: 'XXX' })).toBeNull();
    expect(
      parseChange({
        kind: 'entry.put',
        entry: { ...receiptExpense, date: '19 Nov 2026' },
        base: null,
      }),
    ).toBeNull();
  });

  it('never throws, whatever it is given', () => {
    fc.assert(
      fc.property(fc.anything(), (payload) => {
        expect(() => parseChange(payload)).not.toThrow();
      }),
    );
  });

  it('never throws on something shaped like a change', () => {
    const kinds = fc.constantFrom('group.created', 'member.put', 'entry.put', 'entry.removed');
    fc.assert(
      fc.property(
        fc.record({ kind: kinds, entry: fc.anything(), member: fc.anything() }),
        (payload) => {
          expect(() => parseChange(payload)).not.toThrow();
        },
      ),
    );
  });
});

describe('op schemas', () => {
  it('keeps a confirmed op whose change is unreadable, with a null change', () => {
    const op = confirmedOpSchema.parse({
      id: 'op-9',
      seq: 9,
      at: '2026-11-19T10:00:00.000Z',
      change: { kind: 'group.archived' },
      userId: 'u-1',
    });

    expect(op).toEqual({
      id: 'op-9',
      seq: 9,
      at: '2026-11-19T10:00:00.000Z',
      change: null,
      userId: 'u-1',
    });
  });

  it('refuses a confirmed op without a seq', () => {
    const parsed = confirmedOpSchema.safeParse({ id: 'op-9', at: '', change: null, userId: 'u-1' });

    expect(parsed.success).toBe(false);
  });

  it('refuses a pending op whose change is unreadable, since this phone wrote it', () => {
    const parsed = pendingOpSchema.safeParse({
      id: 'op-1',
      order: 1,
      at: '2026-11-19T10:00:00.000Z',
      change: { kind: 'group.archived' },
    });

    expect(parsed.success).toBe(false);
  });

  it('reads a whole group log', () => {
    const log = groupLogSchema.parse({
      groupId: 'g-1',
      inviteCode: 'code',
      confirmed: [{ id: 'op-1', seq: 1, at: 't', change: everyKind[0], userId: 'u-1' }],
      pending: [{ id: 'op-2', order: 1, at: 't', change: everyKind[1] }],
    });

    expect(log.confirmed[0].change).toEqual({
      kind: 'group.created',
      name: 'Japan 2026',
      currency: 'SGD',
    });
    expect(log.pending[0].change).toEqual({ kind: 'group.renamed', name: 'Japan' });
  });
});
