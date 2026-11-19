export const title = 'Two friends change the same expense';

const editors = (v) => ['me', 'friend'].filter((p) => v.editing[p] !== 0);

export const state = (v) => {
  if (v.head.kind === 'none') return 'Not added yet';
  if (v.outcome === 'offered') return 'One version kept, the other offered back';
  const busy = editors(v);
  if (v.head.kind === 'removed') return busy.length > 0 ? 'Deleted while someone edits' : 'Deleted';
  if (busy.length === 2) return 'We both edit at once';
  if (busy.length === 1) return busy[0] === 'me' ? "I'm editing" : 'My friend is editing';
  if (v.outcome === 'restored') return 'The lost version is back';
  if (v.outcome === 'left') return 'The newer version stays';
  return 'Saved';
};

export const group = (v) => {
  if (v.head.kind === 'none') return 'start';
  if (v.outcome === 'offered') return 'conflict';
  if (v.head.kind === 'removed') return 'gone';
  if (editors(v).length > 0) return 'editing';
  return 'settled';
};

export const colors = {
  start: 'tan',
  settled: 'teal',
  editing: 'blue',
  conflict: 'yellow',
  gone: 'pink',
};

const changedEditor = (from, to) => ['me', 'friend'].find((p) => from.editing[p] !== to.editing[p]);

export const step = (action, from, to) => {
  const p = changedEditor(from, to);
  // Out of "the lost version is back" and "the newer version stays", the chart keeps only
  // "I start editing": the other steps out repeat what "Saved" shows.
  const settledConflict = from.outcome === 'restored' || from.outcome === 'left';
  if (settledConflict && from.head.kind === 'live' && !(action === 'StartEdit' && p === 'me')) {
    return null;
  }
  switch (action) {
    case 'IAdd':
      return 'I add the expense';
    case 'StartEdit':
      return p === 'me' ? 'I start editing' : 'my friend starts editing';
    case 'Save': {
      const saves = p === 'me' ? 'I save' : 'my friend saves';
      if (from.head.kind === 'removed') return `${saves}, which brings it back`;
      return from.editing[p] !== from.head.rev ? `${saves} over a change not yet seen` : saves;
    }
    case 'Delete':
      return 'someone deletes it';
    case 'UndoDelete':
      // Undo while someone is mid-edit repeats the plain Undo arrow; the chart leaves it out.
      if (editors(from).length > 0) return null;
      return 'someone taps Undo on the delete';
    case 'Restore':
      return 'someone taps Restore';
    case 'Leave':
      return 'everyone leaves it';
    default:
      return action;
  }
};
