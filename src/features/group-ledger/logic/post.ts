import { allocateCents } from '@shared/logic/core/allocation';
import { isItemAssigned } from '@features/split-workspace/logic/assignment';
import { resolveDiscountedAmountCents } from '@features/split-workspace/logic/split/pricing';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import type {
  Cents,
  ExpenseBasis,
  ExpenseEntry,
  Member,
  MemberId,
  StoredReceipt,
} from '@features/group-ledger/domain/types';
import { byCodeUnit, memberIdsOf } from '@features/group-ledger/logic/ids';

export type ExpenseHeader = Omit<ExpenseEntry, 'kind' | 'owed' | 'basis'>;

/**
 * An expense of `totalCents` split by share weights. Null until the total is positive and
 * somebody has a weight.
 */
export function postWeights(
  header: ExpenseHeader,
  totalCents: Cents,
  weights: Record<MemberId, number>,
): ExpenseEntry | null {
  const kept = positiveOnly(weights);
  if (totalCents <= 0) return null;
  return post(header, allocateCents(totalCents, memberIdsOf(kept), kept), {
    kind: 'weights',
    weights: kept,
  });
}

/** An expense whose amounts were typed per member. Null until somebody owes something. */
export function postAmounts(
  header: ExpenseHeader,
  owed: Record<MemberId, Cents>,
): ExpenseEntry | null {
  return post(header, owed, { kind: 'amounts' });
}

/**
 * An itemised receipt, split once by `computeSplit`. Null while a priced item is still
 * unassigned, while the receipt comes to nothing, or if rounding leaves somebody owing less
 * than nothing.
 *
 * Pass every member with a share on the receipt, archived ones included: `computeSplit` gives
 * the share of anyone it is not handed to the others on the item.
 */
export function postReceipt(
  header: ExpenseHeader,
  receipt: StoredReceipt,
  members: Member[],
): ExpenseEntry | null {
  const memberIds = new Set<string>(members.map((member) => member.id));
  const unassigned = receipt.items.some(
    (item) => (resolveDiscountedAmountCents(item) ?? 0) > 0 && !isItemAssigned(item, memberIds),
  );
  if (unassigned) return null;

  const split = computeSplit(
    receipt,
    members.map(({ id, name }) => ({ id, name })),
  );
  const owed: Record<MemberId, Cents> = Object.fromEntries(
    members.map((member) => [member.id, split.byPerson[member.id].totalCents]),
  );
  if (Object.values(owed).some((cents) => cents < 0)) return null;
  return post(header, owed, { kind: 'receipt', receipt: storedReceipt(receipt) });
}

function storedReceipt(receipt: StoredReceipt): StoredReceipt {
  return {
    id: receipt.id,
    name: receipt.name,
    items: receipt.items,
    discount: receipt.discount,
    serviceCharge: receipt.serviceCharge,
    gst: receipt.gst,
    receiptTotalInput: receipt.receiptTotalInput,
    roundingInput: receipt.roundingInput,
    currency: receipt.currency,
    exchangeRateOverride: receipt.exchangeRateOverride,
  };
}

export function totalCents(entry: ExpenseEntry): Cents {
  return Object.values(entry.owed).reduce((sum, cents) => sum + cents, 0);
}

/**
 * What each member put in, adding up to the total exactly. The others are counted first, in id
 * order, each up to what is still unpaid; the payer covers the rest.
 */
export function paidBy(entry: ExpenseEntry): Record<MemberId, Cents> {
  const { payer, others } = entry.payment;
  const paid: Record<MemberId, Cents> = {};
  let unpaid = totalCents(entry);
  for (const id of memberIdsOf(others).sort(byCodeUnit)) {
    const cents = Math.min(Math.max(others[id], 0), unpaid);
    if (cents === 0) continue;
    paid[id] = (paid[id] ?? 0) + cents;
    unpaid -= cents;
  }
  if (unpaid > 0) paid[payer] = (paid[payer] ?? 0) + unpaid;
  return paid;
}

function post(
  header: ExpenseHeader,
  owed: Record<MemberId, Cents>,
  basis: ExpenseBasis,
): ExpenseEntry | null {
  const kept = positiveOnly(owed);
  if (Object.keys(kept).length === 0) return null;
  return { kind: 'expense', ...header, owed: kept, basis };
}

function positiveOnly(amounts: Record<MemberId, number>): Record<MemberId, number> {
  return Object.fromEntries(Object.entries(amounts).filter(([, amount]) => amount > 0));
}
