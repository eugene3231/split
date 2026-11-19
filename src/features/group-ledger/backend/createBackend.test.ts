import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupId } from '@features/group-ledger/domain/types';
import {
  createBackend,
  deviceProfile,
  lazyBackend,
  supabaseConfig,
} from '@features/group-ledger/backend/createBackend';
import { createFakeBackend } from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer } from '@features/group-ledger/backend/fakeServer';
import { newGroup, pendingOp } from '@features/group-ledger/backend/testing/backendContract';

const supabaseEnv = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' };

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('choosing a backend', () => {
  it('uses Supabase only when both env vars are set', () => {
    expect(supabaseConfig(supabaseEnv)).toEqual({ url: 'https://x.supabase.co', anonKey: 'key' });
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })).toBeNull();
    expect(supabaseConfig({})).toBeNull();
  });

  it('treats the browser as one phone on Supabase and each tab as a phone on the fake', () => {
    const tab = deviceProfile({});

    expect(deviceProfile(supabaseEnv)).toBe('main');
    expect(tab).toBe(
      window.sessionStorage.getItem('split.fakeBackend.profile')?.replaceAll('"', ''),
    );
  });

  it('runs on the fake server in localStorage without the env vars', async () => {
    const backend = createBackend({});
    const group = newGroup();

    const published = await backend.publishGroup(group);
    const pushed = await backend.push(group.groupId, [pendingOp()]);

    expect(published).toEqual({ ok: true, value: undefined });
    expect(pushed.ok && pushed.value.accepted).toHaveLength(1);
    expect(window.localStorage.getItem('split.fakeServer.state')).not.toBeNull();
  });

  it('makes no request for Supabase until the backend is first used', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');

    createBackend(supabaseEnv);

    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});

describe('a backend loaded on first use', () => {
  function memoryBackend() {
    return createFakeBackend({
      server: createMemoryServer(),
      profile: 'ana',
      isOnline: () => true,
    });
  }

  it('loads once and passes every call through', async () => {
    const load = vi.fn(async () => memoryBackend());
    const backend = lazyBackend(load);
    const group = newGroup();
    const op = pendingOp();

    const session = await backend.session();
    await backend.publishGroup(group);
    const joined = await backend.joinGroup(group.inviteCode);
    const pushed = await backend.push(group.groupId, [op]);
    const pulled = await backend.pull(group.groupId, 0);
    const groups = await backend.myGroups();
    const started = await backend.startEmailSignIn('ana@example.com');
    const verified = await backend.verifyEmailCode('ana@example.com', '000000');
    const signedOut = await backend.signOut();

    expect(load).toHaveBeenCalledTimes(1);
    expect(session.ok).toBe(true);
    expect(joined).toEqual({ ok: true, value: group });
    expect(pushed).toEqual({ ok: true, value: { accepted: [op.id], rejected: [] } });
    expect(pulled.ok && pulled.value.ops.map((pulledOp) => pulledOp.id)).toEqual([op.id]);
    expect(groups).toEqual({ ok: true, value: [group] });
    expect(started).toEqual({ ok: true, value: { mode: 'link' } });
    expect(verified.ok).toBe(true);
    expect(signedOut).toEqual({ ok: true, value: undefined });
  });

  it('reads as offline when its code cannot be downloaded, and tries again next time', async () => {
    const load = vi
      .fn<() => Promise<ReturnType<typeof memoryBackend>>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockImplementation(async () => memoryBackend());
    const backend = lazyBackend(load);

    const first = await backend.session();
    const second = await backend.session();

    expect(first).toEqual({ ok: false, failure: { kind: 'offline' } });
    expect(second.ok).toBe(true);
  });

  it('subscribes once loaded, and not at all if dropped before that', async () => {
    const inner = memoryBackend();
    const subscribe = vi.spyOn(inner, 'subscribe');
    const backend = lazyBackend(async () => inner);
    const groupId = 'g-1' as GroupId;

    const dropEarly = backend.subscribe(groupId, vi.fn());
    dropEarly();
    await backend.session();
    const calledForDropped = subscribe.mock.calls.length;
    const dropLate = backend.subscribe(groupId, vi.fn());
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
    const unsubscribe = vi.fn();
    subscribe.mockReturnValue(unsubscribe);
    const dropLast = backend.subscribe(groupId, vi.fn());
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2));
    dropLast();
    dropLate();

    expect(calledForDropped).toBe(0);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
