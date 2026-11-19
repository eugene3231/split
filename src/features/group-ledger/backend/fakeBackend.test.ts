import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeBackend,
  FAKE_EMAIL_CODE,
  isFakeOnline,
  setFakeOffline,
  tabProfile,
} from '@features/group-ledger/backend/fakeBackend';
import { createMemoryServer, type FakeServer } from '@features/group-ledger/backend/fakeServer';
import {
  createdOp,
  newGroup,
  pendingOp,
} from '@features/group-ledger/backend/testing/backendContract';

function phone(server: FakeServer, profile: string, signal = { online: true }) {
  return createFakeBackend({ server, profile, isOnline: () => signal.online });
}

async function userId(backend: ReturnType<typeof phone>) {
  const session = await backend.session();
  if (!session.ok) throw new Error('no session');
  return session.value.userId;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setFakeOffline(false);
  window.history.replaceState(null, '', '/');
});

describe('fake backend sessions', () => {
  it('signs in and names the tab on a plain-http page, where crypto.randomUUID is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

    const session = await phone(createMemoryServer(), 'ana').session();
    const profile = tabProfile();

    expect(session.ok).toBe(true);
    expect(profile).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('gives each phone its own anonymous user and keeps it across reloads', async () => {
    const server = createMemoryServer();

    const ana = await phone(server, 'ana').session();
    const anaAfterReload = await phone(server, 'ana').session();
    const ben = await phone(server, 'ben').session();

    expect(ana).toMatchObject({ ok: true, value: { account: { kind: 'anonymous' } } });
    expect(anaAfterReload).toEqual(ana);
    expect(ben.ok && ana.ok && ben.value.userId !== ana.value.userId).toBe(true);
  });

  it('cannot sign in for the first time with no signal, but knows who it is afterwards', async () => {
    const server = createMemoryServer();
    const signal = { online: false };
    const ana = phone(server, 'ana', signal);

    const first = await ana.session();
    signal.online = true;
    const signedIn = await ana.session();
    signal.online = false;
    const offlineAgain = await ana.session();

    expect(first).toEqual({ ok: false, failure: { kind: 'offline' } });
    expect(signedIn.ok).toBe(true);
    expect(offlineAgain).toEqual(signedIn);
  });

  it('fails every call that needs the server with offline while there is no signal', async () => {
    const server = createMemoryServer();
    const signal = { online: true };
    const ana = phone(server, 'ana', signal);
    const group = newGroup();
    await ana.publishGroup(group, createdOp());
    const onPoke = vi.fn();
    ana.subscribe(group.groupId, onPoke);
    signal.online = false;
    const offline = { ok: false, failure: { kind: 'offline' } };

    expect(await ana.publishGroup(group, createdOp())).toEqual(offline);
    expect(await ana.joinGroup(group.inviteCode)).toEqual(offline);
    expect(await ana.push(group.groupId, [pendingOp()])).toEqual(offline);
    expect(await ana.pull(group.groupId, 0)).toEqual(offline);
    expect(await ana.myGroups()).toEqual(offline);
    expect(await ana.startEmailSignIn('ana@example.com')).toEqual(offline);
    expect(await ana.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE)).toEqual(offline);
    expect(await ana.signOut()).toEqual(offline);

    await phone(server, 'ben').joinGroup(group.inviteCode);
    await phone(server, 'ben').push(group.groupId, [pendingOp()]);
    await Promise.resolve();
    expect(onPoke).not.toHaveBeenCalled();
  });
});

describe('fake backend email sign-in', () => {
  it('attaches a new email to this phone, keeping its user and its groups', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    const group = newGroup();
    await ana.publishGroup(group, createdOp());
    const before = await userId(ana);

    const started = await ana.startEmailSignIn('ana@example.com');
    const verified = await ana.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);

    expect(started).toEqual({ ok: true, value: { mode: 'link' } });
    expect(verified).toEqual({
      ok: true,
      value: { userId: before, account: { kind: 'linked', email: 'ana@example.com' } },
    });
    expect(await phone(server, 'ana').session()).toEqual(verified);
    expect(await ana.myGroups()).toEqual({ ok: true, value: [group] });
  });

  it('signs a second phone in to the account that already has the email', async () => {
    const server = createMemoryServer();
    const oldPhone = phone(server, 'old');
    const group = newGroup();
    await oldPhone.publishGroup(group, createdOp());
    await oldPhone.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const newPhone = phone(server, 'new');
    const anonymous = await userId(newPhone);

    const started = await newPhone.startEmailSignIn('ana@example.com');
    const verified = await newPhone.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);

    expect(started).toEqual({ ok: true, value: { mode: 'sign-in' } });
    expect(verified.ok && verified.value.userId).toBe(await userId(oldPhone));
    expect(verified.ok && verified.value.userId).not.toBe(anonymous);
    expect(await newPhone.myGroups()).toEqual({ ok: true, value: [group] });
  });

  it('refuses a wrong code and leaves the phone as it was', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    const before = await ana.session();

    const verified = await ana.verifyEmailCode('ana@example.com', '123456');

    expect(verified).toMatchObject({ ok: false, failure: { kind: 'failed' } });
    expect(await ana.session()).toEqual(before);
    expect(await ana.startEmailSignIn('ana@example.com')).toEqual({
      ok: true,
      value: { mode: 'link' },
    });
  });

  it('will not attach a second email to a phone that already has an account', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    await ana.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);

    const started = await ana.startEmailSignIn('other@example.com');

    expect(started).toMatchObject({ ok: false, failure: { kind: 'failed' } });
  });

  it('becomes a new anonymous user after signing out', async () => {
    const server = createMemoryServer();
    const ana = phone(server, 'ana');
    await ana.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const linked = await userId(ana);

    const signedOut = await ana.signOut();
    const after = await ana.session();

    expect(signedOut).toEqual({ ok: true, value: undefined });
    expect(after).toMatchObject({ ok: true, value: { account: { kind: 'anonymous' } } });
    expect(after.ok && after.value.userId).not.toBe(linked);
  });
});

describe('dev switches', () => {
  it('goes offline for ?offline in the URL', () => {
    expect(isFakeOnline()).toBe(true);

    window.history.replaceState(null, '', '/?offline');

    expect(isFakeOnline()).toBe(false);
  });

  it('goes offline by the toggle, and announces coming back online', () => {
    const onOnline = vi.fn();
    window.addEventListener('online', onOnline);

    setFakeOffline(true);
    const whileOff = isFakeOnline();
    setFakeOffline(false);
    window.removeEventListener('online', onOnline);

    expect(whileOff).toBe(false);
    expect(isFakeOnline()).toBe(true);
    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it('keeps one phone per tab, and takes a name from ?phone', () => {
    const first = tabProfile();
    const again = tabProfile();
    window.history.replaceState(null, '', '/?phone=ana');
    const named = tabProfile();
    window.history.replaceState(null, '', '/');
    const afterNaming = tabProfile();

    expect(again).toBe(first);
    expect(named).toBe('ana');
    expect(afterNaming).toBe('ana');
  });
});
