import type { Member, MemberId } from '@features/group-ledger/domain/types';

/**
 * Pairs of members who are probably one person added twice: not archived, and the same name
 * once case and outer spaces are ignored. Each pair is in the order the members were added.
 */
export function likelyDuplicates(members: Member[]): Array<[MemberId, MemberId]> {
  const live = members
    .filter((member) => !member.archived)
    .map((member) => ({ id: member.id, name: member.name.trim().toLowerCase() }))
    .filter((member) => member.name !== '');
  return live.flatMap((first, index) =>
    live
      .slice(index + 1)
      .filter((second) => second.name === first.name)
      .map((second): [MemberId, MemberId] => [first.id, second.id]),
  );
}
