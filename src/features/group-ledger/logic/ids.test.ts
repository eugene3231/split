import { describe, expect, it } from 'vitest';
import {
  asMemberId,
  byCodeUnit,
  memberIdsOf,
  newEntryId,
  newGroupId,
  newInviteCode,
  newMemberId,
  newOpId,
  todayLocalDate,
} from './ids';

describe('ids', () => {
  it('makes a different id every time', () => {
    const ids = [newGroupId(), newMemberId(), newEntryId(), newOpId(), newOpId()];
    expect(new Set(ids).size).toBe(5);
  });

  it('makes an invite code of 16 random bytes in base64url', () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newInviteCode()).not.toBe(code);
  });

  it('writes today in the local time zone, zero padded', () => {
    expect(todayLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocalDate(new Date(2026, 10, 19, 0, 0))).toBe('2026-11-19');
  });

  it('lists the members a record is keyed by', () => {
    expect(memberIdsOf({ [asMemberId('b')]: 1, [asMemberId('a')]: 2 })).toEqual(['b', 'a']);
  });

  it('orders ids by code unit, so capitals sort before lower case on every phone', () => {
    expect(['b', 'a', 'B'].sort(byCodeUnit)).toEqual(['B', 'a', 'b']);
    expect(byCodeUnit('a', 'a')).toBe(0);
  });
});
