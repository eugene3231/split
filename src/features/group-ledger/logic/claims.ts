import type { MemberId } from '@features/group-ledger/domain/types';

/**
 * What each author has said it is, as they sent it: null is "nobody", a missing author has never
 * claimed. Ids are kept as sent and read through `resolve`, so a claim follows its member into
 * a merge. Kept in the order each author made the claim it holds now, which is who came first.
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
  const next = new Map(claims);
  next.delete(author);
  return next.set(author, memberId);
}

/**
 * The claims after a merge, which can bring two authors into one member: the one who claimed
 * first keeps it, and the other holds nobody, so their phone asks who they are. The same claims
 * come back when no two authors meet.
 */
export function settleClaimsAfterMerge<Author>(
  claims: ClaimBook<Author>,
  resolve: (id: MemberId) => MemberId,
): ClaimBook<Author> {
  const taken = new Set<MemberId>();
  const losers: Author[] = [];
  for (const [author, held] of claims) {
    if (held === null) continue;
    const member = resolve(held);
    if (taken.has(member)) losers.push(author);
    else taken.add(member);
  }
  if (losers.length === 0) return claims;
  const next = new Map(claims);
  for (const author of losers) next.set(author, null);
  return next;
}
