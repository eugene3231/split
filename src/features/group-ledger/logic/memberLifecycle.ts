import type { Activity, Member, MemberId } from '@features/group-ledger/domain/types';

/**
 * Where one member id stands. Not in the book until a `member.put` adds it; `active` from then
 * on (archived or not, which is just a field of the member), until a merge makes it `merged`,
 * which is final: a later put on that id is ignored and every reference to it reads as `into`.
 */
export type MemberState = { kind: 'active'; member: Member } | { kind: 'merged'; into: MemberId };

/** Every member id the log has added, in the order it added them. */
export type MemberBook = ReadonlyMap<MemberId, MemberState>;

export type MemberEvent =
  { kind: 'put'; member: Member } | { kind: 'merge'; from: MemberId; into: MemberId };

export interface MemberStep extends Pick<Activity, 'what' | 'undo'> {
  book: MemberBook;
}

/**
 * The book after one member op and the activity row for it, or null when the op changes nothing:
 * a put on a merged-away id, a merge of a member into itself (after following merges, so a merge
 * that would loop back is one), or a merge naming a member the log never added.
 */
export function stepMembers(book: MemberBook, event: MemberEvent): MemberStep | null {
  if (event.kind === 'put') {
    const { member } = event;
    const state = book.get(member.id);
    if (state?.kind === 'merged') return null;
    const next = new Map(book).set(member.id, { kind: 'active', member });
    if (state === undefined) {
      return { book: next, what: { kind: 'member-added', member }, undo: null };
    }
    return {
      book: next,
      what: { kind: 'member-changed', before: state.member, after: member },
      undo: { kind: 'member.put', member: state.member },
    };
  }

  const fromId = resolveMember(book, event.from);
  const intoId = resolveMember(book, event.into);
  const from = activeMember(book, fromId);
  const into = activeMember(book, intoId);
  if (fromId === intoId || from === null || into === null) return null;
  return {
    book: new Map(book).set(fromId, { kind: 'merged', into: intoId }),
    what: { kind: 'member-merged', from, into },
    undo: null,
  };
}

/** The id `id` reads as after every merge: itself unless it was merged away. */
export function resolveMember(book: MemberBook, id: MemberId): MemberId {
  let current = id;
  for (let state = book.get(current); state?.kind === 'merged'; state = book.get(current)) {
    current = state.into;
  }
  return current;
}

export function activeMember(book: MemberBook, id: MemberId): Member | null {
  const state = book.get(id);
  return state?.kind === 'active' ? state.member : null;
}

export function activeMembers(book: MemberBook): Member[] {
  return [...book.values()].flatMap((state) => (state.kind === 'active' ? [state.member] : []));
}

export function hasMerges(book: MemberBook): boolean {
  return [...book.values()].some((state) => state.kind === 'merged');
}
