import { describe, expect, it } from 'vitest';
import {
  activeMembers,
  hasMerges,
  resolveMember,
  stepMembers,
  type MemberBook,
} from './memberLifecycle';
import { ana, ben, cat, makeMember } from './testHelpers';

const book = (...ids: Array<typeof ana>): MemberBook =>
  new Map(ids.map((id) => [id, { kind: 'active' as const, member: makeMember(id) }]));

describe('stepMembers: put', () => {
  it('adds a member the book has never seen, with no undo', () => {
    const step = stepMembers(book(), { kind: 'put', member: makeMember(ana) });
    expect(step?.what).toEqual({ kind: 'member-added', member: makeMember(ana) });
    expect(step?.undo).toBeNull();
    expect(activeMembers(step!.book)).toEqual([makeMember(ana)]);
  });

  it('archives a member in place, with an undo that puts the old version back', () => {
    const archived = makeMember(ben, { archived: true });
    const step = stepMembers(book(ana, ben, cat), { kind: 'put', member: archived });
    expect(step?.what).toEqual({
      kind: 'member-changed',
      before: makeMember(ben),
      after: archived,
    });
    expect(step?.undo).toEqual({ kind: 'member.put', member: makeMember(ben) });
    expect(activeMembers(step!.book).map((member) => member.id)).toEqual([ana, ben, cat]);
  });

  it('ignores a put on a member that was merged away', () => {
    const merged = stepMembers(book(ana, ben), { kind: 'merge', from: ben, into: ana })!.book;
    expect(stepMembers(merged, { kind: 'put', member: makeMember(ben) })).toBeNull();
  });
});

describe('stepMembers: merge', () => {
  it('takes the member out of the list and reads its id as the one it merged into', () => {
    const step = stepMembers(book(ana, ben), { kind: 'merge', from: ben, into: ana });
    expect(step?.what).toEqual({
      kind: 'member-merged',
      from: makeMember(ben),
      into: makeMember(ana),
    });
    expect(activeMembers(step!.book)).toEqual([makeMember(ana)]);
    expect(resolveMember(step!.book, ben)).toBe(ana);
    expect(hasMerges(step!.book)).toBe(true);
  });

  it('follows a chain of merges to the member at its end', () => {
    const once = stepMembers(book(ana, ben, cat), { kind: 'merge', from: ana, into: ben })!.book;
    const twice = stepMembers(once, { kind: 'merge', from: ben, into: cat })!.book;
    expect(resolveMember(twice, ana)).toBe(cat);
  });

  it('ignores a merge into itself, one that would loop back, and one naming a stranger', () => {
    const merged = stepMembers(book(ana, ben), { kind: 'merge', from: ben, into: ana })!.book;
    expect(stepMembers(merged, { kind: 'merge', from: ana, into: ana })).toBeNull();
    expect(stepMembers(merged, { kind: 'merge', from: ana, into: ben })).toBeNull();
    expect(stepMembers(merged, { kind: 'merge', from: cat, into: ana })).toBeNull();
  });

  it('leaves the book it was given as it was', () => {
    const before = book(ana, ben);
    stepMembers(before, { kind: 'merge', from: ben, into: ana });
    expect(hasMerges(before)).toBe(false);
  });
});
