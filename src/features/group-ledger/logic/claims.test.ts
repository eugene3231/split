import { describe, expect, it } from 'vitest';
import type { MemberId } from '@features/group-ledger/domain/types';
import { settleClaimsAfterMerge, stepClaim, type ClaimBook } from './claims';
import { ana, ben, cat } from './testHelpers';

const same = (id: MemberId) => id;
const benIsAna = (id: MemberId) => (id === ben ? ana : id);
const claims = (entries: Array<[string, MemberId | null]>): ClaimBook<string> => new Map(entries);

describe('stepClaim', () => {
  it('lets a user claim a free member', () => {
    expect(stepClaim(claims([]), 'u1', ana, same)).toEqual(claims([['u1', ana]]));
  });

  it('ignores a claim on a member another user holds: the first to claim keeps it', () => {
    expect(stepClaim(claims([['u1', ana]]), 'u2', ana, same)).toBeNull();
  });

  it('ignores a claim on a member another user holds under the name it merged into', () => {
    expect(stepClaim(claims([['u1', ben]]), 'u2', ana, benIsAna)).toBeNull();
  });

  it('lets a user claim again the member it already holds, or move to another', () => {
    expect(stepClaim(claims([['u1', ana]]), 'u1', ana, same)).toEqual(claims([['u1', ana]]));
    expect(stepClaim(claims([['u1', ana]]), 'u1', cat, same)).toEqual(claims([['u1', cat]]));
  });

  it('frees the member when its holder steps back to nobody', () => {
    const steppedBack = stepClaim(claims([['u1', ana]]), 'u1', null, same)!;
    expect(steppedBack).toEqual(claims([['u1', null]]));
    expect(stepClaim(steppedBack, 'u2', ana, same)).toEqual(
      claims([
        ['u1', null],
        ['u2', ana],
      ]),
    );
  });
});

describe('settleClaimsAfterMerge', () => {
  it('keeps the merged member for whoever claimed first, and asks the other who they are', () => {
    const before = claims([
      ['u1', ana],
      ['u2', ben],
    ]);

    expect(settleClaimsAfterMerge(before, benIsAna)).toEqual(
      claims([
        ['u1', ana],
        ['u2', null],
      ]),
    );
  });

  it('counts first from the claim each user holds now, not their first claim ever', () => {
    const u1MovedLater = stepClaim(
      stepClaim(stepClaim(claims([]), 'u1', cat, same)!, 'u2', ben, same)!,
      'u1',
      ana,
      same,
    )!;

    expect(settleClaimsAfterMerge(u1MovedLater, benIsAna)).toEqual(
      claims([
        ['u2', ben],
        ['u1', null],
      ]),
    );
  });

  it('leaves claims alone when no two meet in one member', () => {
    const before = claims([
      ['u1', ana],
      ['u2', cat],
    ]);

    expect(settleClaimsAfterMerge(before, benIsAna)).toBe(before);
  });
});
