import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe } from 'vitest';
import { createFakeBackend } from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer } from '@features/group-ledger/backend/fakeServer';
import { createSupabaseBackend } from '@features/group-ledger/backend/supabaseBackend';
import { describeBackendContract } from '@features/group-ledger/backend/testing/backendContract';
import { newUuid } from '@features/group-ledger/logic/ids';

beforeEach(() => {
  window.localStorage.clear();
});

describeBackendContract('memory fake', async () => {
  const server = createMemoryServer();
  return {
    phone: async () => createFakeBackend({ server, profile: newUuid(), isOnline: () => true }),
  };
});

const url: string | undefined = import.meta.env.VITE_CONTRACT_SUPABASE_URL;
const anonKey: string | undefined = import.meta.env.VITE_CONTRACT_SUPABASE_ANON_KEY;

describe.skipIf(!url || !anonKey)('against Supabase', () => {
  describeBackendContract('supabase', async () => ({
    phone: async () =>
      createSupabaseBackend(
        createClient(url ?? '', anonKey ?? '', {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      ),
  }));
});
