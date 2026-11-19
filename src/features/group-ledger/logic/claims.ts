import type { MemberId } from '@features/group-ledger/domain/types';

/**
 * What each author has said it is, as they sent it: null is "nobody", a missing author has never
 * claimed. Ids are kept as sent and read through `resolve`, so a claim follows its member into
 * a merge.
 */
export type ClaimBook<Author> = ReadonlyMap<Author, MemberId | null>;

/**
 * The claims after `author` says it is `memberId`, or null when the claim is ignored because
 * another author already holds that member (after merges): the first to claim keeps it. A claim
 * replaces the author's last one, so stepping back or moving on frees the old member.
 */
export function stepClaim<Author>(
  claims: ClaimBook<Author>,
  author: Author,
  memberId: MemberId | null,
  resolve: (id: MemberId) => MemberId,
): ClaimBook<Author> | null {
  if (memberId !== null) {
    const wanted = resolve(memberId);
    const heldByAnother = [...claims].some(
      ([holder, held]) => holder !== author && held !== null && resolve(held) === wanted,
    );
    if (heldByAnother) return null;
  }
  return new Map(claims).set(author, memberId);
}
