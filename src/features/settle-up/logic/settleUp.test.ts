import { describe, expect, it } from 'vitest';
import type { Person } from '@shared/types';
import {
  formatSettleUpText,
  getTransferKey,
  resolveBalances,
  resolveTransfers,
  type SettleUpReceipt,
} from './settleUp';

const people: Person[] = [
  { id: 'ana', name: 'Ana' },
  { id: 'ben', name: 'Ben' },
  { id: 'cai', name: 'Cai' },
  { id: 'dee', name: 'Dee' },
];

const dinner: SettleUpReceipt = {
  id: 'dinner',
  name: 'Dinner',
  owedByPersonCents: { ana: 3000, ben: 3000, cai: 3000, dee: 3000 },
};
const taxi: SettleUpReceipt = {
  id: 'taxi',
  name: 'Taxi',
  owedByPersonCents: { ana: 1000, ben: 1000, cai: 0, dee: 0 },
};

describe('resolveBalances', () => {
  it('credits the payer with the whole receipt and debits everyone their share', () => {
    const balances = resolveBalances(people, [dinner], { dinner: 'ana' });

    expect(balances).toEqual([
      { personId: 'ana', paidCents: 12000, owedCents: 3000, netCents: 9000 },
      { personId: 'ben', paidCents: 0, owedCents: 3000, netCents: -3000 },
      { personId: 'cai', paidCents: 0, owedCents: 3000, netCents: -3000 },
      { personId: 'dee', paidCents: 0, owedCents: 3000, netCents: -3000 },
    ]);
  });

  it('leaves receipts without a payer out of every balance', () => {
    const balances = resolveBalances(people, [dinner, taxi], { taxi: 'cai' });

    expect(balances.map((b) => b.netCents)).toEqual([-1000, -1000, 2000, 0]);
  });

  it('nets out a person who paid one receipt and owes on another', () => {
    const balances = resolveBalances(people, [dinner, taxi], { dinner: 'ana', taxi: 'ben' });

    expect(balances.map((b) => b.netCents)).toEqual([8000, -2000, -3000, -3000]);
  });
});

describe('resolveTransfers', () => {
  it('sends every debtor straight to the single creditor', () => {
    const transfers = resolveTransfers(resolveBalances(people, [dinner], { dinner: 'ana' }));

    expect(transfers).toEqual([
      { fromPersonId: 'ben', toPersonId: 'ana', amountCents: 3000 },
      { fromPersonId: 'cai', toPersonId: 'ana', amountCents: 3000 },
      { fromPersonId: 'dee', toPersonId: 'ana', amountCents: 3000 },
    ]);
  });

  it('cancels out two people who each paid for the other', () => {
    const lunch: SettleUpReceipt = {
      id: 'lunch',
      name: 'Lunch',
      owedByPersonCents: { ana: 500, ben: 500 },
    };
    const coffee: SettleUpReceipt = {
      id: 'coffee',
      name: 'Coffee',
      owedByPersonCents: { ana: 500, ben: 500 },
    };

    const transfers = resolveTransfers(
      resolveBalances(people, [lunch, coffee], { lunch: 'ana', coffee: 'ben' }),
    );

    expect(transfers).toEqual([]);
  });

  it('settles a multi-payer trip in fewer transfers than people', () => {
    const transfers = resolveTransfers(
      resolveBalances(people, [dinner, taxi], { dinner: 'ana', taxi: 'ben' }),
    );

    expect(transfers).toEqual([
      { fromPersonId: 'cai', toPersonId: 'ana', amountCents: 3000 },
      { fromPersonId: 'dee', toPersonId: 'ana', amountCents: 3000 },
      { fromPersonId: 'ben', toPersonId: 'ana', amountCents: 2000 },
    ]);
  });

  it('moves exactly the outstanding amount when balances split across creditors', () => {
    const balances = [
      { personId: 'ana', paidCents: 0, owedCents: 0, netCents: 701 },
      { personId: 'ben', paidCents: 0, owedCents: 0, netCents: 299 },
      { personId: 'cai', paidCents: 0, owedCents: 0, netCents: -1000 },
    ];

    expect(resolveTransfers(balances)).toEqual([
      { fromPersonId: 'cai', toPersonId: 'ana', amountCents: 701 },
      { fromPersonId: 'cai', toPersonId: 'ben', amountCents: 299 },
    ]);
  });
});

describe('getTransferKey', () => {
  it('changes when the amount between the same two people changes', () => {
    const before = getTransferKey({ fromPersonId: 'ben', toPersonId: 'ana', amountCents: 3000 });
    const after = getTransferKey({ fromPersonId: 'ben', toPersonId: 'ana', amountCents: 2500 });

    expect(before).not.toBe(after);
  });
});

describe('formatSettleUpText', () => {
  it('lists one line per transfer for pasting into a group chat', () => {
    const text = formatSettleUpText(people, [
      { fromPersonId: 'ben', toPersonId: 'ana', amountCents: 3000 },
      { fromPersonId: 'cai', toPersonId: 'ana', amountCents: 1250 },
    ]);

    expect(text).toBe('Settle up\nBen pays Ana $30.00\nCai pays Ana $12.50');
  });

  it('says everyone is square when nobody owes anything', () => {
    expect(formatSettleUpText(people, [])).toBe('Everyone is square.');
  });
});
