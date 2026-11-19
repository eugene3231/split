import { describe, expect, it } from 'vitest';
import type { Session } from '@features/group-ledger/backend/port';
import type { UserId } from '@features/group-ledger/domain/types';
import {
  accountStep,
  identityChange,
  initialAccount,
  type AccountState,
  type CodeSent,
} from '@features/group-ledger/sync/accountMachine';

const anon = (id: string): Session => ({ userId: id as UserId, account: { kind: 'anonymous' } });
const linked = (id: string, email = 'ana@example.com'): Session => ({
  userId: id as UserId,
  account: { kind: 'linked', email },
});
const codeSent: CodeSent = { step: 'code-sent', email: 'ana@example.com', mode: 'link' };
const offline = { kind: 'offline' } as const;

function after(state: AccountState, ...events: Parameters<typeof accountStep>[1][]) {
  let current = state;
  for (const event of events) current = accountStep(current, event)?.state ?? current;
  return current;
}

describe('identityChange', () => {
  it('names each way a session can follow another', () => {
    expect(identityChange(null, anon('x'))).toBe('first');
    expect(identityChange(anon('x'), anon('x'))).toBe('same');
    expect(identityChange(linked('x'), linked('x'))).toBe('same');
    expect(identityChange(anon('x'), linked('x'))).toBe('linked');
    expect(identityChange(linked('x'), linked('x', 'new@example.com'))).toBe('linked');
    expect(identityChange(anon('x'), linked('u'))).toBe('switched');
    expect(identityChange(linked('u'), anon('y'))).toBe('switched');
  });
});

describe('accountStep: identity', () => {
  it('learns an anonymous phone without looking for groups', () => {
    const step = accountStep(initialAccount(null), { type: 'session-loaded', session: anon('x') });

    expect(step).toEqual({ state: initialAccount(anon('x')), findGroups: false });
  });

  it('looks for groups each time a linked session loads', () => {
    const step = accountStep(initialAccount(linked('u')), {
      type: 'session-loaded',
      session: linked('u'),
    });

    expect(step?.findGroups).toBe(true);
  });

  it('clears the last failure when the session loads', () => {
    const failing = { ...initialAccount(anon('x')), failure: offline };

    expect(
      accountStep(failing, { type: 'session-loaded', session: anon('x') })?.state.failure,
    ).toBeNull();
  });

  it('ignores a seen session it already holds', () => {
    expect(
      accountStep(initialAccount(linked('u')), { type: 'session-seen', session: linked('u') }),
    ).toBeNull();
  });

  it('takes a seen session from another user and looks for its groups', () => {
    const step = accountStep(initialAccount(anon('x')), {
      type: 'session-seen',
      session: anon('y'),
    });

    expect(step).toEqual({ state: initialAccount(anon('y')), findGroups: true });
  });

  it('takes a first seen anonymous session without looking for groups', () => {
    const step = accountStep(initialAccount(null), { type: 'session-seen', session: anon('y') });

    expect(step).toEqual({ state: initialAccount(anon('y')), findGroups: false });
  });

  it('keeps a failure when a sync shows the session', () => {
    const failing = { ...initialAccount(anon('x')), failure: offline };

    expect(
      accountStep(failing, { type: 'session-seen', session: anon('y') })?.state.failure,
    ).toEqual(offline);
  });

  it('keeps the session but clears the failure on sign out, until the next load', () => {
    const failing = { ...initialAccount(linked('u')), failure: offline };

    expect(accountStep(failing, { type: 'signed-out' })).toEqual({
      state: initialAccount(linked('u')),
      findGroups: false,
    });
  });
});

describe('accountStep: email sign-in', () => {
  it('goes from typing an email to a sent code', () => {
    const state = after(
      initialAccount(anon('x')),
      { type: 'email-entered', email: 'ana@example.com' },
      { type: 'code-sent', email: 'ana@example.com', mode: 'sign-in' },
    );

    expect(state.emailSignIn).toEqual({ ...codeSent, mode: 'sign-in' });
  });

  it('goes back to the start when the code cannot be sent', () => {
    const state = after(
      initialAccount(anon('x')),
      { type: 'email-entered', email: 'ana@example.com' },
      { type: 'code-not-sent', failure: offline },
    );

    expect(state).toEqual({ ...initialAccount(anon('x')), failure: offline });
  });

  it('ignores a code when none was sent, or one is already being checked', () => {
    expect(accountStep(initialAccount(anon('x')), { type: 'code-entered' })).toBeNull();
    const checking = after(
      { ...initialAccount(anon('x')), emailSignIn: codeSent },
      {
        type: 'code-entered',
      },
    );

    expect(checking.emailSignIn).toEqual({ ...codeSent, step: 'verifying' });
    expect(accountStep(checking, { type: 'code-entered' })).toBeNull();
  });

  it('asks for the code again after a wrong one', () => {
    const state = after(
      { ...initialAccount(anon('x')), emailSignIn: codeSent },
      { type: 'code-entered' },
      { type: 'code-refused', flow: codeSent, failure: { kind: 'failed', message: 'wrong' } },
    );

    expect(state.emailSignIn).toEqual(codeSent);
    expect(state.failure).toEqual({ kind: 'failed', message: 'wrong' });
  });

  it('links the email to the same user and looks for groups', () => {
    const verifying = after(
      { ...initialAccount(anon('x')), emailSignIn: codeSent },
      {
        type: 'code-entered',
      },
    );

    expect(accountStep(verifying, { type: 'code-accepted', session: linked('x') })).toEqual({
      state: initialAccount(linked('x')),
      findGroups: true,
    });
  });

  it('switches to the account the email has and looks for its groups', () => {
    const verifying = after(
      { ...initialAccount(anon('x')), emailSignIn: { ...codeSent, mode: 'sign-in' } },
      { type: 'code-entered' },
    );

    expect(accountStep(verifying, { type: 'code-accepted', session: linked('u') })).toEqual({
      state: initialAccount(linked('u')),
      findGroups: true,
    });
  });

  it('cancels back to the start, clearing the failure', () => {
    const state = after(
      { ...initialAccount(anon('x')), emailSignIn: codeSent, failure: offline },
      { type: 'email-cancelled' },
    );

    expect(state).toEqual(initialAccount(anon('x')));
  });

  it('keeps a code being asked for when signing out fails', () => {
    const state = after(
      { ...initialAccount(linked('u')), emailSignIn: codeSent },
      { type: 'request-failed', failure: offline },
    );

    expect(state.emailSignIn).toEqual(codeSent);
    expect(state.failure).toEqual(offline);
  });
});
