import { describe, expect, it } from 'vitest';
import { ABSENT, stepEntry, type EntryState } from './entryLifecycle';
import { asOpId } from './ids';
import { ana, ben, makeExpense } from './testHelpers';

const first = makeExpense('e1', { [ana]: 1000 }, { title: 'Dinner' });
const edited = makeExpense('e1', { [ana]: 600, [ben]: 600 }, { title: 'Dinner' });
const rival = makeExpense('e1', { [ben]: 900 }, { title: 'Dinner' });

const r1 = asOpId('r1');
const r2 = asOpId('r2');
const r3 = asOpId('r3');

const live: EntryState = { kind: 'live', entry: first, rev: r1, pending: false, position: 4 };
const removed: EntryState = { kind: 'removed', entry: first, by: r2, position: 4 };

const put = (entry = edited, base: string | null = 'r1') => ({
  kind: 'put' as const,
  entry,
  base: base === null ? null : asOpId(base),
  op: r3,
  pending: true,
  position: 9,
});

describe('stepEntry: not yet there', () => {
  it('goes live where it first appears, with an undo that removes it', () => {
    expect(stepEntry(ABSENT, put(first, null))).toEqual({
      state: { kind: 'live', entry: first, rev: r3, pending: true, position: 9 },
      what: { kind: 'entry-added', entry: first },
      replaced: null,
      undo: { kind: 'entry.removed', entryId: first.id, base: r3 },
    });
  });

  it('ignores a remove', () => {
    expect(stepEntry(ABSENT, { kind: 'remove', base: r1, op: r3 })).toBeNull();
  });
});

describe('stepEntry: live', () => {
  it('takes an edit based on the live version, keeps its place, and undoes to that version', () => {
    expect(stepEntry(live, put())).toEqual({
      state: { kind: 'live', entry: edited, rev: r3, pending: true, position: 4 },
      what: { kind: 'entry-changed', before: first, after: edited },
      replaced: null,
      undo: { kind: 'entry.put', entry: first, base: r3 },
    });
  });

  it('takes an edit based on an older version whole, and says which version it replaced', () => {
    const step = stepEntry(live, put(rival, 'r0'));
    expect(step?.state).toEqual({
      kind: 'live',
      entry: rival,
      rev: r3,
      pending: true,
      position: 4,
    });
    expect(step?.replaced).toBe(first);
    expect(step?.undo).toEqual({ kind: 'entry.put', entry: first, base: r3 });
  });

  it('counts a second add of the same id as replacing the version it never saw', () => {
    expect(stepEntry(live, put(rival, null))?.replaced).toBe(first);
  });

  it('removes it, with an undo that puts it back based on the remove', () => {
    expect(stepEntry(live, { kind: 'remove', base: r1, op: r3 })).toEqual({
      state: { kind: 'removed', entry: first, by: r3, position: 4 },
      what: { kind: 'entry-removed', entry: first },
      replaced: null,
      undo: { kind: 'entry.put', entry: first, base: r3 },
    });
  });

  it('says so when a remove lands on a version its author never saw', () => {
    expect(stepEntry(live, { kind: 'remove', base: r2, op: r3 })?.replaced).toBe(first);
  });
});

describe('stepEntry: removed', () => {
  it('is restored by a put based on the remove, back in its old place', () => {
    expect(stepEntry(removed, put(first, 'r2'))).toEqual({
      state: { kind: 'live', entry: first, rev: r3, pending: true, position: 4 },
      what: { kind: 'entry-restored', entry: first },
      replaced: null,
      undo: { kind: 'entry.removed', entryId: first.id, base: r3 },
    });
  });

  it('comes back under an edit that never saw the remove, which reads as replacing the removed version', () => {
    expect(stepEntry(removed, put(edited, 'r1'))).toEqual({
      state: { kind: 'live', entry: edited, rev: r3, pending: true, position: 4 },
      what: { kind: 'entry-changed', before: first, after: edited },
      replaced: first,
      undo: { kind: 'entry.removed', entryId: first.id, base: r3 },
    });
  });

  it('ignores a second remove', () => {
    expect(stepEntry(removed, { kind: 'remove', base: r2, op: r3 })).toBeNull();
  });
});
