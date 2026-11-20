import type { BackendFailure, Session } from '@features/group-ledger/backend/port';

export type EmailMode = 'link' | 'sign-in';

export type EmailSignIn =
  | { step: 'idle' }
  | { step: 'sending'; email: string }
  /** `link` keeps this phone's identity; `sign-in` switches it to the account the email has. */
  | { step: 'code-sent'; email: string; mode: EmailMode }
  | { step: 'verifying'; email: string; mode: EmailMode };

export type CodeSent = Extract<EmailSignIn, { step: 'code-sent' }>;

export interface AccountState {
  /** Who this tab thinks the phone is. Null until a session has been loaded or seen. */
  session: Session | null;
  emailSignIn: EmailSignIn;
  /** Why the last action did not work. A `failed` while verifying means the code was refused. */
  failure: BackendFailure | null;
}

/**
 * How a new session relates to the one the tab knew. A sign-out makes a new anonymous user, so it
 * is a `switched` like signing in to an account another phone made.
 */
export type IdentityChange =
  /** The tab knew no session yet. */
  | 'first'
  | 'same'
  /** The same user, now with an email. */
  | 'linked'
  /** Another user: signed in to an existing account, or signed out. */
  | 'switched';

export type AccountEvent =
  /** The backend answered who the phone is (`load`). */
  | { type: 'session-loaded'; session: Session }
  /** A group's sync ran as this session, maybe because another tab signed in or out (`adopt`). */
  | { type: 'session-seen'; session: Session }
  /** The person typed an email and asked for a code. */
  | { type: 'email-entered'; email: string }
  | { type: 'code-sent'; email: string; mode: EmailMode }
  /** The code could not be sent: back to the start. */
  | { type: 'code-not-sent'; failure: BackendFailure }
  /** The person typed the code. Ignored unless a code was sent. */
  | { type: 'code-entered' }
  | { type: 'code-accepted'; session: Session }
  /** The code was refused or could not be checked: ask for it again. */
  | { type: 'code-refused'; flow: CodeSent; failure: BackendFailure }
  | { type: 'email-cancelled' }
  /** Loading the session or signing out failed. */
  | { type: 'request-failed'; failure: BackendFailure }
  /** The backend dropped its session; loading it next makes a new anonymous user. */
  | { type: 'signed-out' };

export interface AccountStep {
  state: AccountState;
  /** Look for the groups this identity holds that the phone does not, then sync every group. */
  findGroups: boolean;
}

export const initialAccount = (session: Session | null): AccountState => ({
  session,
  emailSignIn: { step: 'idle' },
  failure: null,
});

export function identityChange(before: Session | null, after: Session): IdentityChange {
  if (before === null) return 'first';
  if (before.userId !== after.userId) return 'switched';
  if (before.account.kind === after.account.kind) {
    const sameEmail =
      before.account.kind === 'anonymous' ||
      (after.account.kind === 'linked' && before.account.email === after.account.email);
    if (sameEmail) return 'same';
  }
  return 'linked';
}

/**
 * The tab takes `session` as who the phone is. It looks for the account's groups when the user
 * changed, and whenever the session is linked, since another phone may have joined a group.
 */
function become(state: AccountState, session: Session): AccountStep {
  const change = identityChange(state.session, session);
  return {
    state: { ...state, session },
    findGroups: change === 'switched' || session.account.kind === 'linked',
  };
}

function only(state: AccountState): AccountStep {
  return { state, findGroups: false };
}

/** Null when the event does not apply in this state, so the caller does nothing. */
export function accountStep(state: AccountState, event: AccountEvent): AccountStep | null {
  switch (event.type) {
    case 'session-loaded':
      return become({ ...state, failure: null }, event.session);
    case 'session-seen':
      if (state.session !== null && identityChange(state.session, event.session) === 'same') {
        return null;
      }
      return become(state, event.session);
    case 'email-entered':
      return only({
        ...state,
        emailSignIn: { step: 'sending', email: event.email },
        failure: null,
      });
    case 'code-sent':
      return only({
        ...state,
        emailSignIn: { step: 'code-sent', email: event.email, mode: event.mode },
      });
    case 'code-entered':
      if (state.emailSignIn.step !== 'code-sent') return null;
      return only({
        ...state,
        emailSignIn: { ...state.emailSignIn, step: 'verifying' },
        failure: null,
      });
    case 'code-accepted':
      return become({ ...state, emailSignIn: { step: 'idle' } }, event.session);
    case 'code-refused':
      return only({ ...state, emailSignIn: event.flow, failure: event.failure });
    case 'email-cancelled':
      return only({ ...state, emailSignIn: { step: 'idle' }, failure: null });
    case 'code-not-sent':
      return only({ ...state, emailSignIn: { step: 'idle' }, failure: event.failure });
    case 'request-failed':
      return only({ ...state, failure: event.failure });
    case 'signed-out':
      return only({ ...state, failure: null });
  }
}
