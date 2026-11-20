import { allocateCents } from '@shared/logic/core/allocation';
import type { Cents, Entry, Ledger, MemberId } from '@features/group-ledger/domain/types';
import { memberIdsOf } from '@features/group-ledger/logic/ids';
import { paidBy, totalCents } from '@features/group-ledger/logic/post';

/**
 * What one entry does to each member's balance, in group cents: positive is owed money,
 * negative owes it. Always adds up to zero. An expense's total is converted once and that one
 * figure is shared out twice, to whoever paid and to whoever owes, so no cent is lost to
 * converting each person's amount on its own.
 */
export function entryEffect(entry: Entry): Record<MemberId, Cents> {
  if (entry.kind === 'transfer') {
    const effect: Record<MemberId, Cents> = { [entry.from]: 0, [entry.to]: 0 };
    effect[entry.from] += entry.cents;
    effect[entry.to] -= entry.cents;
    return effect;
  }

  const paid = paidBy(entry);
  const owed = entry.owed;
  const groupCents = Math.round(totalCents(entry) * entry.rate);
  const involved = [...new Set([...memberIdsOf(paid), ...memberIdsOf(owed)])];
  const paidInGroup = allocateCents(groupCents, involved, paid);
  const owedInGroup = allocateCents(groupCents, involved, owed);
  return Object.fromEntries(involved.map((id) => [id, paidInGroup[id] - owedInGroup[id]]));
}

/**
 * Every member's balance in group cents, adding up to zero. An archived member is listed only
 * while their balance is not zero.
 */
export function computeBalances(ledger: Ledger): Record<MemberId, Cents> {
  const balances: Record<MemberId, Cents> = Object.fromEntries(
    ledger.members.map((member) => [member.id, 0]),
  );
  for (const { effect } of ledger.entries) {
    for (const id of memberIdsOf(effect)) {
      balances[id] = (balances[id] ?? 0) + effect[id];
    }
  }
  for (const member of ledger.members) {
    if (member.archived && balances[member.id] === 0) delete balances[member.id];
  }
  return balances;
}
