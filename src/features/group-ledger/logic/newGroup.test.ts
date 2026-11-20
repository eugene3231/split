import { describe, expect, it } from 'vitest';
import { newGroupChanges, uniqueNames } from './newGroup';
import { fold, makeLog, pending } from './testHelpers';

describe('newGroupChanges', () => {
  it('names the group, adds me and each friend once, and claims me', () => {
    const changes = newGroupChanges({
      name: ' Japan 2026 ',
      currency: 'JPY',
      myName: 'Ana',
      friendNames: ['Ben', ' ben ', '', 'ANA', 'Cat'],
    });

    const ledger = fold(
      makeLog(
        [],
        changes.map((change, index) => pending(index + 1, change)),
      ),
    );

    expect(ledger.name).toBe('Japan 2026');
    expect(ledger.currency).toBe('JPY');
    expect(ledger.members.map((member) => member.name)).toEqual(['Ana', 'Ben', 'Cat']);
    expect(ledger.me).toBe(ledger.members[0].id);
  });
});

describe('uniqueNames', () => {
  it('trims, drops blanks, and keeps the first of names that differ only in case', () => {
    expect(uniqueNames([' Ben', 'ben ', '', 'Cat', 'ana'], ['Ana'])).toEqual(['Ben', 'Cat']);
  });
});
