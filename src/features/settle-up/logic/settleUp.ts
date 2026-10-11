import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';

export interface SettleUpReceipt {
  id: string;
  name: string;
  owedByPersonCents: Record<string, number>;
}

export interface PersonBalance {
  personId: string;
  paidCents: number;
  owedCents: number;
  netCents: number;
}

export interface Transfer {
  fromPersonId: string;
  toPersonId: string;
  amountCents: number;
}

export function getReceiptTotalCents(receipt: SettleUpReceipt): number {
  return Object.values(receipt.owedByPersonCents).reduce((sum, cents) => sum + cents, 0);
}

/**
 * A receipt counts toward balances only once someone is marked as its payer:
 * the payer fronted everything people owe on it.
 */
export function resolveBalances(
  people: Person[],
  receipts: SettleUpReceipt[],
  payerByReceiptId: Record<string, string | undefined>,
): PersonBalance[] {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};

  for (const receipt of receipts) {
    const payerId = payerByReceiptId[receipt.id];
    if (!payerId) continue;

    paid[payerId] = (paid[payerId] ?? 0) + getReceiptTotalCents(receipt);
    for (const [personId, cents] of Object.entries(receipt.owedByPersonCents)) {
      owed[personId] = (owed[personId] ?? 0) + cents;
    }
  }

  return people.map((person) => {
    const paidCents = paid[person.id] ?? 0;
    const owedCents = owed[person.id] ?? 0;
    return { personId: person.id, paidCents, owedCents, netCents: paidCents - owedCents };
  });
}

/**
 * Settles balances with at most n - 1 transfers by repeatedly matching the
 * largest debtor with the largest creditor.
 */
export function resolveTransfers(balances: PersonBalance[]): Transfer[] {
  const byLargest = (a: { cents: number }, b: { cents: number }) => b.cents - a.cents;
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ personId: b.personId, cents: -b.netCents }))
    .sort(byLargest);
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ personId: b.personId, cents: b.netCents }))
    .sort(byLargest);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amountCents = Math.min(debtors[d].cents, creditors[c].cents);
    transfers.push({
      fromPersonId: debtors[d].personId,
      toPersonId: creditors[c].personId,
      amountCents,
    });
    debtors[d].cents -= amountCents;
    creditors[c].cents -= amountCents;
    if (debtors[d].cents === 0) d++;
    if (creditors[c].cents === 0) c++;
  }

  return transfers;
}

/** Includes the amount so a settled mark clears when the amount changes. */
export function getTransferKey(transfer: Transfer): string {
  return `${transfer.fromPersonId}->${transfer.toPersonId}:${transfer.amountCents}`;
}

export function formatSettleUpText(people: Person[], transfers: Transfer[]): string {
  if (transfers.length === 0) return 'Everyone is square.';

  const nameOf = (personId: string) => people.find((p) => p.id === personId)?.name ?? '?';
  const lines = transfers.map(
    (t) =>
      `${nameOf(t.fromPersonId)} pays ${nameOf(t.toPersonId)} ${formatCurrencyFromCents(t.amountCents)}`,
  );
  return ['Settle up', ...lines].join('\n');
}
