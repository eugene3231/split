import { describe, expect, it } from 'vitest';
import { newGroupChanges } from './newGroup';
import { fold, makeLog, pending } from './testHelpers';

describe('newGroupChanges', () => {
  it('names the group, adds me and each friend once, and claims me', () => {
    const { changes, me } = newGroupChanges({
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
    expect(ledger.me).toBe(me);
    expect(ledger.members[0].id).toBe(me);
  });

  it('still has a member for me when my name was left blank', () => {
    const { changes, me } = newGroupChanges({
      name: 'Lunch',
      currency: 'SGD',
      myName: ' ',
      friendNames: ['Ben'],
    });

    const ledger = fold(
      makeLog(
        [],
        changes.map((change, index) => pending(index + 1, change)),
      ),
    );

    expect(ledger.members.find((member) => member.id === me)?.name).toBe('Me');
  });
});
