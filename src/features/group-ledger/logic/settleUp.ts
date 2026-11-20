import type { Cents, MemberId, Transfer } from '@features/group-ledger/domain/types';
import { byCodeUnit, memberIdsOf } from '@features/group-ledger/logic/ids';

/** Above this the exact search (2^n subsets) gives way to the greedy one. */
const EXACT_SETTLE_LIMIT = 12;

interface Balance {
  id: MemberId;
  cents: Cents;
}

/**
 * The fewest payments that bring every balance to zero. Members who can settle among themselves
 * need one payment fewer than their number, so the fewest overall comes from splitting the
 * members into as many such circles as possible. That split is exact up to
 * `EXACT_SETTLE_LIMIT` members with a balance; above it everyone is treated as one circle.
 * Members are taken in id order throughout, so every phone lists the same payments.
 */
export function settleUp(balances: Record<MemberId, Cents>): Transfer[] {
  const open = memberIdsOf(balances)
    .sort(byCodeUnit)
    .map((id) => ({ id, cents: balances[id] }))
    .filter((balance) => balance.cents !== 0);
  const circles = open.length <= EXACT_SETTLE_LIMIT ? settlingCircles(open) : [open];
  return circles.flatMap(settleCircle);
}

function settlingCircles(open: Balance[]): Balance[][] {
  const full = (1 << open.length) - 1;
  const sum = new Float64Array(full + 1);
  const most = new Int8Array(full + 1);
  const dropped = new Int8Array(full + 1);

  for (let subset = 1; subset <= full; subset++) {
    const lowest = 31 - Math.clz32(subset & -subset);
    sum[subset] = sum[subset & (subset - 1)] + open[lowest].cents;
    let best = -1;
    for (let index = 0; index < open.length; index++) {
      if ((subset & (1 << index)) === 0) continue;
      const without = most[subset ^ (1 << index)];
      if (without > best) {
        best = without;
        dropped[subset] = index;
      }
    }
    most[subset] = best + (sum[subset] === 0 ? 1 : 0);
  }

  const circles: Balance[][] = [];
  let circle: Balance[] = [];
  for (let subset = full; subset !== 0; subset ^= 1 << dropped[subset]) {
    if (sum[subset] === 0 && circle.length > 0) {
      circles.push(circle);
      circle = [];
    }
    circle.push(open[dropped[subset]]);
  }
  if (circle.length > 0) circles.push(circle);
  return circles.map((members) => members.sort((a, b) => byCodeUnit(a.id, b.id)));
}

function settleCircle(circle: Balance[]): Transfer[] {
  const left = circle.map((balance) => ({ ...balance }));
  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = largest(left.filter((balance) => balance.cents < 0));
    const creditor = largest(left.filter((balance) => balance.cents > 0));
    if (debtor === undefined || creditor === undefined) return transfers;
    const cents = Math.min(-debtor.cents, creditor.cents);
    debtor.cents += cents;
    creditor.cents -= cents;
    transfers.push({ from: debtor.id, to: creditor.id, cents });
  }
}

function largest(balances: Balance[]): Balance | undefined {
  return balances.reduce<Balance | undefined>(
    (best, balance) =>
      best === undefined || Math.abs(balance.cents) > Math.abs(best.cents) ? balance : best,
    undefined,
  );
}
