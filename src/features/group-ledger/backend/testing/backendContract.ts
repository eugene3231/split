import { describe, expect, it } from 'vitest';
import type {
  Change,
  InviteCode,
  MemberId,
  OpId,
  PendingOp,
} from '@features/group-ledger/domain/types';
import { fitsOnServer } from '@features/group-ledger/backend/limits';
import type { JoinedGroup, LedgerBackend } from '@features/group-ledger/backend/port';
import { newGroupId, newOpId, newUuid } from '@features/group-ledger/logic/ids';

export interface ContractWorld {
  phone(): Promise<LedgerBackend>;
}

export function newGroup(): JoinedGroup {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const code = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return { groupId: newGroupId(), inviteCode: code as InviteCode };
}

let order = 0;

export function pendingOp(
  change: Change = { kind: 'group.renamed', name: 'Japan 2026' },
): PendingOp {
  order += 1;
  return { id: newOpId(), order, at: '2026-11-19T10:00:00.000Z', change };
}

function memberPutOfBytes(bytes: number): Change {
  const named = (name: string): Change => ({
    kind: 'member.put',
    member: { id: 'm-1' as MemberId, name, paynowMobile: null, archived: false },
  });
  const empty = new TextEncoder().encode(JSON.stringify(named('é'))).length;
  return named(`é${'x'.repeat(bytes - empty)}`);
}

export function createdOp(): PendingOp {
  return pendingOp({ kind: 'group.created', name: 'Japan 2026', currency: 'SGD' });
}

async function value<T>(
  result: Promise<{ ok: true; value: T } | { ok: false; failure: unknown }>,
): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new Error(`Expected ok, got ${JSON.stringify(settled.failure)}`);
  return settled.value;
}

export function describeBackendContract(name: string, makeWorld: () => Promise<ContractWorld>) {
  describe(`backend contract: ${name}`, () => {
    async function publishedGroup() {
      const world = await makeWorld();
      const ana = await world.phone();
      const group = newGroup();
      const first = createdOp();
      await value(ana.publishGroup(group, first));
      return { world, ana, group, first };
    }

    it('creates a group with its first op already at seq 1, stamped with the caller', async () => {
      const { ana, group, first } = await publishedGroup();

      const pulled = await value(ana.pull(group.groupId, 0));
      const me = await value(ana.session());

      expect(pulled.ops.map(({ seq, id, change, userId }) => [seq, id, change, userId])).toEqual([
        [1, first.id, first.change, me.userId],
      ]);
    });

    it('creates nothing when the first op is one it would never take', async () => {
      const world = await makeWorld();
      const ana = await world.phone();
      const group = newGroup();
      const tooBig = pendingOp({
        kind: 'group.created',
        name: 'x'.repeat(70_000),
        currency: 'SGD',
      });

      const published = await ana.publishGroup(group, tooBig);
      const joined = await ana.joinGroup(group.inviteCode);

      expect(published.ok).toBe(false);
      expect(joined).toEqual({ ok: false, failure: { kind: 'invite-not-found' } });
    });

    it('lets a friend who joins the moment the group exists write only after its first op', async () => {
      const { world, ana, group, first } = await publishedGroup();
      const ben = await world.phone();
      const fromBen = pendingOp();

      await value(ben.joinGroup(group.inviteCode));
      await value(ben.push(group.groupId, [fromBen]));
      await value(ana.push(group.groupId, [first]));
      const pulled = await value(ana.pull(group.groupId, 0));

      expect(pulled.ops.map((op) => [op.seq, op.id])).toEqual([
        [1, first.id],
        [2, fromBen.id],
      ]);
    });

    it('numbers ops 2, 3, 4 after the first, in the order pushed, and stamps the caller on each', async () => {
      const { ana, group } = await publishedGroup();
      const ops = [pendingOp(), pendingOp(), pendingOp()];

      const outcome = await value(ana.push(group.groupId, ops));
      const pulled = await value(ana.pull(group.groupId, 1));
      const me = await value(ana.session());

      expect(outcome).toEqual({ accepted: ops.map((op) => op.id), rejected: [] });
      expect(pulled.more).toBe(false);
      expect(pulled.ops.map((op) => [op.seq, op.id])).toEqual([
        [2, ops[0].id],
        [3, ops[1].id],
        [4, ops[2].id],
      ]);
      expect(pulled.ops.map((op) => op.userId)).toEqual([me.userId, me.userId, me.userId]);
      expect(pulled.ops[0].change).toEqual({ kind: 'group.renamed', name: 'Japan 2026' });
    });

    it('stores an op once however often it is pushed, and accepts it every time', async () => {
      const { ana, group } = await publishedGroup();
      const first = pendingOp();
      const second = pendingOp();

      await value(ana.push(group.groupId, [first]));
      const again = await value(ana.push(group.groupId, [first, second]));
      const pulled = await value(ana.pull(group.groupId, 1));

      expect(again).toEqual({ accepted: [first.id, second.id], rejected: [] });
      expect(pulled.ops.map((op) => [op.seq, op.id])).toEqual([
        [2, first.id],
        [3, second.id],
      ]);
    });

    it('rejects an op over 64 KB and still takes the ops around it, with no gap', async () => {
      const { ana, group } = await publishedGroup();
      const before = pendingOp();
      const huge = pendingOp({ kind: 'group.renamed', name: 'x'.repeat(70_000) });
      const after = pendingOp();

      const outcome = await value(ana.push(group.groupId, [before, huge, after]));
      const pulled = await value(ana.pull(group.groupId, 1));

      expect(outcome).toEqual({ accepted: [before.id, after.id], rejected: [huge.id] });
      expect(pulled.ops.map((op) => [op.seq, op.id])).toEqual([
        [2, before.id],
        [3, after.id],
      ]);
    });

    it('takes a change of exactly 64 KB, measured as the phone measures it, and rejects one byte more', async () => {
      const { ana, group } = await publishedGroup();
      const atTheLimit = pendingOp(memberPutOfBytes(65536));
      const oneByteOver = pendingOp(memberPutOfBytes(65537));

      const outcome = await value(ana.push(group.groupId, [atTheLimit, oneByteOver]));

      expect(outcome).toEqual({ accepted: [atTheLimit.id], rejected: [oneByteOver.id] });
      expect([fitsOnServer(atTheLimit.change), fitsOnServer(oneByteOver.change)]).toEqual([
        true,
        false,
      ]);
    });

    it('rejects an op whose id is not a lowercase uuid', async () => {
      const { ana, group } = await publishedGroup();
      const odd = { ...pendingOp(), id: 'op-1' as OpId };
      const upper = { ...pendingOp(), id: newUuid().toUpperCase() as OpId };
      const fine = pendingOp();

      const outcome = await value(ana.push(group.groupId, [odd, upper, fine]));

      expect(outcome).toEqual({ accepted: [fine.id], rejected: [odd.id, upper.id] });
    });

    it('rejects an op id that another group already holds', async () => {
      const { ana, group } = await publishedGroup();
      const other = newGroup();
      await value(ana.publishGroup(other, createdOp()));
      const op = pendingOp();
      await value(ana.push(group.groupId, [op]));

      const outcome = await value(ana.push(other.groupId, [op]));
      const pulled = await value(ana.pull(other.groupId, 1));

      expect(outcome).toEqual({ accepted: [], rejected: [op.id] });
      expect(pulled.ops).toEqual([]);
    });

    it('keeps an op it cannot read as a null change, so seq has no gap', async () => {
      const { ana, group } = await publishedGroup();
      const fromTheFuture = pendingOp({ kind: 'group.archived' } as unknown as Change);
      const known = pendingOp();

      await value(ana.push(group.groupId, [fromTheFuture, known]));
      const pulled = await value(ana.pull(group.groupId, 1));

      expect(pulled.ops.map((op) => [op.seq, op.change])).toEqual([
        [2, null],
        [3, { kind: 'group.renamed', name: 'Japan 2026' }],
      ]);
    });

    it('lets nobody push or read before they join', async () => {
      const { world, ana, group } = await publishedGroup();
      await value(ana.push(group.groupId, [pendingOp()]));
      const ben = await world.phone();

      const pushed = await ben.push(group.groupId, [pendingOp()]);
      const pulled = await value(ben.pull(group.groupId, 0));

      expect(pushed).toEqual({ ok: false, failure: { kind: 'not-a-member' } });
      expect(pulled).toEqual({ ops: [], more: false });
    });

    it('answers a push to a group that does not exist like one the caller is not in', async () => {
      const world = await makeWorld();
      const ana = await world.phone();

      const pushed = await ana.push(newGroup().groupId, [pendingOp()]);

      expect(pushed).toEqual({ ok: false, failure: { kind: 'not-a-member' } });
    });

    it('joins with the invite code, as often as asked, and then shares one log', async () => {
      const { world, ana, group } = await publishedGroup();
      const ben = await world.phone();
      const fromAna = pendingOp();
      const fromBen = pendingOp();

      const joined = await value(ben.joinGroup(group.inviteCode));
      const joinedAgain = await value(ben.joinGroup(group.inviteCode));
      await value(ana.push(group.groupId, [fromAna]));
      await value(ben.push(group.groupId, [fromBen]));
      const anaSees = await value(ana.pull(group.groupId, 1));
      const benSees = await value(ben.pull(group.groupId, 1));
      const benSession = await value(ben.session());

      expect(joined).toEqual(group);
      expect(joinedAgain).toEqual(group);
      expect(benSees.ops.map((op) => [op.seq, op.id])).toEqual([
        [2, fromAna.id],
        [3, fromBen.id],
      ]);
      expect(benSees.ops[1].userId).toBe(benSession.userId);
      expect(anaSees).toEqual(benSees);
    });

    it('finds no group for a code nobody made', async () => {
      const world = await makeWorld();
      const ben = await world.phone();

      const joined = await ben.joinGroup(newGroup().inviteCode);

      expect(joined).toEqual({ ok: false, failure: { kind: 'invite-not-found' } });
    });

    it('publishes the same group twice without changing it', async () => {
      const { ana, group, first } = await publishedGroup();
      const op = pendingOp();
      await value(ana.push(group.groupId, [op]));

      const again = await ana.publishGroup(group, first);
      const withAnotherFirstOp = await ana.publishGroup(group, createdOp());
      const pulled = await value(ana.pull(group.groupId, 0));

      expect(again).toEqual({ ok: true, value: undefined });
      expect(withAnotherFirstOp).toEqual({ ok: true, value: undefined });
      expect(pulled.ops.map((op) => op.id)).toEqual([first.id, op.id]);
    });

    it('gives nothing to someone who knows a group id but not its code', async () => {
      const { world, ana, group } = await publishedGroup();
      await value(ana.push(group.groupId, [pendingOp()]));
      const eve = await world.phone();

      const published = await eve.publishGroup(
        { groupId: group.groupId, inviteCode: newGroup().inviteCode },
        createdOp(),
      );
      const pushed = await eve.push(group.groupId, [pendingOp()]);
      const pulled = await value(eve.pull(group.groupId, 0));

      expect(published.ok).toBe(false);
      expect(pushed).toEqual({ ok: false, failure: { kind: 'not-a-member' } });
      expect(pulled.ops).toEqual([]);
    });

    it('refuses a second group that reuses an invite code', async () => {
      const { world, group } = await publishedGroup();
      const eve = await world.phone();

      const published = await eve.publishGroup(
        { groupId: newGroup().groupId, inviteCode: group.inviteCode },
        createdOp(),
      );

      expect(published.ok).toBe(false);
    });

    it('lists the groups a user is in, with the code that opens each', async () => {
      const { world, ana, group } = await publishedGroup();
      const second = newGroup();
      await value(ana.publishGroup(second, createdOp()));
      const ben = await world.phone();
      await value(ben.joinGroup(second.inviteCode));

      const anaGroups = await value(ana.myGroups());
      const benGroups = await value(ben.myGroups());

      expect(anaGroups).toHaveLength(2);
      expect(anaGroups).toEqual(expect.arrayContaining([group, second]));
      expect(benGroups).toEqual([second]);
    });

    it('pulls a long log in pages of 500 and says when more remain', async () => {
      const { ana, group } = await publishedGroup();
      for (let batch = 0; batch < 10; batch += 1) {
        await value(
          ana.push(
            group.groupId,
            Array.from({ length: 50 }, () => pendingOp()),
          ),
        );
      }

      const first = await value(ana.pull(group.groupId, 0));
      const second = await value(ana.pull(group.groupId, 500));

      expect(first.more).toBe(true);
      expect(first.ops).toHaveLength(500);
      expect(first.ops.at(-1)?.seq).toBe(500);
      expect(second.more).toBe(false);
      expect(second.ops.map((op) => op.seq)).toEqual([501]);
    });
  });
}
