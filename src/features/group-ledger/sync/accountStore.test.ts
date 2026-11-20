import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeBackend, FAKE_EMAIL_CODE } from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer, type FakeServer } from '@features/group-ledger/backend/fakeServer';
import { createAccountStore } from '@features/group-ledger/sync/accountStore';
import type { HeldName, NameCarrier } from '@features/group-ledger/sync/carryNames';

function phone(server: FakeServer, profile: string) {
  const signal = { online: true };
  const backend = createFakeBackend({ server, profile, isOnline: () => signal.online });
  const findGroups = vi.fn(async () => {});
  const open = () => createAccountStore({ backend: () => backend, profile, findGroups });
  return { signal, backend, findGroups, open, store: open() };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('account', () => {
  it('signs the phone in anonymously on first load and remembers who it is', async () => {
    const ana = phone(createMemoryServer(), 'ana');

    const before = ana.store.getState().session;
    await ana.store.getState().load();
    const session = ana.store.getState().session;

    expect(before).toBeNull();
    expect(session?.account).toEqual({ kind: 'anonymous' });
    expect(ana.open().getState().session).toEqual(session);
    expect(ana.findGroups).not.toHaveBeenCalled();
  });

  it('takes the session a sync ran as, so a sign-in in another tab reaches this one', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    const other = phone(server, 'other');
    await ana.store.getState().load();
    await other.store.getState().load();
    const elsewhere = other.store.getState().session;
    if (elsewhere === null) throw new Error('no session');

    ana.store.getState().adopt(elsewhere);
    await vi.waitFor(() => expect(ana.findGroups).toHaveBeenCalledTimes(1));
    ana.store.getState().adopt(elsewhere);

    expect(ana.store.getState().session).toEqual(elsewhere);
    expect(ana.open().getState().session).toEqual(elsewhere);
    expect(ana.findGroups).toHaveBeenCalledTimes(1);
  });

  it('adopts the session a sync ran as when it knows none of its own yet', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    const other = phone(createMemoryServer(), 'other');
    await other.store.getState().load();
    const seen = other.store.getState().session;
    if (seen === null) throw new Error('no session');

    ana.store.getState().adopt(seen);

    expect(ana.store.getState().session).toEqual(seen);
    expect(ana.findGroups).not.toHaveBeenCalled();
  });

  it('still knows who the phone is when it opens with no signal', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    const session = ana.store.getState().session;
    window.localStorage.removeItem('split.fakeBackend.ana.session');
    ana.signal.online = false;

    const reopened = ana.open();
    await reopened.getState().load();

    expect(reopened.getState().session).toEqual(session);
    expect(reopened.getState().failure).toEqual({ kind: 'offline' });
  });

  it('links an email to this phone without changing its user', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    const userId = ana.store.getState().session?.userId;

    await ana.store.getState().startEmailSignIn('ana@example.com');
    const afterStart = ana.store.getState().emailSignIn;
    await ana.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(afterStart).toEqual({ step: 'code-sent', email: 'ana@example.com', mode: 'link' });
    expect(ana.store.getState().emailSignIn).toEqual({ step: 'idle' });
    expect(ana.store.getState().session).toEqual({
      userId,
      account: { kind: 'linked', email: 'ana@example.com' },
    });
  });

  it('looks for groups the account joined on other phones each time a signed-in phone opens', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    await ana.store.getState().startEmailSignIn('ana@example.com');
    await ana.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);
    ana.findGroups.mockClear();

    const reopened = ana.open();
    await reopened.getState().load();

    expect(ana.findGroups).toHaveBeenCalledTimes(1);
  });

  it('switches to the account an email already has, and looks for its groups', async () => {
    const server = createMemoryServer();
    const oldPhone = phone(server, 'old');
    await oldPhone.store.getState().load();
    await oldPhone.store.getState().startEmailSignIn('ana@example.com');
    await oldPhone.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);
    const newPhone = phone(server, 'new');
    await newPhone.store.getState().load();

    await newPhone.store.getState().startEmailSignIn('ana@example.com');
    const mode = newPhone.store.getState().emailSignIn;
    await newPhone.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(mode).toMatchObject({ step: 'code-sent', mode: 'sign-in' });
    expect(newPhone.store.getState().session).toEqual(oldPhone.store.getState().session);
    expect(newPhone.findGroups).toHaveBeenCalledTimes(1);
  });

  it('keeps asking for the code after a wrong one', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    await ana.store.getState().startEmailSignIn('ana@example.com');

    await ana.store.getState().verifyEmailCode('111111');

    expect(ana.store.getState().emailSignIn).toMatchObject({ step: 'code-sent' });
    expect(ana.store.getState().failure).toMatchObject({ kind: 'failed' });
    expect(ana.store.getState().session?.account).toEqual({ kind: 'anonymous' });
  });

  it('ignores a code when none was asked for', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();

    await ana.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(ana.store.getState().session?.account).toEqual({ kind: 'anonymous' });
  });

  it('goes back to the start when the code cannot be sent, or the person cancels', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    ana.signal.online = false;

    await ana.store.getState().startEmailSignIn('ana@example.com');
    const afterFailure = { ...ana.store.getState() };
    ana.signal.online = true;
    await ana.store.getState().startEmailSignIn('ana@example.com');
    ana.store.getState().cancelEmailSignIn();

    expect(afterFailure.emailSignIn).toEqual({ step: 'idle' });
    expect(afterFailure.failure).toEqual({ kind: 'offline' });
    expect(ana.store.getState().emailSignIn).toEqual({ step: 'idle' });
    expect(ana.store.getState().failure).toBeNull();
  });

  it('becomes a new anonymous user on sign out, and looks for its groups', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    await ana.store.getState().startEmailSignIn('ana@example.com');
    await ana.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);
    const linked = ana.store.getState().session;

    await ana.store.getState().signOut();

    expect(ana.store.getState().session?.account).toEqual({ kind: 'anonymous' });
    expect(ana.store.getState().session?.userId).not.toBe(linked?.userId);
    expect(ana.findGroups).toHaveBeenCalledTimes(2);
  });

  it('stays signed in when signing out fails', async () => {
    const ana = phone(createMemoryServer(), 'ana');
    await ana.store.getState().load();
    const session = ana.store.getState().session;
    ana.signal.online = false;

    await ana.store.getState().signOut();

    expect(ana.store.getState().session).toEqual(session);
    expect(ana.store.getState().failure).toEqual({ kind: 'offline' });
  });
});

describe('keeping the names picked across a sign-in', () => {
  const held = [{ groupId: 'g1', memberId: 'ana' }] as unknown as HeldName[];

  async function signingIn(release: () => Promise<HeldName[] | null>) {
    const server = createMemoryServer();
    const laptop = phone(server, 'laptop');
    await laptop.store.getState().load();
    await laptop.store.getState().startEmailSignIn('ana@example.com');
    await laptop.store.getState().verifyEmailCode(FAKE_EMAIL_CODE);
    const account = laptop.store.getState().session?.userId;

    const backend = createFakeBackend({ server, profile: 'phone', isOnline: () => true });
    const order: string[] = [];
    const verify = backend.verifyEmailCode.bind(backend);
    backend.verifyEmailCode = (email, code) => {
      order.push('verify');
      return verify(email, code);
    };
    const names: NameCarrier = {
      release: vi.fn(async () => {
        order.push('release');
        return release();
      }),
      restore: vi.fn(() => order.push('restore')),
      reclaim: vi.fn(() => order.push('reclaim')),
    };
    const store = createAccountStore({
      backend: () => backend,
      profile: 'phone',
      findGroups: async () => {
        order.push('find groups');
      },
      names,
    });
    await store.getState().load();
    const anonymous = store.getState().session?.userId;
    await store.getState().startEmailSignIn('ana@example.com');
    return { store, names, order, account, anonymous };
  }

  it('gives the names up as the old user, checks the code, then claims them as the account', async () => {
    const { store, names, order, account, anonymous } = await signingIn(async () => held);

    await store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(order).toEqual(['release', 'verify', 'find groups', 'reclaim']);
    expect(names.release).toHaveBeenCalledWith(anonymous);
    expect(names.reclaim).toHaveBeenCalledWith(held, account);
  });

  it('claims the names back when the code is wrong', async () => {
    const { store, names, order } = await signingIn(async () => held);

    await store.getState().verifyEmailCode('111111');

    expect(order).toEqual(['release', 'verify', 'restore']);
    expect(names.restore).toHaveBeenCalledWith(held);
    expect(store.getState().emailSignIn).toMatchObject({ step: 'code-sent' });
  });

  it('does not check the code when giving the names up did not reach the server', async () => {
    const { store, order, anonymous } = await signingIn(async () => null);

    await store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(order).toEqual(['release']);
    expect(store.getState().session?.userId).toBe(anonymous);
    expect(store.getState().failure).toEqual({ kind: 'offline' });
    expect(store.getState().emailSignIn).toMatchObject({ step: 'code-sent' });
  });

  it('leaves the names alone when a new email joins this phone, which keeps its user', async () => {
    const names: NameCarrier = { release: vi.fn(), restore: vi.fn(), reclaim: vi.fn() };
    const backend = createFakeBackend({
      server: createMemoryServer(),
      profile: 'phone',
      isOnline: () => true,
    });
    const store = createAccountStore({
      backend: () => backend,
      profile: 'phone',
      findGroups: async () => {},
      names,
    });
    await store.getState().load();
    await store.getState().startEmailSignIn('new@example.com');

    await store.getState().verifyEmailCode(FAKE_EMAIL_CODE);

    expect(names.release).not.toHaveBeenCalled();
    expect(names.reclaim).toHaveBeenCalledWith([], store.getState().session?.userId);
  });
});
