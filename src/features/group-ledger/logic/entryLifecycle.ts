import type { Activity, Change, Entry, OpId } from '@features/group-ledger/domain/types';

/**
 * Where one entry id stands in the log. `absent` until the first put; then `live` or `removed`,
 * and it never goes back to `absent`. `position` is where it first appeared, so an edit or a
 * restore does not move it in the list.
 */
export type EntryState =
  | { kind: 'absent' }
  | { kind: 'live'; entry: Entry; rev: OpId; pending: boolean; position: number }
  | { kind: 'removed'; entry: Entry; by: OpId; position: number };

/** One op, as it touches one entry. `op` is the id of the op; `base` is the revision its author saw. */
export type EntryEvent =
  | {
      kind: 'put';
      entry: Entry;
      base: OpId | null;
      op: OpId;
      pending: boolean;
      position: number;
    }
  | { kind: 'remove'; base: OpId; op: OpId };

export interface EntryStep extends Pick<Activity, 'what' | 'replaced' | 'undo'> {
  state: Exclude<EntryState, { kind: 'absent' }>;
}

export const ABSENT: EntryState = { kind: 'absent' };

/**
 * The entry's next state and the activity row for it, or null when the op changes nothing
 * (removing an entry that is not live).
 *
 * Whole-entry last writer wins: a put always becomes the live version. When the put or remove
 * names a `base` other than the revision it lands on, its author never saw that version, so the
 * row holds it in `replaced` and the undo brings it back.
 */
export function stepEntry(state: EntryState, event: EntryEvent): EntryStep | null {
  if (event.kind === 'remove') {
    if (state.kind !== 'live') return null;
    return {
      state: { kind: 'removed', entry: state.entry, by: event.op, position: state.position },
      what: { kind: 'entry-removed', entry: state.entry },
      replaced: event.base === state.rev ? null : state.entry,
      undo: { kind: 'entry.put', entry: state.entry, base: event.op },
    };
  }

  const { entry, base, op, pending } = event;
  const position = state.kind === 'absent' ? event.position : state.position;
  const next: EntryStep['state'] = { kind: 'live', entry, rev: op, pending, position };
  const remove: Change = { kind: 'entry.removed', entryId: entry.id, base: op };

  switch (state.kind) {
    case 'absent':
      return { state: next, what: { kind: 'entry-added', entry }, replaced: null, undo: remove };
    case 'live':
      return {
        state: next,
        what: { kind: 'entry-changed', before: state.entry, after: entry },
        replaced: base === state.rev ? null : state.entry,
        undo: { kind: 'entry.put', entry: state.entry, base: op },
      };
    case 'removed':
      if (base === state.by) {
        return {
          state: next,
          what: { kind: 'entry-restored', entry },
          replaced: null,
          undo: remove,
        };
      }
      return {
        state: next,
        what: { kind: 'entry-changed', before: state.entry, after: entry },
        replaced: state.entry,
        undo: remove,
      };
    default:
      return state satisfies never;
  }
}
