#!/usr/bin/env node
// Proves each ledger property can fail: breaks the real code one way at a time, runs only the
// property that guards it, and expects it to fail. Puts every file back, even on Ctrl-C.
// Run from the repo root: `pnpm formal:ledger:mutants`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const LOGIC = 'src/features/group-ledger/logic';
const SUITE = `${LOGIC}/fold.properties.test.ts`;

/** `property` is a unique part of the `it` name in the suite. */
const MUTANTS = [
  {
    property: 'on every phone holding the same confirmed log',
    why: 'activity rows signed with the reading phone instead of the author',
    file: `${LOGIC}/fold.ts`,
    from: 'by: state.claims.get(op.author) ?? claimBefore',
    to: 'by: state.claims.get(me) ?? claimBefore',
  },
  {
    property: 'shows offline what it will show',
    why: "pending ops written by an anonymous author instead of this phone's user",
    file: `${LOGIC}/fold.ts`,
    from: 'author: me, pending: true',
    to: 'author: THIS_DEVICE, pending: true',
  },
  {
    property: 'adding up to zero',
    why: 'owed shares converted with a different rounding than what was paid',
    file: `${LOGIC}/balances.ts`,
    from: 'allocateCents(groupCents, involved, owed)',
    to: 'allocateCents(Math.ceil(totalCents(entry) * entry.rate), involved, owed)',
  },
  {
    property: 'never loses an edit silently',
    why: 'an edit over a version its author never saw is not flagged',
    file: `${LOGIC}/entryLifecycle.ts`,
    from: 'replaced: base === state.rev ? null : state.entry',
    to: 'replaced: null',
  },
  {
    property: 'never loses an edit silently',
    why: 'any edit of a removed entry reads as a restore, so an edit over an unseen remove is not flagged',
    file: `${LOGIC}/entryLifecycle.ts`,
    from: 'if (base === state.by)',
    to: 'if (base !== null)',
  },
  {
    property: 'undo of the op just written',
    why: 'the undo of an edit puts the new version back instead of the old one',
    file: `${LOGIC}/entryLifecycle.ts`,
    from: "undo: { kind: 'entry.put', entry: state.entry, base: op }",
    to: "undo: { kind: 'entry.put', entry, base: op }",
  },
  {
    property: 'undo of the op just written',
    why: 'a restored entry moves to where the restore was written instead of its old place',
    file: `${LOGIC}/entryLifecycle.ts`,
    from: "const position = state.kind === 'absent' ? event.position : state.position;",
    to: 'const position = event.position;',
  },
  {
    property: "every entry is in the group's currency",
    why: 'a merge keeps the last amount for a member instead of adding the two',
    file: `${LOGIC}/fold.ts`,
    from: 'resolved[resolve(id)] = (resolved[resolve(id)] ?? 0) + amounts[id];',
    to: 'resolved[resolve(id)] = amounts[id];',
  },
  {
    property: 'merges included',
    why: 'a claim on a member another phone holds is taken anyway',
    file: `${LOGIC}/claims.ts`,
    from: 'if (heldByAnother) return null;',
    to: '',
  },
  {
    property: 'merges included',
    why: 'a merge that brings two phones into one member keeps both',
    file: `${LOGIC}/claims.ts`,
    from: 'if (losers.length === 0) return claims;',
    to: 'return claims;',
  },
  {
    property: 'in any currency',
    why: "a merged entry's effect is worked out after the merge, rounding a converted total again",
    file: `${LOGIC}/fold.ts`,
    from: 'effect: merged ? resolveEffect(entryEffect(entry), resolve) : entryEffect(entry),',
    to: 'effect: entryEffect(current(entry)),',
  },
];

const originals = new Map();
const restore = () => {
  for (const [file, text] of originals) writeFileSync(file, text);
};
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

function runProperty(property) {
  try {
    execFileSync(
      'pnpm',
      ['exec', 'vitest', 'run', '--project', 'unit', '--testTimeout=600000', SUITE, '-t', property],
      {
        env: { ...process.env, LEDGER_RUNS: process.env.LEDGER_RUNS ?? '1000' },
        stdio: 'pipe',
      },
    );
    return 'passed';
  } catch (error) {
    // Only a counterexample counts; a mutant that stops the file loading proves nothing.
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return output.includes('Property failed') ? 'failed' : 'crashed';
  }
}

let missed = 0;
try {
  for (const mutant of MUTANTS) {
    const text = originals.get(mutant.file) ?? readFileSync(mutant.file, 'utf8');
    originals.set(mutant.file, text);
    if (text.split(mutant.from).length !== 2) {
      console.log(
        `STALE  ${mutant.file}: "${mutant.from}" is not there exactly once; update MUTANTS`,
      );
      missed++;
      continue;
    }
    writeFileSync(mutant.file, text.replace(mutant.from, mutant.to));
    const result = runProperty(mutant.property);
    writeFileSync(mutant.file, text);
    const caught = result === 'failed';
    if (!caught) missed++;
    const label = caught ? 'CAUGHT' : result === 'crashed' ? 'CRASH ' : 'MISSED';
    console.log(`${label} "${mutant.property}" <- ${mutant.why}`);
  }
} finally {
  restore();
}

const clean = [...new Set(MUTANTS.map((mutant) => mutant.property))].map((property) => ({
  property,
  result: runProperty(property),
}));
for (const { property, result } of clean) {
  if (result !== 'passed') missed++;
  console.log(
    `${result === 'passed' ? 'CLEAN ' : 'BROKEN'} "${property}" ${result} on the real code`,
  );
}
process.exit(missed === 0 ? 0 : 1);
