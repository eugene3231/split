import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSupabaseBackend } from '@features/group-ledger/backend/supabaseBackend';
import {
  createdOp,
  describeBackendContract,
  newGroup,
  pendingOp,
} from '@features/group-ledger/backend/testing/backendContract';
import {
  createPgliteProject,
  type PgliteProject,
} from '@features/group-ledger/backend/testing/pgliteSupabase';

import { newUuid } from '@features/group-ledger/logic/ids';

// The migration, run in a Postgres inside this process, behind the real Supabase adapter.

let project: PgliteProject;

beforeAll(async () => {
  project = await createPgliteProject();
});

afterAll(async () => {
  await project.close();
});

describeBackendContract('the migration, through the Supabase adapter', async () => ({
  phone: async () => createSupabaseBackend((await project.client()).client),
}));

describe('what the migration lets a client do to the tables', () => {
  async function groupWithOneOp() {
    const ana = await project.client();
    const backend = createSupabaseBackend(ana.client);
    const group = newGroup();
    await backend.publishGroup(group, createdOp());
    return { ana, group };
  }

  const countOps = (groupId: string) =>
    `select count(*)::int as data from public.ops where group_id = '${groupId}'`;

  it('lets a member read the ops and an outsider read none', async () => {
    const { ana, group } = await groupWithOneOp();
    const eve = await project.client();

    const asMember = await project.sql(ana.userId, 'authenticated', countOps(group.groupId));
    const asOutsider = await project.sql(eve.userId, 'authenticated', countOps(group.groupId));

    expect(asMember.data).toBe(1);
    expect(asOutsider.data).toBe(0);
  });

  it('rejects a change that is not the text of a JSON object, without failing the ops around it', async () => {
    const { ana, group } = await groupWithOneOp();
    const at = '2026-11-19T10:00:00.000Z';
    const ops = [
      { id: newUuid(), at, change: '{"kind":"group.renamed"' },
      { id: newUuid(), at, change: '[1]' },
      { id: newUuid(), at, change: { kind: 'group.renamed', name: 'sent as an object' } },
      { id: newUuid(), at },
      { id: newUuid(), at, change: '{"kind":"group.renamed","name":"fine"}' },
    ];

    const appended = await project.sql(
      ana.userId,
      'authenticated',
      `select public.append_ops('${group.groupId}', '${JSON.stringify(ops)}') as data`,
    );

    expect(appended.error).toBeNull();
    expect(appended.data).toEqual({
      accepted: [ops[4].id],
      rejected: ops.slice(0, 4).map((op) => op.id),
    });
  });

  it('lets no client call the function that takes the author as an argument', async () => {
    const { ana, group } = await groupWithOneOp();
    const op = JSON.stringify({ ...pendingOp(), change: '{"kind":"group.renamed","name":"x"}' });

    const inserted = await project.sql(
      ana.userId,
      'authenticated',
      `select public.insert_op('${group.groupId}', gen_random_uuid(), 99, '${op}') as data`,
    );

    expect(inserted.error?.message).toMatch(/permission denied/);
  });

  it('lets no client write an op directly, so none can pick a seq or an author', async () => {
    const { ana, group } = await groupWithOneOp();

    const inserted = await project.sql(
      ana.userId,
      'authenticated',
      `insert into public.ops (group_id, seq, id, change, user_id, at)
       values ('${group.groupId}', 99, gen_random_uuid(), '{}', gen_random_uuid(), now())`,
    );
    const updated = await project.sql(
      ana.userId,
      'authenticated',
      `update public.ops set change = '{}' where group_id = '${group.groupId}'`,
    );
    const deleted = await project.sql(ana.userId, 'authenticated', 'delete from public.ops');
    const truncated = await project.sql(ana.userId, 'authenticated', 'truncate public.ops');

    expect(inserted.error?.message).toMatch(/permission denied/);
    expect(updated.error?.message).toMatch(/permission denied/);
    expect(deleted.error?.message).toMatch(/permission denied/);
    expect(truncated.error?.message).toMatch(/permission denied/);
  });

  it('lets no client add itself to a group or move a group head', async () => {
    const { group } = await groupWithOneOp();
    const eve = await project.client();

    const joined = await project.sql(
      eve.userId,
      'authenticated',
      `insert into public.memberships (group_id, user_id) values ('${group.groupId}', '${eve.userId}')`,
    );
    const listed = await project.sql(
      eve.userId,
      'authenticated',
      'select count(*)::int as data from public.memberships',
    );
    const moved = await project.sql(
      eve.userId,
      'authenticated',
      'update public.groups set head = 0',
    );

    expect(joined.error?.message).toMatch(/permission denied/);
    expect(listed.error?.message).toMatch(/permission denied/);
    expect(moved.error?.message).toMatch(/permission denied/);
  });

  it('gives a signed-out client no tables and no functions', async () => {
    const { ana, group } = await groupWithOneOp();

    const read = await project.sql(ana.userId, 'anon', countOps(group.groupId));
    const joined = await project.sql(
      ana.userId,
      'anon',
      `select public.join_group('${group.inviteCode}') as data`,
    );
    const appended = await project.sql(
      ana.userId,
      'anon',
      `select public.append_ops('${group.groupId}', '[]') as data`,
    );

    expect(read.error?.message).toMatch(/permission denied/);
    expect(joined.error?.message).toMatch(/permission denied/);
    expect(appended.error?.message).toMatch(/permission denied/);
  });

  it('keeps the log when the account that wrote it is deleted', async () => {
    const { ana, group } = await groupWithOneOp();
    const ben = await project.client();
    await createSupabaseBackend(ben.client).joinGroup(group.inviteCode);

    await project.deleteUser(ana.userId);
    const asBen = await project.sql(ben.userId, 'authenticated', countOps(group.groupId));

    expect(asBen.data).toBe(1);
  });
});
