import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageServer } from '@features/group-ledger/backend/fakeServer';
import {
  createdOp,
  newGroup,
  pendingOp,
} from '@features/group-ledger/backend/testing/backendContract';

beforeEach(() => {
  window.localStorage.clear();
});

describe('the fake server in localStorage', () => {
  it('is one server for every tab of the browser', async () => {
    const group = newGroup();
    const tabOne = createLocalStorageServer();
    const tabTwo = createLocalStorageServer();
    const op = pendingOp();

    await tabOne.createGroup('u-ana', group.groupId, group.inviteCode, createdOp());
    const joined = await tabTwo.joinGroup('u-ben', group.inviteCode);
    await tabOne.appendOps('u-ana', group.groupId, [op]);
    const seenByBen = await tabTwo.opsAfter('u-ben', group.groupId, 1, 10);

    expect(joined).toEqual({ ok: true, value: group.groupId });
    expect(seenByBen).toEqual({
      ok: true,
      value: [{ id: op.id, seq: 2, at: op.at, change: op.change, userId: 'u-ana' }],
    });
    expect(Object.keys(window.localStorage)).toEqual(['split.fakeServer.state']);
  });

  it('numbers appends that arrive together without a gap or a repeat', async () => {
    const group = newGroup();
    const tabOne = createLocalStorageServer();
    const tabTwo = createLocalStorageServer();
    await tabOne.createGroup('u-ana', group.groupId, group.inviteCode, createdOp());
    await tabTwo.joinGroup('u-ben', group.inviteCode);

    await Promise.all([
      tabOne.appendOps('u-ana', group.groupId, [pendingOp(), pendingOp()]),
      tabTwo.appendOps('u-ben', group.groupId, [pendingOp(), pendingOp()]),
      tabOne.appendOps('u-ana', group.groupId, [pendingOp()]),
    ]);
    const all = await tabOne.opsAfter('u-ana', group.groupId, 0, 10);

    expect(all.ok && all.value.map((op) => op.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pokes the subscribers of the group that changed, until they unsubscribe', async () => {
    const group = newGroup();
    const other = newGroup();
    const server = createLocalStorageServer();
    await server.createGroup('u-ana', group.groupId, group.inviteCode, createdOp());
    const onPoke = vi.fn();
    const onOtherPoke = vi.fn();
    const unsubscribe = server.subscribe(group.groupId, onPoke);
    server.subscribe(other.groupId, onOtherPoke);

    const op = pendingOp();
    await server.appendOps('u-ana', group.groupId, [op]);
    await vi.waitFor(() => expect(onPoke).toHaveBeenCalledTimes(1));
    // The same op again adds nothing, so there is nothing to hear about.
    await server.appendOps('u-ana', group.groupId, [op]);
    await Promise.resolve();
    expect(onPoke).toHaveBeenCalledTimes(1);
    unsubscribe();
    await server.appendOps('u-ana', group.groupId, [pendingOp()]);
    await Promise.resolve();

    expect(onPoke).toHaveBeenCalledTimes(1);
    expect(onOtherPoke).not.toHaveBeenCalled();
  });

  it('starts empty again when what is stored is not a server state', async () => {
    window.localStorage.setItem('split.fakeServer.state', '{"groups": 3}');
    const server = createLocalStorageServer();

    const groups = await server.myGroups('u-ana');

    expect(groups).toEqual({ ok: true, value: [] });
  });

  it('fails the call, and the ones after it still run, when storage cannot be written', async () => {
    const group = newGroup();
    const server = createLocalStorageServer();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    const created = await server.createGroup('u-ana', group.groupId, group.inviteCode, createdOp());
    setItem.mockRestore();
    const createdAfter = await server.createGroup(
      'u-ana',
      group.groupId,
      group.inviteCode,
      createdOp(),
    );

    expect(created).toMatchObject({ ok: false, failure: { kind: 'failed' } });
    expect(createdAfter).toEqual({ ok: true, value: undefined });
  });

  it('uses a Web Lock where the browser has one', async () => {
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => work());
    vi.stubGlobal('navigator', { locks: { request } });
    const server = createLocalStorageServer();

    await server.myGroups('u-ana');
    vi.unstubAllGlobals();

    expect(request).toHaveBeenCalledWith('split.fakeServer.lock', expect.any(Function));
  });

  it('remembers which user an email signs in, whatever its case', async () => {
    const server = createLocalStorageServer();

    const before = await server.emailOwner('ana@example.com');
    const claimed = await server.claimEmail('Ana@Example.com ', 'u-ana');
    const claimedByAnother = await server.claimEmail('ana@example.com', 'u-ben');
    const after = await createLocalStorageServer().emailOwner('ANA@example.com');

    expect(before).toEqual({ ok: true, value: null });
    expect(claimed).toEqual({ ok: true, value: 'u-ana' });
    expect(claimedByAnother).toEqual({ ok: true, value: 'u-ana' });
    expect(after).toEqual({ ok: true, value: 'u-ana' });
  });
});
