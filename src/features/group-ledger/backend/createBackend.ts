import {
  createFakeBackend,
  isFakeOnline,
  tabProfile,
} from '@features/group-ledger/backend/fakeBackend';
import { createLocalStorageServer } from '@features/group-ledger/backend/fakeServer';
import type { LedgerBackend, Result } from '@features/group-ledger/backend/port';

interface BackendEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function supabaseConfig(env: BackendEnv = import.meta.env) {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function deviceProfile(env: BackendEnv = import.meta.env): string {
  return supabaseConfig(env) === null ? tabProfile() : 'main';
}

const OFFLINE: Result<never> = { ok: false, failure: { kind: 'offline' } };

export function lazyBackend(load: () => Promise<LedgerBackend>): LedgerBackend {
  let loading: Promise<LedgerBackend> | null = null;

  async function call<T>(run: (backend: LedgerBackend) => Promise<Result<T>>): Promise<Result<T>> {
    loading ??= load();
    try {
      return await run(await loading);
    } catch {
      loading = null;
      return OFFLINE;
    }
  }

  return {
    session: () => call((backend) => backend.session()),
    startEmailSignIn: (email) => call((backend) => backend.startEmailSignIn(email)),
    verifyEmailCode: (email, code) => call((backend) => backend.verifyEmailCode(email, code)),
    signOut: () => call((backend) => backend.signOut()),
    myGroups: () => call((backend) => backend.myGroups()),
    publishGroup: (group, firstOp) => call((backend) => backend.publishGroup(group, firstOp)),
    joinGroup: (inviteCode) => call((backend) => backend.joinGroup(inviteCode)),
    push: (groupId, ops) => call((backend) => backend.push(groupId, ops)),
    pull: (groupId, afterSeq) => call((backend) => backend.pull(groupId, afterSeq)),
    subscribe(groupId, onPoke) {
      let unsubscribe: (() => void) | null = null;
      let stopped = false;
      void call(async (backend) => {
        if (!stopped) unsubscribe = backend.subscribe(groupId, onPoke);
        return { ok: true, value: undefined };
      });
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },
  };
}

export function createBackend(env: BackendEnv = import.meta.env): LedgerBackend {
  const config = supabaseConfig(env);
  if (config === null) {
    return createFakeBackend({
      server: createLocalStorageServer(),
      profile: tabProfile(),
      isOnline: isFakeOnline,
    });
  }
  return lazyBackend(async () => {
    const { connectSupabaseBackend } =
      await import('@features/group-ledger/backend/supabaseBackend');
    return connectSupabaseBackend(config.url, config.anonKey);
  });
}
