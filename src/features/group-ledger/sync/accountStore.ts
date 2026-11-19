import { z } from 'zod';
import { create } from 'zustand';
import { deviceProfile } from '@features/group-ledger/backend/createBackend';
import type { BackendFailure, LedgerBackend, Session } from '@features/group-ledger/backend/port';
import { idSchemas } from '@features/group-ledger/logic/codec';
import { ledgerBackend, onSessionSeen, syncAllGroups } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { jsonStorage } from '@features/split-workspace/logic/jsonStorage';

export type EmailSignIn =
  | { step: 'idle' }
  | { step: 'sending'; email: string }
  /** `link` keeps this phone's identity; `sign-in` switches it to the account the email has. */
  | { step: 'code-sent'; email: string; mode: 'link' | 'sign-in' }
  | { step: 'verifying'; email: string; mode: 'link' | 'sign-in' };

interface AccountStore {
  session: Session | null;
  emailSignIn: EmailSignIn;
  /** Why the last action did not work. A `failed` while verifying means the code was refused. */
  failure: BackendFailure | null;
  load: () => Promise<void>;
  /** Takes the session a group's sync ran as, while this phone does not know its own yet. */
  adopt: (session: Session) => void;
  startEmailSignIn: (email: string) => Promise<void>;
  verifyEmailCode: (code: string) => Promise<void>;
  cancelEmailSignIn: () => void;
  /** Leaves the account. The phone becomes a new anonymous user and stays in its groups. */
  signOut: () => Promise<void>;
}

const sessionSchema: z.ZodType<Session> = z.object({
  userId: idSchemas.userId,
  account: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('anonymous') }),
    z.object({ kind: z.literal('linked'), email: z.string() }),
  ]),
});

export interface AccountStoreOptions {
  backend: () => LedgerBackend;
  profile: string;
  onUserChanged: () => Promise<void>;
}

export function createAccountStore({
  backend: getBackend,
  profile,
  onUserChanged,
}: AccountStoreOptions) {
  const storage = jsonStorage('localStorage', `split:account:${profile}`, sessionSchema);

  return create<AccountStore>((set, get) => {
    async function become(session: Session) {
      const before = get().session;
      storage.save(session);
      set({ session });
      if (before !== null && before.userId !== session.userId) await onUserChanged();
    }

    return {
      session: storage.load(),
      emailSignIn: { step: 'idle' },
      failure: null,

      load: async () => {
        const session = await getBackend().session();
        if (!session.ok) {
          set({ failure: session.failure });
          return;
        }
        set({ failure: null });
        await become(session.value);
      },

      adopt: (session) => {
        if (get().session !== null) return;
        storage.save(session);
        set({ session });
      },

      startEmailSignIn: async (email) => {
        set({ emailSignIn: { step: 'sending', email }, failure: null });
        const started = await getBackend().startEmailSignIn(email);
        if (!started.ok) {
          set({ emailSignIn: { step: 'idle' }, failure: started.failure });
          return;
        }
        set({ emailSignIn: { step: 'code-sent', email, mode: started.value.mode } });
      },

      verifyEmailCode: async (code) => {
        const flow = get().emailSignIn;
        if (flow.step !== 'code-sent') return;
        set({ emailSignIn: { ...flow, step: 'verifying' }, failure: null });
        const verified = await getBackend().verifyEmailCode(flow.email, code);
        if (!verified.ok) {
          set({ emailSignIn: flow, failure: verified.failure });
          return;
        }
        set({ emailSignIn: { step: 'idle' } });
        await become(verified.value);
      },

      cancelEmailSignIn: () => set({ emailSignIn: { step: 'idle' }, failure: null }),

      signOut: async () => {
        const signedOut = await getBackend().signOut();
        if (!signedOut.ok) {
          set({ failure: signedOut.failure });
          return;
        }
        set({ failure: null });
        await get().load();
      },
    };
  });
}

async function adoptAccountGroups(): Promise<void> {
  const mine = await ledgerBackend().myGroups();
  if (mine.ok) {
    for (const group of mine.value) {
      useJoinedGroupsStore.getState().add({ ...group, createdHere: false, name: '' });
    }
  }
  await syncAllGroups();
}

export const useAccountStore = createAccountStore({
  backend: ledgerBackend,
  profile: deviceProfile(),
  onUserChanged: adoptAccountGroups,
});

onSessionSeen((session) => useAccountStore.getState().adopt(session));
