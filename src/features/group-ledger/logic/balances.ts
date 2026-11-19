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
export function entryEffect(
  entry: Entry,
  aliases: ReadonlyMap<MemberId, MemberId>,
): Record<MemberId, Cents> {
  const resolve = (id: MemberId) => aliases.get(id) ?? id;

  if (entry.kind === 'transfer') {
    const effect: Record<MemberId, Cents> = { [resolve(entry.from)]: 0, [resolve(entry.to)]: 0 };
    effect[resolve(entry.from)] += entry.cents;
    effect[resolve(entry.to)] -= entry.cents;
    return effect;
  }

  const paid = resolveKeys(paidBy(entry), resolve);
  const owed = resolveKeys(entry.owed, resolve);
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
  for (const { entry } of ledger.entries) {
    const effect = entryEffect(entry, ledger.aliases);
    for (const id of memberIdsOf(effect)) {
      balances[id] = (balances[id] ?? 0) + effect[id];
    }
  }
  for (const member of ledger.members) {
    if (member.archived && balances[member.id] === 0) delete balances[member.id];
  }
  return balances;
}

function resolveKeys(
  amounts: Record<MemberId, Cents>,
  resolve: (id: MemberId) => MemberId,
): Record<MemberId, Cents> {
  const resolved: Record<MemberId, Cents> = {};
  for (const id of memberIdsOf(amounts)) {
    resolved[resolve(id)] = (resolved[resolve(id)] ?? 0) + amounts[id];
  }
  return resolved;
}
