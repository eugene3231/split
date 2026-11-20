import { allocateCents } from '@shared/logic/core/allocation';
import {
  computeSplit,
  isItemAssigned,
  resolveDiscountedAmountCents,
} from '@features/split-workspace';
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

/**
 * An edited receipt, keeping the cents it was saved with while nothing that splits it changed:
 * same items, charges and shares, only the name, payer or rate. A merge since it was saved would
 * otherwise split the same receipt over fewer people and move a cent onto someone outside it.
 */
export function keepSavedCents(entry: ExpenseEntry, saved: ExpenseEntry | null): ExpenseEntry {
  if (saved === null || saved.basis.kind !== 'receipt' || entry.basis.kind !== 'receipt') {
    return entry;
  }
  const splitOf = (receipt: StoredReceipt) => canonicalJson({ ...receipt, name: '' });
  if (splitOf(entry.basis.receipt) !== splitOf(saved.basis.receipt)) return entry;
  return { ...entry, owed: saved.owed };
}

/**
 * A saved edit of an entry a merge has rewritten. Where the edit leaves the amounts owed, or who
 * paid, as `shown` had them, it writes them back as `written` had them, before the merge. The fold
 * then resolves them exactly as before; written with the merged ids instead, a converted total
 * would be rounded over fewer shares and could move a cent onto someone outside the merge.
 */
export function keepAsWritten(
  next: ExpenseEntry,
  shown: ExpenseEntry,
  written: ExpenseEntry,
): ExpenseEntry {
  if (written === shown) return next;
  const sameOwed =
    next.currency === shown.currency && canonicalJson(next.owed) === canonicalJson(shown.owed);
  const sameSplit = sameOwed && sameBasis(next.basis, shown.basis);
  const samePaid = canonicalJson(next.payment) === canonicalJson(shown.payment);
  return {
    ...next,
    owed: sameOwed ? written.owed : next.owed,
    basis: sameSplit ? renamedBasis(written.basis, next.basis) : next.basis,
    payment: samePaid ? written.payment : next.payment,
  };
}

const basisWithoutName = (basis: ExpenseBasis) =>
  basis.kind === 'receipt' ? { ...basis, receipt: { ...basis.receipt, name: '' } } : basis;

const sameBasis = (a: ExpenseBasis, b: ExpenseBasis) =>
  canonicalJson(basisWithoutName(a)) === canonicalJson(basisWithoutName(b));

/** `written`, carrying the receipt name `next` was saved with. */
function renamedBasis(written: ExpenseBasis, next: ExpenseBasis): ExpenseBasis {
  if (written.kind !== 'receipt' || next.kind !== 'receipt') return written;
  return { ...written, receipt: { ...written.receipt, name: next.receipt.name } };
}

/** JSON with every object's keys sorted, so two values compare equal however they were built. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );
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
