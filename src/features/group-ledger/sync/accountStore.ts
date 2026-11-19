import { z } from 'zod';
import { create } from 'zustand';
import { deviceProfile } from '@features/group-ledger/backend/createBackend';
import type { LedgerBackend, Session } from '@features/group-ledger/backend/port';
import { idSchemas } from '@features/group-ledger/logic/codec';
import {
  accountStep,
  initialAccount,
  type AccountEvent,
  type AccountState,
} from '@features/group-ledger/sync/accountMachine';
import { ledgerBackend, onSessionSeen, syncAllGroups } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { jsonStorage } from '@shared/logic/jsonStorage';

export type { EmailSignIn } from '@features/group-ledger/sync/accountMachine';

interface AccountStore extends AccountState {
  load: () => Promise<void>;
  /**
   * Takes the session a group's sync ran as. Tabs share one backend session, so this is how a
   * sign-in or sign-out in another tab reaches this one.
   */
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
  /**
   * Adds the groups this identity holds that the phone doesn't, then syncs. Runs whenever the
   * user changes, and whenever a signed-in phone loads, since another phone may have joined a group.
   */
  findGroups: () => Promise<void>;
}

/** A shell over `accountStep`: it calls the backend, feeds each answer in, and stores the session. */
export function createAccountStore({
  backend: getBackend,
  profile,
  findGroups,
}: AccountStoreOptions) {
  const storage = jsonStorage('localStorage', `split:account:${profile}`, sessionSchema);

  return create<AccountStore>((set, get) => {
    /** Applies the event at once. Resolves after looking for groups, when the step asks for it. */
    async function dispatch(event: AccountEvent): Promise<void> {
      const { session, emailSignIn, failure } = get();
      const step = accountStep({ session, emailSignIn, failure }, event);
      if (step === null) return;
      if (step.state.session !== null && step.state.session !== session) {
        storage.save(step.state.session);
      }
      set(step.state);
      if (step.findGroups) await findGroups();
    }

    return {
      ...initialAccount(storage.load()),

      load: async () => {
        const session = await getBackend().session();
        await dispatch(
          session.ok
            ? { type: 'session-loaded', session: session.value }
            : { type: 'request-failed', failure: session.failure },
        );
      },

      adopt: (session) => void dispatch({ type: 'session-seen', session }),

      startEmailSignIn: async (email) => {
        void dispatch({ type: 'email-entered', email });
        const started = await getBackend().startEmailSignIn(email);
        void dispatch(
          started.ok
            ? { type: 'code-sent', email, mode: started.value.mode }
            : { type: 'code-not-sent', failure: started.failure },
        );
      },

      verifyEmailCode: async (code) => {
        const flow = get().emailSignIn;
        if (flow.step !== 'code-sent') return;
        void dispatch({ type: 'code-entered' });
        const verified = await getBackend().verifyEmailCode(flow.email, code);
        await dispatch(
          verified.ok
            ? { type: 'code-accepted', session: verified.value }
            : { type: 'code-refused', flow, failure: verified.failure },
        );
      },

      cancelEmailSignIn: () => void dispatch({ type: 'email-cancelled' }),

      signOut: async () => {
        const signedOut = await getBackend().signOut();
        if (!signedOut.ok) {
          void dispatch({ type: 'request-failed', failure: signedOut.failure });
          return;
        }
        void dispatch({ type: 'signed-out' });
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
  findGroups: adoptAccountGroups,
});

onSessionSeen((session) => useAccountStore.getState().adopt(session));
