import { describe, expect, it } from 'vitest';
import {
  amountsLeft,
  blankDraft,
  changePaidBy,
  changeSplitKind,
  checkExpense,
  draftFromEntry,
  formMembers,
  groupRate,
  rateInput,
  receiptRate,
  TOO_BIG,
  type ExpenseDraft,
} from './expenseForm';
import { asEntryId, asLocalDate } from './ids';
import { postReceipt } from './post';
import { ana, ben, cat, makeExpense, makeMember } from './testHelpers';
import { makeItem, makeReceipt } from '../../../tests/integration/testHelpers';

const id = asEntryId('e1');
const today = asLocalDate('2026-11-19');
const members = [makeMember(ana), makeMember(ben), makeMember(cat, { archived: true })];

function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return { ...blankDraft(members, ana, 'SGD', today), amount: '30', title: 'Dinner', ...overrides };
}

function reasonFor(overrides: Partial<ExpenseDraft>): string | null {
  const check = checkExpense(draft(overrides), id, 'SGD');
  return check.ok ? null : check.reason;
}

describe('checkExpense', () => {
  it('splits a blank draft evenly between the members not archived, paid by the one given', () => {
    const check = checkExpense(draft(), id, 'SGD');

    expect(check.ok && check.entry.owed).toEqual({ [ana]: 1500, [ben]: 1500 });
    expect(check.ok && check.entry.payment).toEqual({ payer: ana, others: {} });
    expect(check.ok && check.entry.basis).toEqual({
      kind: 'weights',
      weights: { [ana]: 1, [ben]: 1 },
    });
  });

  it('names the first thing missing, in the order the form reads', () => {
    expect(reasonFor({ amount: '' })).toBe('Enter an amount');
    expect(reasonFor({ amount: '-4' })).toBe('Enter an amount');
    expect(reasonFor({ title: '  ' })).toBe('Say what it was for');
    expect(reasonFor({ currency: 'USD', rate: '' })).toBe('Enter the exchange rate');
    expect(reasonFor({ splitBy: { kind: 'evenly', between: [] } })).toBe(
      'Pick who to split it between',
    );
    expect(reasonFor({ splitBy: { kind: 'shares', weights: { [ana]: 0 } } })).toBe(
      'Give someone a share',
    );
  });

  it('freezes the typed rate for another currency, and 1 for the group currency', () => {
    const usd = checkExpense(draft({ currency: 'USD', rate: '1.35' }), id, 'SGD');
    const sgd = checkExpense(draft({ rate: '9' }), id, 'SGD');

    expect(usd.ok && usd.entry.rate).toBe(1.35);
    expect(sgd.ok && sgd.entry.rate).toBe(1);
  });

  it('splits by share weights', () => {
    const check = checkExpense(
      draft({ splitBy: { kind: 'shares', weights: { [ana]: 2, [ben]: 1 } } }),
      id,
      'SGD',
    );

    expect(check.ok && check.entry.owed).toEqual({ [ana]: 2000, [ben]: 1000 });
  });

  it('takes typed amounts only once they add up to the total, saying how far off they are', () => {
    const amounts = (a: string, b: string) => ({
      splitBy: { kind: 'amounts' as const, amounts: { [ana]: a, [ben]: b } },
    });

    expect(reasonFor(amounts('10', '5'))).toBe('$15.00 left to split');
    expect(reasonFor(amounts('20', '15'))).toBe('Split $5.00 too much');
    const check = checkExpense(draft(amounts('12.50', '17.50')), id, 'SGD');
    expect(check.ok && check.entry.owed).toEqual({ [ana]: 1250, [ben]: 1750 });
  });

  it('makes whoever paid most the payer when several people paid', () => {
    const several = (a: string, b: string) => ({
      paidBy: { kind: 'several' as const, amounts: { [ana]: a, [ben]: b } },
    });

    expect(reasonFor(several('', ''))).toBe('Enter who paid what');
    expect(reasonFor(several('10', '5'))).toBe('$15.00 still unpaid');
    expect(reasonFor(several('20', '20'))).toBe('Paid $10.00 too much');
    const check = checkExpense(draft(several('10', '20')), id, 'SGD');
    expect(check.ok && check.entry.payment).toEqual({ payer: ben, others: { [ana]: 1000 } });
  });
});

describe('draftFromEntry', () => {
  it('reopens an even split as an even split paid by one person', () => {
    const check = checkExpense(draft({ amount: '1,234.50' }), id, 'SGD');
    if (!check.ok) throw new Error(check.reason);

    expect(draftFromEntry(check.entry)).toEqual(draft({ amount: '1,234.50' }));
  });

  it('reopens typed amounts and several payers as typed amounts', () => {
    const entry = makeExpense(
      'lunch',
      { [ana]: 1000, [ben]: 2000 },
      { payer: ana, others: { [ben]: 500 }, title: 'Lunch' },
    );

    const reopened = draftFromEntry(entry);

    expect(reopened.paidBy).toEqual({
      kind: 'several',
      amounts: { [ben]: '5.00', [ana]: '25.00' },
    });
    expect(reopened.splitBy).toEqual({
      kind: 'amounts',
      amounts: { [ana]: '10.00', [ben]: '20.00' },
    });
    expect(checkExpense(reopened, entry.id, 'SGD')).toMatchObject({
      ok: true,
      entry: { owed: entry.owed },
    });
  });

  it('reopens uneven share weights as shares', () => {
    const check = checkExpense(
      draft({ splitBy: { kind: 'shares', weights: { [ana]: 3, [ben]: 1 } } }),
      id,
      'SGD',
    );
    if (!check.ok) throw new Error(check.reason);

    expect(draftFromEntry(check.entry).splitBy).toEqual({
      kind: 'shares',
      weights: { [ana]: 3, [ben]: 1 },
    });
  });

  it('reopens an itemised receipt as the amounts it came to', () => {
    const receipt = makeReceipt({
      items: [
        makeItem({ amountInput: '8.00', assignment: { shares: { [ana]: 1 }, unassignedShare: 0 } }),
      ],
    });
    const entry = postReceipt(
      {
        id,
        title: 'Cafe',
        date: today,
        currency: 'SGD',
        rate: 1,
        payment: { payer: ana, others: {} },
      },
      receipt,
      [makeMember(ana)],
    );
    if (entry === null) throw new Error('receipt did not post');

    expect(draftFromEntry(entry).splitBy).toEqual({ kind: 'amounts', amounts: { [ana]: '8.00' } });
  });
});

describe('rateInput', () => {
  it('reads group units per unit of the expense currency from rates kept against SGD', () => {
    expect(rateInput('USD', 'SGD', { USD: 1.35, SGD: 1 })).toBe('1.35');
    expect(rateInput('SGD', 'USD', { USD: 1.25, SGD: 1 })).toBe('0.8');
    expect(rateInput('SGD', 'SGD', {})).toBe('1');
  });
});

describe('groupRate', () => {
  it('lets a rate typed on a receipt win over the live one', () => {
    expect(groupRate('USD', 'SGD', { USD: 1.35, SGD: 1 }, 1.4)).toBe(1.4);
    expect(groupRate('USD', 'EUR', { USD: 1.35, EUR: 1.5, SGD: 1 })).toBe(0.9);
    expect(groupRate('USD', 'USD', {}, 9)).toBe(1);
  });
});

describe('receiptRate', () => {
  const rates = { USD: 1.35, SGD: 1 };
  const saved = { currency: 'USD' as const, override: null, rate: 1.3 };

  it('keeps the rate a receipt was saved with when its currency and typed rate are unchanged', () => {
    expect(receiptRate({ currency: 'USD', override: null }, 'SGD', rates, saved)).toBe(1.3);
  });

  it('takes a new rate once the currency or the typed rate changes', () => {
    expect(receiptRate({ currency: 'USD', override: 1.4 }, 'SGD', rates, saved)).toBe(1.4);
    expect(receiptRate({ currency: 'SGD', override: null }, 'SGD', rates, saved)).toBe(1);
    expect(receiptRate({ currency: 'USD', override: null }, 'SGD', rates, null)).toBe(1.35);
  });
});

describe('amountsLeft', () => {
  it('counts blank and unreadable amounts as nothing', () => {
    expect(amountsLeft('20', { [ana]: '5', [ben]: '', [cat]: 'abc' })).toBe(1500);
  });
});

describe('changing how the form splits', () => {
  it('keeps who is in the split when moving between kinds', () => {
    const evenly = { kind: 'evenly' as const, between: [ana, ben] };

    const shares = changeSplitKind(evenly, 'shares');
    expect(shares).toEqual({ kind: 'shares', weights: { [ana]: 1, [ben]: 1 } });
    expect(changeSplitKind(evenly, 'amounts')).toEqual({
      kind: 'amounts',
      amounts: { [ana]: '', [ben]: '' },
    });
    expect(changeSplitKind({ kind: 'shares', weights: { [ana]: 2, [ben]: 0 } }, 'evenly')).toEqual({
      kind: 'evenly',
      between: [ana],
    });
    expect(
      changeSplitKind({ kind: 'amounts', amounts: { [ben]: '4', [ana]: '' } }, 'evenly'),
    ).toEqual({ kind: 'evenly', between: [ben] });
    expect(changeSplitKind(evenly, 'evenly')).toBe(evenly);
  });

  it('hands the whole amount to the one payer when several paid, and back to whoever paid most', () => {
    const several = changePaidBy(draft(), true);
    expect(several).toEqual({ kind: 'several', amounts: { [ana]: '30' } });

    expect(
      changePaidBy(
        draft({ paidBy: { kind: 'several', amounts: { [ana]: '5', [ben]: '25' } } }),
        false,
      ),
    ).toEqual({ kind: 'one', payer: ben });
    expect(changePaidBy(draft(), false)).toEqual({ kind: 'one', payer: ana });
  });

  it('offers archived members only when the draft already names them', () => {
    expect(formMembers(members, draft()).map((member) => member.id)).toEqual([ana, ben]);
    expect(
      formMembers(members, draft({ splitBy: { kind: 'evenly', between: [cat] } })).map(
        (member) => member.id,
      ),
    ).toEqual([ana, ben, cat]);
  });
});

describe('entries too big to sync', () => {
  it('refuses an expense the server would drop, and says so', () => {
    const huge = draft({ title: 'x'.repeat(70_000) });

    expect(checkExpense(huge, id, 'SGD')).toEqual({ ok: false, reason: TOO_BIG });
  });
});
