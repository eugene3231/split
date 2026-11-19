import { describe, expect, it } from 'vitest';
import type { GroupId } from '@features/group-ledger/domain/types';
import { joinStateOf } from '@features/group-ledger/logic/joinState';

const groupId = 'g-1' as GroupId;
const retry = () => {};

describe('joinStateOf', () => {
  it('opens a group the phone holds whatever the last answer was', () => {
    expect(joinStateOf({ groupId }, { kind: 'offline' }, retry)).toEqual({
      step: 'joined',
      groupId,
    });
  });

  it('is still joining until an answer comes', () => {
    expect(joinStateOf(undefined, null, retry)).toEqual({ step: 'joining' });
  });

  it('calls a code that opens nothing, or no longer lets this user in, a bad link', () => {
    expect(joinStateOf(undefined, { kind: 'invite-not-found' }, retry)).toEqual({
      step: 'bad-link',
    });
    expect(joinStateOf(undefined, { kind: 'not-a-member' }, retry)).toEqual({ step: 'bad-link' });
  });

  it('offers a retry when there is no signal or the server failed', () => {
    expect(joinStateOf(undefined, { kind: 'offline' }, retry)).toEqual({ step: 'offline', retry });
    expect(joinStateOf(undefined, { kind: 'failed', message: 'down' }, retry)).toEqual({
      step: 'failed',
      message: 'down',
      retry,
    });
  });
});
