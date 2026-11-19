import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { GroupId } from '@features/group-ledger/domain/types';
import { createSupabaseBackend } from '@features/group-ledger/backend/supabaseBackend';
import {
  createdOp,
  newGroup,
  pendingOp,
} from '@features/group-ledger/backend/testing/backendContract';

const anonymous = { id: 'u-anon', is_anonymous: true };
const linked = { id: 'u-ana', is_anonymous: false, email: 'ana@example.com' };
const noError = { error: null };

function fakeClient(user: typeof anonymous | typeof linked | null = anonymous) {
  const channel = {
    on: vi.fn<(...args: unknown[]) => unknown>(),
    subscribe: vi.fn<(onStatus: (status: string) => void) => unknown>(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: user && { user } }, ...noError })),
    signInAnonymously: vi.fn(async () => ({ data: { user: anonymous }, ...noError })),
    updateUser: vi.fn(async (): Promise<{ error: unknown }> => noError),
    signInWithOtp: vi.fn(async (): Promise<{ error: unknown }> => noError),
    verifyOtp: vi.fn<
      (args: { type: string }) => Promise<{ data: { user: unknown }; error: unknown }>
    >(async () => ({ data: { user: linked }, ...noError })),
    signOut: vi.fn(async (): Promise<{ error: unknown }> => noError),
  };
  const client = {
    auth,
    rpc: vi.fn(async (): Promise<{ data: unknown; error: unknown }> => ({
      data: null,
      ...noError,
    })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  };
  return {
    auth,
    channel,
    client,
    backend: createSupabaseBackend(client as unknown as SupabaseClient),
  };
}

const fetchFailed = { message: 'TypeError: Failed to fetch', code: '' };

describe('supabase backend sessions', () => {
  it('answers from the stored session without signing in again', async () => {
    const { auth, backend } = fakeClient(linked);

    const session = await backend.session();

    expect(session).toEqual({
      ok: true,
      value: { userId: 'u-ana', account: { kind: 'linked', email: 'ana@example.com' } },
    });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs a new phone in anonymously once, however many calls arrive together', async () => {
    const { auth, backend } = fakeClient(null);

    const [first, second] = await Promise.all([backend.session(), backend.myGroups()]);

    expect(first).toEqual({
      ok: true,
      value: { userId: 'u-anon', account: { kind: 'anonymous' } },
    });
    expect(second.ok).toBe(false);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('reads a dropped connection as offline, from Auth and from the database', async () => {
    const offlinePhone = fakeClient(null);
    offlinePhone.auth.signInAnonymously.mockResolvedValue({
      data: { user: null as never },
      error: { name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 } as never,
    });
    const signedIn = fakeClient();
    signedIn.client.rpc.mockResolvedValue({ data: null, error: fetchFailed });

    expect(await offlinePhone.backend.session()).toEqual({
      ok: false,
      failure: { kind: 'offline' },
    });
    expect(await signedIn.backend.push(newGroup().groupId, [pendingOp()])).toEqual({
      ok: false,
      failure: { kind: 'offline' },
    });
  });

  it('reads a thrown error as a failure rather than letting it escape', async () => {
    const { auth, backend } = fakeClient();
    auth.getSession.mockRejectedValue(new Error('storage is broken'));

    expect(await backend.session()).toEqual({
      ok: false,
      failure: { kind: 'failed', message: 'storage is broken' },
    });
  });

  it('signs out of this phone only', async () => {
    const { auth, backend } = fakeClient(linked);

    const signedOut = await backend.signOut();

    expect(signedOut).toEqual({ ok: true, value: undefined });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('supabase backend email sign-in', () => {
  it('attaches a new email to the anonymous user and verifies it as an email change', async () => {
    const { auth, backend } = fakeClient();

    const started = await backend.startEmailSignIn('ana@example.com');
    const verified = await backend.verifyEmailCode('ana@example.com', '123456');

    expect(started).toEqual({ ok: true, value: { mode: 'link' } });
    expect(auth.updateUser).toHaveBeenCalledWith({ email: 'ana@example.com' });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.verifyOtp.mock.calls).toEqual([
      [{ email: 'ana@example.com', token: '123456', type: 'email_change' }],
    ]);
    expect(verified).toMatchObject({ ok: true, value: { userId: 'u-ana' } });
  });

  it('sends a sign-in code when the email already has an account', async () => {
    const { auth, backend } = fakeClient();
    auth.updateUser.mockResolvedValue({
      error: {
        code: 'email_exists',
        message: 'A user with this email has already been registered',
      },
    });

    const started = await backend.startEmailSignIn('ana@example.com');
    await backend.verifyEmailCode('ana@example.com', '123456');

    expect(started).toEqual({ ok: true, value: { mode: 'sign-in' } });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      options: { shouldCreateUser: false },
    });
    expect(auth.verifyOtp.mock.calls).toEqual([
      [{ email: 'ana@example.com', token: '123456', type: 'email' }],
    ]);
  });

  it('never changes the email of a phone that already has an account', async () => {
    const { auth, backend } = fakeClient(linked);

    const started = await backend.startEmailSignIn('other@example.com');

    expect(started).toEqual({ ok: true, value: { mode: 'sign-in' } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('stops when attaching the email fails for another reason', async () => {
    const { auth, backend } = fakeClient();
    auth.updateUser.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', message: 'Slow down' },
    });

    const started = await backend.startEmailSignIn('ana@example.com');

    expect(started).toEqual({ ok: false, failure: { kind: 'failed', message: 'Slow down' } });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('tries both kinds of code after a reload forgot which one was sent', async () => {
    const { auth, backend } = fakeClient();
    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'otp_expired', message: 'Token has expired or is invalid' },
    });

    const verified = await backend.verifyEmailCode('ana@example.com', '123456');

    expect(auth.verifyOtp.mock.calls.map(([args]) => args.type)).toEqual(['email_change', 'email']);
    expect(verified.ok).toBe(true);
  });

  it('reports a refused code, and does not try again when the phone is offline', async () => {
    const refused = fakeClient();
    refused.auth.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { code: 'otp_expired', message: 'Token has expired or is invalid' },
    });
    const offline = fakeClient();
    offline.auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: fetchFailed });

    expect(await refused.backend.verifyEmailCode('ana@example.com', '000000')).toEqual({
      ok: false,
      failure: { kind: 'failed', message: 'Token has expired or is invalid' },
    });
    expect(await offline.backend.verifyEmailCode('ana@example.com', '000000')).toEqual({
      ok: false,
      failure: { kind: 'offline' },
    });
    expect(offline.auth.verifyOtp).toHaveBeenCalledTimes(1);
  });
});

describe('supabase backend replies', () => {
  it('reads the names the SQL functions raise', async () => {
    const { client, backend } = fakeClient();
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'not_a_member', code: 'P0001' },
    });
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'invite_not_found', code: 'P0001' },
    });
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'group_exists', code: 'P0001' },
    });
    const group = newGroup();

    expect(await backend.push(group.groupId, [])).toEqual({
      ok: false,
      failure: { kind: 'not-a-member' },
    });
    expect(await backend.joinGroup(group.inviteCode)).toEqual({
      ok: false,
      failure: { kind: 'invite-not-found' },
    });
    expect(await backend.publishGroup(group, createdOp())).toEqual({
      ok: false,
      failure: { kind: 'failed', message: 'group_exists' },
    });
  });

  it('fails rather than trusting a reply of the wrong shape', async () => {
    const { client, backend } = fakeClient();
    client.rpc.mockResolvedValue({ data: { accepted: 'all of them' }, ...noError });

    const pushed = await backend.push(newGroup().groupId, [pendingOp()]);

    expect(pushed).toMatchObject({ ok: false, failure: { kind: 'failed' } });
  });

  it('leaves out a rejected op that had no id', async () => {
    const { client, backend } = fakeClient();
    client.rpc.mockResolvedValue({ data: { accepted: [], rejected: [null, 'op-1'] }, ...noError });

    const pushed = await backend.push(newGroup().groupId, [pendingOp()]);

    expect(pushed).toEqual({ ok: true, value: { accepted: [], rejected: ['op-1'] } });
  });
});

describe('supabase backend pokes', () => {
  const groupId = 'g-1' as GroupId;

  it('listens for new ops of the group and pokes on each, and on every (re)connect', async () => {
    const { channel, client, backend } = fakeClient();
    const onPoke = vi.fn();

    backend.subscribe(groupId, onPoke);
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
    const onInsert = channel.on.mock.calls[0] as unknown as [string, unknown, () => void];
    const onStatus = channel.subscribe.mock.calls[0][0];
    onStatus('SUBSCRIBED');
    onStatus('CHANNEL_ERROR');
    onInsert[2]();

    expect(client.channel).toHaveBeenCalledWith('ops:g-1');
    expect(onInsert.slice(0, 2)).toEqual([
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ops', filter: 'group_id=eq.g-1' },
    ]);
    expect(onPoke).toHaveBeenCalledTimes(2);
  });

  it('never joins a channel it was told to drop before the phone had signed in', async () => {
    const { channel, client, backend } = fakeClient();

    const unsubscribe = backend.subscribe(groupId, vi.fn());
    unsubscribe();
    await backend.session();
    await Promise.resolve();

    expect(channel.subscribe).not.toHaveBeenCalled();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
