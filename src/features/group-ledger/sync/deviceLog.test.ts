import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Change,
  ConfirmedOp,
  GroupId,
  OpId,
  UserId,
} from '@features/group-ledger/domain/types';
import { openDeviceLog } from '@features/group-ledger/sync/deviceLog';

const groupId = 'g-1' as GroupId;
const rename = (name: string): Change => ({ kind: 'group.renamed', name });

function confirmedOp(seq: number, id: string, name = `name ${seq}`): ConfirmedOp {
  return {
    id: id as OpId,
    seq,
    at: '2026-11-19T10:00:00.000Z',
    change: rename(name),
    userId: 'u-1' as UserId,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('device log', () => {
  it('stores a pending op under its own key before returning it', () => {
    const log = openDeviceLog('ana', groupId, () => '2026-11-19T10:00:00.000Z');

    const op = log.appendPending(rename('Japan'));

    expect(op.order).toBe(1);
    expect(JSON.parse(window.localStorage.getItem(`split:g:ana:g-1:out:${op.id}`) ?? '')).toEqual({
      id: op.id,
      order: 1,
      at: '2026-11-19T10:00:00.000Z',
      change: { kind: 'group.renamed', name: 'Japan' },
    });
  });

  it('lists pending ops in the order this phone made them, across reopenings and groups', () => {
    const first = openDeviceLog('ana', groupId).appendPending(rename('one'));
    const elsewhere = openDeviceLog('ana', 'g-2' as GroupId).appendPending(rename('other group'));
    const second = openDeviceLog('ana', groupId).appendPending(rename('two'));

    const pending = openDeviceLog('ana', groupId).pending();

    expect(pending.map((op) => op.id)).toEqual([first.id, second.id]);
    expect([first.order, elsewhere.order, second.order]).toEqual([1, 2, 3]);
  });

  it('keeps counting after the order counter is lost', () => {
    const log = openDeviceLog('ana', groupId);
    log.appendPending(rename('one'));
    log.appendPending(rename('two'));
    window.localStorage.removeItem('split:g:ana:order');

    const third = log.appendPending(rename('three'));

    expect(third.order).toBe(3);
  });

  it('keeps one phone apart from another in the same browser', () => {
    openDeviceLog('ana', groupId).appendPending(rename('from ana'));

    expect(openDeviceLog('ben', groupId).pending()).toEqual([]);
  });

  it('retires a pending op when the server confirms it, however often it is told', () => {
    const log = openDeviceLog('ana', groupId);
    const mine = log.appendPending(rename('mine'));
    const stillPending = log.appendPending(rename('later'));
    const confirmed = [confirmedOp(1, 'op-theirs'), confirmedOp(2, mine.id, 'mine')];

    log.confirm(confirmed);
    log.confirm(confirmed);

    expect(log.confirmed()).toEqual(confirmed);
    expect(log.pending().map((op) => op.id)).toEqual([stillPending.id]);
  });

  it('merges pages by seq and lets a later read of a seq replace the earlier one', () => {
    const log = openDeviceLog('ana', groupId);
    log.confirm([confirmedOp(1, 'op-1'), { ...confirmedOp(2, 'op-2'), change: null }]);

    log.confirm([confirmedOp(2, 'op-2', 'now readable'), confirmedOp(3, 'op-3')]);

    expect(log.confirmed().map((op) => [op.seq, op.change])).toEqual([
      [1, rename('name 1')],
      [2, rename('now readable')],
      [3, rename('name 3')],
    ]);
  });

  it('keeps only the ops before a gap, so the rest is pulled again', () => {
    const log = openDeviceLog('ana', groupId);

    log.confirm([confirmedOp(1, 'op-1'), confirmedOp(2, 'op-2'), confirmedOp(4, 'op-4')]);

    expect(log.confirmed().map((op) => op.seq)).toEqual([1, 2]);
  });

  it('reads a stored log with a damaged entry up to that entry', () => {
    window.localStorage.setItem(
      'split:g:ana:g-1:confirmed',
      JSON.stringify([confirmedOp(1, 'op-1'), { seq: 'two' }, confirmedOp(3, 'op-3')]),
    );

    expect(
      openDeviceLog('ana', groupId)
        .confirmed()
        .map((op) => op.seq),
    ).toEqual([1]);
  });

  it('skips a pending key that no longer parses', () => {
    const log = openDeviceLog('ana', groupId);
    const good = log.appendPending(rename('good'));
    window.localStorage.setItem('split:g:ana:g-1:out:broken', '{not json');

    expect(log.pending().map((op) => op.id)).toEqual([good.id]);
  });

  it('drops the pending ops the server refused', () => {
    const log = openDeviceLog('ana', groupId);
    const refused = log.appendPending(rename('too big'));
    const kept = log.appendPending(rename('fine'));

    log.drop([refused.id]);

    expect(log.pending().map((op) => op.id)).toEqual([kept.id]);
  });

  it('holds an op in memory when storage is full, until the server confirms it', () => {
    const log = openDeviceLog('ana', groupId);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const op = log.appendPending(rename('unsaved'));
    setItem.mockRestore();

    expect(window.localStorage.getItem(`split:g:ana:g-1:out:${op.id}`)).toBeNull();
    expect(log.pending().map((pending) => pending.id)).toEqual([op.id]);

    log.confirm([confirmedOp(1, op.id, 'unsaved')]);

    expect(log.pending()).toEqual([]);
  });

  it('leaves an op pending when the confirmed log could not be written', () => {
    const log = openDeviceLog('ana', groupId);
    const op = log.appendPending(rename('mine'));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    log.confirm([confirmedOp(1, op.id, 'mine')]);
    setItem.mockRestore();

    expect(log.confirmed()).toEqual([]);
    expect(log.pending().map((pending) => pending.id)).toEqual([op.id]);
  });

  it('remembers which user this phone entered the group as', () => {
    const log = openDeviceLog('ana', groupId);

    expect(log.memberAs()).toBeNull();
    log.setMemberAs('u-ana' as UserId);

    expect(openDeviceLog('ana', groupId).memberAs()).toBe('u-ana');
  });

  it('knows its own storage keys from another group or phone', () => {
    const log = openDeviceLog('ana', groupId);

    expect(log.owns('split:g:ana:g-1:confirmed')).toBe(true);
    expect(log.owns('split:g:ana:g-2:confirmed')).toBe(false);
    expect(log.owns('split:g:ben:g-1:confirmed')).toBe(false);
    expect(log.owns(null)).toBe(false);
  });

  it('clears the group from this phone and leaves other groups alone', () => {
    const log = openDeviceLog('ana', groupId);
    log.appendPending(rename('gone'));
    log.confirm([confirmedOp(1, 'op-1')]);
    const other = openDeviceLog('ana', 'g-2' as GroupId);
    other.appendPending(rename('stays'));

    log.clear();

    expect(log.pending()).toEqual([]);
    expect(log.confirmed()).toEqual([]);
    expect(other.pending()).toHaveLength(1);
  });
});
