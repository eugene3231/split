import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupId, Ledger } from '@features/group-ledger/domain/types';
import {
  FAKE_EMAIL_CODE,
  createFakeBackend,
  setFakeOffline,
} from '@features/group-ledger/backend/fakeBackend';
import { createLocalStorageServer } from '@features/group-ledger/backend/fakeServer';
import { pendingOp } from '@features/group-ledger/backend/testing/backendContract';
import { foldLedger } from '@features/group-ledger/logic/fold';
import {
  asLocalDate,
  asMemberId,
  newEntryId,
  newGroupId,
  newInviteCode,
  newOpId,
} from '@features/group-ledger/logic/ids';
import { postReceipt, postWeights } from '@features/group-ledger/logic/post';
import { useAccountStore } from '@features/group-ledger/sync/accountStore';
import { createGroup } from '@features/group-ledger/sync/createGroup';
import { forgetGroup, groupSyncFor } from '@features/group-ledger/sync/groupSync';
import { useJoinedGroupsStore } from '@features/group-ledger/sync/joinedGroupsStore';
import { useToastStore } from '@features/group-ledger/stores/toastStore';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { quickSplitStore } from '@features/split-workspace/stores/receiptStore';
import { savePersistedDraft } from '@features/split-workspace/logic/draftStorage';
import { navigate } from '@shared/routing';
import App from '../App';
import { makeItem, makeReceipt } from '../tests/integration/testHelpers';

function go(path: string) {
  act(() => {
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

function ledgerOf(groupId: GroupId): Ledger {
  const engine = groupSyncFor(groupId);
  const ledger =
    engine &&
    foldLedger(engine.getSnapshot().log, useAccountStore.getState().session?.userId ?? null);
  if (!ledger) throw new Error('the group has not loaded');
  return ledger;
}

function makeGroup(friendNames = ['Ben', 'Cat']) {
  return createGroup({ name: 'Japan 2026', currency: 'SGD', myName: 'Ana', friendNames });
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function addQuickExpense(groupId: GroupId, amount: string, title: string) {
  go(`/g/${groupId}/new`);
  type('Amount', amount);
  type('What was it for?', title);
  click(/^Add/);
  await screen.findByRole('link', { name: new RegExp(title) });
}

beforeEach(() => {
  for (const group of useJoinedGroupsStore.getState().groups) forgetGroup(group.groupId);
  window.localStorage.clear();
  useAccountStore.setState({ session: null, emailSignIn: { step: 'idle' }, failure: null });
  useToastStore.setState({ toast: null });
  setFakeOffline(false);
  quickSplitStore.getState().resetSplit();
  useGeminiStore.setState({
    geminiApiKeyInput: 'test-key',
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  setFakeOffline(false);
  window.history.replaceState(null, '', '/');
});

describe('home', () => {
  it('sells groups when there are none, and makes one that lands with its invite open', async () => {
    render(<App />);
    expect(screen.getByText('Keep a running tab with friends.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toBeInTheDocument();

    click('New group');
    type('Group name', 'Japan 2026');
    type('Your name', 'Ana');
    const friends = screen.getByLabelText('Friends');
    fireEvent.change(friends, { target: { value: 'Ben, Cat' } });
    fireEvent.keyDown(friends, { key: 'Enter' });
    click('Remove Cat');
    fireEvent.change(friends, { target: { value: 'Dan' } });
    click('Create group');

    expect(await screen.findByRole('dialog', { name: 'Invite friends' })).toBeInTheDocument();
    expect(screen.getByText(/\/join#/)).toBeInTheDocument();
    click('Done');
    expect(screen.getByText('No expenses yet')).toBeInTheDocument();
    const [held] = useJoinedGroupsStore.getState().groups;
    expect(ledgerOf(held.groupId).members.map((member) => member.name)).toEqual([
      'Ana',
      'Ben',
      'Dan',
    ]);

    act(() => navigate({ kind: 'home' }));
    expect(await screen.findByRole('link', { name: /Japan 2026/ })).toHaveTextContent(
      /settled up/i,
    );
  });

  it('splits friend names typed but not yet entered on commas when the group is made', async () => {
    render(<App />);
    click('New group');
    type('Group name', 'Lunch');
    type('Your name', 'Ana');
    type('Friends', 'Ben, Cat');
    click('Create group');

    await screen.findByRole('dialog', { name: 'Invite friends' });
    const [held] = useJoinedGroupsStore.getState().groups;
    expect(ledgerOf(held.groupId).members.map((member) => member.name)).toEqual([
      'Ana',
      'Ben',
      'Cat',
    ]);
  });

  it('offers to continue a quick split that has work in it', () => {
    quickSplitStore.getState().addPeople(['Alice']);
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: 'Continue' }));

    expect(screen.getByTestId('workspace')).toBeInTheDocument();
  });

  it('keeps the groups with an email and a code, then signs out', async () => {
    render(<App />);
    click('Keep your groups');
    type('Email', 'ana@example.com');
    click('Send me a code');
    const code = await screen.findByLabelText(/6-digit code/);
    fireEvent.change(code, { target: { value: '111111' } });
    click('Confirm');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');

    fireEvent.change(code, { target: { value: FAKE_EMAIL_CODE } });
    click('Confirm');
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();

    click('Sign out');
    expect(await screen.findByRole('button', { name: 'Send me a code' })).toBeInTheDocument();
  });

  it('keeps the name picked before signing in to an account the email already has', async () => {
    const laptop = createFakeBackend({
      server: createLocalStorageServer(),
      profile: 'laptop',
      isOnline: () => true,
    });
    await laptop.session();
    await laptop.startEmailSignIn('ana@example.com');
    await laptop.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const groupId = makeGroup(['Ben']);
    const ana = ledgerOf(groupId).members.find((member) => member.name === 'Ana')?.id;
    await act(() => groupSyncFor(groupId)?.syncNow());
    render(<App />);

    click('Keep your groups');
    type('Email', 'ana@example.com');
    click('Send me a code');
    fireEvent.change(await screen.findByLabelText(/6-digit code/), {
      target: { value: FAKE_EMAIL_CODE },
    });
    click('Confirm');
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();

    await waitFor(() => expect(ledgerOf(groupId).me).toBe(ana));
    go(`/g/${groupId}`);
    expect(screen.queryByRole('heading', { name: /who are you/i })).not.toBeInTheDocument();
  });

  it("keeps the account's own name in a group where it already has one", async () => {
    const laptop = createFakeBackend({
      server: createLocalStorageServer(),
      profile: 'laptop',
      isOnline: () => true,
    });
    await laptop.session();
    await laptop.startEmailSignIn('ana@example.com');
    await laptop.verifyEmailCode('ana@example.com', FAKE_EMAIL_CODE);
    const groupId = makeGroup(['Ben']);
    const members = ledgerOf(groupId).members;
    const ben = members.find((member) => member.name === 'Ben')?.id;
    await act(() => groupSyncFor(groupId)?.syncNow());
    const held = useJoinedGroupsStore.getState().groups.find((group) => group.groupId === groupId);
    if (!held || !ben) throw new Error('the group was not made');
    await laptop.joinGroup(held.inviteCode);
    await laptop.push(groupId, [
      {
        id: newOpId(),
        at: '2026-11-20T00:00:00.000Z',
        change: { kind: 'member.claimed', memberId: ben },
      },
    ]);
    render(<App />);

    click('Keep your groups');
    type('Email', 'ana@example.com');
    click('Send me a code');
    fireEvent.change(await screen.findByLabelText(/6-digit code/), {
      target: { value: FAKE_EMAIL_CODE },
    });
    click('Confirm');
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument();

    await waitFor(() => expect(ledgerOf(groupId).me).toBe(ben));
  });
});

describe('a group', () => {
  it('adds an expense, shows who owes what, then edits, deletes and undoes it', async () => {
    const groupId = makeGroup();
    render(<App />);
    go(`/g/${groupId}/new`);

    expect(screen.getByRole('button', { name: /^Add/ })).toBeDisabled();
    expect(screen.getByText('Enter an amount')).toBeInTheDocument();
    type('Amount', '90');
    type('What was it for?', 'Dinner');
    expect(screen.getByText('$30.00 each · 3 people')).toBeInTheDocument();
    click(/^Add/);

    expect(await screen.findByText("you're owed $60.00")).toBeInTheDocument();
    expect(screen.getByRole('list', { name: "Everyone's balances" })).toHaveTextContent(
      'Benowes $30.00',
    );

    fireEvent.click(screen.getByRole('link', { name: /Dinner/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Unevenly' }));
    click('More shares for Ben');
    expect(screen.getByText('$45.00')).toBeInTheDocument();
    click('Save');
    expect(await screen.findByText("you're owed $67.50")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Dinner/ }));
    click('Delete expense');
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
    click('Undo');
    expect(await screen.findByText("you're owed $67.50")).toBeInTheDocument();
  });

  it('splits by typed amounts and by several payers, saying what is left', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    go(`/g/${groupId}/new`);
    type('Amount', '50');
    type('What was it for?', 'Groceries');

    click('Several people');
    type('Ana paid', '30');
    expect(screen.getAllByText('$20.00 still unpaid').length).toBeGreaterThan(0);
    type('Ben paid', '20');

    fireEvent.click(screen.getByRole('radio', { name: 'Unevenly' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Amounts' }));
    type('Ana owes', '10');
    expect(screen.getAllByText('$40.00 left to split').length).toBeGreaterThan(0);
    type('Ben owes', '40');
    expect(screen.getAllByText('Adds up')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    expect(
      Number((screen.getByLabelText('SGD per USD') as HTMLInputElement).value),
    ).toBeGreaterThan(1);
    click(/^Add/);

    expect(await screen.findByText('2 people paid US$50.00')).toBeInTheDocument();
  });

  it('settles up: shows the fewest payments, copies them, and marks them paid', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const groupId = makeGroup();
    render(<App />);
    await addQuickExpense(groupId, '90', 'Dinner');

    fireEvent.click(screen.getByRole('link', { name: 'Settle up' }));
    expect(screen.getByText(/2 payments settle everyone/)).toBeInTheDocument();
    click('Copy summary for the group chat');
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0].split('\n').toSorted()).toEqual([
      'Japan 2026: settling up',
      '• Ben pays Ana $30.00',
      '• Cat pays Ana $30.00',
    ]);
    expect(
      screen.getAllByText('Add your PayNow number under People to show a QR here.'),
    ).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark paid' })[0]);
    click('Undo');
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: 'Mark paid' }))
      fireEvent.click(button);

    expect(await screen.findByText("Everyone's settled up")).toBeInTheDocument();
  });

  it('opens a payment marked paid to change its amount or delete it', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');
    go(`/g/${groupId}/settle`);
    click('Mark paid');
    go(`/g/${groupId}`);

    fireEvent.click(await screen.findByRole('link', { name: /Ben paid you/ }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    type('Amount', '4');
    click('Save');
    expect(await screen.findByText("you're owed $6.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Ben paid you/ }));
    click('Delete payment');
    expect(await screen.findByText("you're owed $10.00")).toBeInTheDocument();
  });

  it('shows a PayNow code for someone with a number in an SGD group', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');

    click('People');
    fireEvent.click(screen.getByRole('button', { name: /\(you\)/ }));
    type('PayNow mobile', '1234');
    expect(screen.getByText('That is not a Singapore mobile number.')).toBeInTheDocument();
    type('PayNow mobile', '9123 4567');
    click('Save');
    expect(screen.getByText(/PayNow \+6591234567/)).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    go(`/g/${groupId}/settle`);
    click('PayNow');
    expect(screen.getByRole('button', { name: 'PayNow' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('adds a friend, offers to merge a likely duplicate, and archives', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    go(`/g/${groupId}`);

    click('People');
    type("Friend's name", ' ben ');
    click('Add');
    expect(screen.getByText(/Same person\?/)).toBeInTheDocument();
    click('Merge');
    await waitFor(() => expect(screen.queryByText(/Same person\?/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Ben/ }));
    click('Archive');
    expect(screen.getByText(/Archived/)).toBeInTheDocument();
    expect(ledgerOf(groupId).members.find((member) => member.name === 'Ben')?.archived).toBe(true);
  });

  it('lists activity with undo, and offers the version a conflict replaced', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');
    const [posted] = ledgerOf(groupId).entries;
    const lunch = posted.entry;
    if (lunch.kind !== 'expense') throw new Error('expected an expense');
    const engine = groupSyncFor(groupId);
    act(() => {
      engine?.submit({
        kind: 'entry.put',
        entry: { ...lunch, title: 'Brunch' },
        base: posted.rev,
      });
      engine?.submit({
        kind: 'entry.put',
        entry: { ...lunch, title: 'Late lunch' },
        base: posted.rev,
      });
    });

    go(`/g/${groupId}/activity`);
    expect(screen.getByText(/Ana changed Late lunch/)).toBeInTheDocument();
    click('Restore the other version');
    await waitFor(() =>
      expect(ledgerOf(groupId).entries[0].entry).toMatchObject({ title: 'Brunch' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo: Ana added Lunch · $20.00' }));
    await waitFor(() => expect(ledgerOf(groupId).entries).toEqual([]));
  });

  function postSharedReceipt(groupId: GroupId, cents: string, title: string) {
    const members = ledgerOf(groupId).members;
    const everyone = Object.fromEntries(members.map((member) => [member.id, 1]));
    const entry = postReceipt(
      {
        id: newEntryId(),
        title,
        date: asLocalDate('2026-11-19'),
        currency: 'SGD',
        rate: 1,
        payment: { payer: members[0].id, others: {} },
      },
      makeReceipt({
        name: title,
        items: [
          makeItem({ amountInput: cents, assignment: { shares: everyone, unassignedShare: 0 } }),
        ],
      }),
      members,
    );
    if (!entry) throw new Error('receipt did not post');
    groupSyncFor(groupId)?.submit({ kind: 'entry.put', entry, base: null });
    return entry;
  }

  const toSaveStep = () => {
    while (!screen.queryByTestId('save-receipt-to-group')) {
      fireEvent.click(screen.getByTestId('wizard-continue-btn'));
    }
  };

  it('keeps the payer picked on a receipt after going back a step and returning', async () => {
    const groupId = makeGroup(['Ben']);
    const [, ben] = ledgerOf(groupId).members.map((member) => member.id);
    const entry = postSharedReceipt(groupId, '30.00', 'Dinner');
    render(<App />);
    go(`/g/${groupId}/e/${entry.id}`);

    toSaveStep();
    fireEvent.change(screen.getByLabelText('Paid by'), { target: { value: ben } });
    fireEvent.click(screen.getByTestId('wizard-back-btn'));
    toSaveStep();
    fireEvent.click(screen.getByTestId('save-receipt-to-group'));

    await waitFor(() =>
      expect(ledgerOf(groupId).entries[0].entry).toMatchObject({ payment: { payer: ben } }),
    );
  });

  it('saves a receipt opened after a merge with the cents it already had', async () => {
    const groupId = makeGroup(['Ben', 'Cat']);
    // $10.01 three ways is 334, 334 and 333: the extra cents go to the two lowest ids. Merging
    // those two gives 668 and 333, which splitting the receipt again would make 667 and 334.
    const [first, second] = ledgerOf(groupId)
      .members.map((member) => member.id)
      .toSorted();
    const entry = postSharedReceipt(groupId, '10.01', 'Snacks');
    groupSyncFor(groupId)?.submit({ kind: 'member.merged', from: first, into: second });
    const before = ledgerOf(groupId).entries[0].entry;
    render(<App />);
    go(`/g/${groupId}/e/${entry.id}`);

    toSaveStep();
    fireEvent.click(screen.getByTestId('save-receipt-to-group'));

    expect(await screen.findByText('Saved Snacks')).toBeInTheDocument();
    const after = ledgerOf(groupId).entries[0];
    expect(after.rev).not.toBe(entry.id);
    if (before.kind !== 'expense' || after.entry.kind !== 'expense')
      throw new Error('not an expense');
    expect(after.entry.owed).toEqual(before.owed);
  });

  it('leaves a bystander as they were when a foreign expense is renamed after a merge', async () => {
    const groupId = makeGroup(['Ben', 'Cat']);
    // ¥3 owed ¥1 each at 0.005 SGD per yen is 2 SGD cents, owed by the two lowest ids. Merging
    // those two must leave the third owing nothing, and so must renaming the expense afterwards.
    const [first, second, third] = ledgerOf(groupId)
      .members.map((member) => member.id)
      .toSorted();
    const snack = postWeights(
      {
        id: newEntryId(),
        title: 'Onigiri',
        date: asLocalDate('2026-11-19'),
        currency: 'JPY',
        rate: 0.005,
        payment: { payer: second, others: {} },
      },
      300,
      { [first]: 1, [second]: 1, [third]: 1 },
    );
    if (!snack) throw new Error('did not post');
    groupSyncFor(groupId)?.submit({ kind: 'entry.put', entry: snack, base: null });
    groupSyncFor(groupId)?.submit({ kind: 'member.merged', from: first, into: second });
    const before = ledgerOf(groupId).entries[0].effect[third] ?? 0;
    render(<App />);
    go(`/g/${groupId}/e/${snack.id}`);

    type('What was it for?', 'Onigiri and tea');
    click('Save');

    await waitFor(() =>
      expect(ledgerOf(groupId).entries[0].entry).toMatchObject({ title: 'Onigiri and tea' }),
    );
    expect(ledgerOf(groupId).entries[0].effect[third] ?? 0).toBe(before);
  });

  it('leaves a bystander as they were when a conflict over a foreign expense is restored after a merge', async () => {
    const groupId = makeGroup(['Ben', 'Cat']);
    const [first, second, third] = ledgerOf(groupId)
      .members.map((member) => member.id)
      .toSorted();
    const snack = postWeights(
      {
        id: newEntryId(),
        title: 'Onigiri',
        date: asLocalDate('2026-11-19'),
        currency: 'JPY',
        rate: 0.005,
        payment: { payer: second, others: {} },
      },
      300,
      { [first]: 1, [second]: 1, [third]: 1 },
    );
    if (!snack) throw new Error('did not post');
    const engine = groupSyncFor(groupId);
    const put = engine?.submit({ kind: 'entry.put', entry: snack, base: null });
    if (!put) throw new Error('no engine');
    engine?.submit({ kind: 'entry.put', entry: { ...snack, title: 'Onigiri set' }, base: put });
    engine?.submit({ kind: 'entry.put', entry: { ...snack, title: 'Rice balls' }, base: put });
    engine?.submit({ kind: 'member.merged', from: first, into: second });
    const before = ledgerOf(groupId).entries[0].effect[third] ?? 0;
    render(<App />);
    go(`/g/${groupId}/activity`);

    click('Restore the other version');

    await waitFor(() =>
      expect(ledgerOf(groupId).entries[0].entry).toMatchObject({ title: 'Onigiri set' }),
    );
    expect(ledgerOf(groupId).entries[0].effect[third] ?? 0).toBe(before);
  });

  it('keeps someone archived while a new receipt is open in the split it saves', async () => {
    const groupId = makeGroup(['Ben', 'Cat']);
    const [, ben, cat] = ledgerOf(groupId).members;
    const shared = { [ben.id]: 1, [cat.id]: 1 };
    const receipt = makeReceipt({
      name: 'Pizza',
      items: [
        makeItem({ amountInput: '20.00', assignment: { shares: shared, unassignedShare: 0 } }),
      ],
    });
    savePersistedDraft(`group:${groupId}:receipt:new`, {
      version: 3,
      people: [ben, cat].map(({ id, name }) => ({ id, name })),
      receipts: [receipt],
      activeReceiptId: receipt.id,
      payerMobile: '',
      savedAt: '2026-11-20T00:00:00.000Z',
    });
    render(<App />);
    go(`/g/${groupId}/receipt`);

    act(() => {
      groupSyncFor(groupId)?.submit({ kind: 'member.put', member: { ...cat, archived: true } });
    });
    toSaveStep();
    fireEvent.click(screen.getByTestId('save-receipt-to-group'));

    await waitFor(() =>
      expect(ledgerOf(groupId).entries[0]?.entry).toMatchObject({
        owed: { [ben.id]: 1000, [cat.id]: 1000 },
      }),
    );
  });

  it('opens a saved receipt in the receipt editor and saves it back with a new payer', async () => {
    const groupId = makeGroup(['Ben']);
    const [ana, ben] = ledgerOf(groupId).members.map((member) => member.id);
    const receipt = makeReceipt({
      name: 'Ramen bar',
      items: [
        makeItem({
          id: 'ramen',
          amountInput: '20.00',
          assignment: { shares: { [ana]: 1 }, unassignedShare: 0 },
        }),
        makeItem({
          id: 'gyoza',
          amountInput: '10.00',
          assignment: { shares: { [ben]: 1 }, unassignedShare: 0 },
        }),
      ],
    });
    const entry = postReceipt(
      {
        id: newEntryId(),
        title: 'Ramen bar',
        date: asLocalDate('2026-11-19'),
        currency: 'SGD',
        rate: 1,
        payment: { payer: ana, others: {} },
      },
      receipt,
      ledgerOf(groupId).members,
    );
    if (!entry) throw new Error('receipt did not post');
    groupSyncFor(groupId)?.submit({ kind: 'entry.put', entry, base: null });
    render(<App />);
    go(`/g/${groupId}/e/${entry.id}`);

    while (!screen.queryByTestId('save-receipt-to-group')) {
      fireEvent.click(screen.getByTestId('wizard-continue-btn'));
    }
    fireEvent.change(screen.getByLabelText('Paid by'), { target: { value: ben } });
    fireEvent.click(screen.getByTestId('save-receipt-to-group'));

    expect(await screen.findByText('you owe $20.00')).toBeInTheDocument();
  });

  it('edits an expense and a receipt saved for someone who was later merged', async () => {
    const groupId = makeGroup(['Ben', 'Benny']);
    const [ana, ben, benny] = ledgerOf(groupId).members.map((member) => member.id);
    const header = {
      date: asLocalDate('2026-11-19'),
      currency: 'SGD' as const,
      rate: 1,
      payment: { payer: benny, others: {} },
    };
    const dinner = postWeights({ ...header, id: newEntryId(), title: 'Dinner' }, 2000, {
      [ana]: 1,
      [benny]: 1,
    });
    const snacks = postReceipt(
      { ...header, id: newEntryId(), title: 'Snacks' },
      makeReceipt({
        name: 'Snacks',
        items: [
          makeItem({
            amountInput: '6.00',
            assignment: { shares: { [benny]: 1 }, unassignedShare: 0 },
          }),
        ],
      }),
      ledgerOf(groupId).members,
    );
    if (!dinner || !snacks) throw new Error('entries did not post');
    const engine = groupSyncFor(groupId);
    engine?.submit({ kind: 'entry.put', entry: dinner, base: null });
    engine?.submit({ kind: 'entry.put', entry: snacks, base: null });
    engine?.submit({ kind: 'member.merged', from: benny, into: ben });
    render(<App />);

    go(`/g/${groupId}/e/${dinner.id}`);
    expect(
      within(screen.getByRole('region', { name: 'Paid by' })).getByRole('button', {
        name: 'Ben',
        pressed: true,
      }),
    ).toBeInTheDocument();
    click('Save');
    expect(await screen.findByText('you owe $10.00')).toBeInTheDocument();

    go(`/g/${groupId}/e/${snacks.id}`);
    while (!screen.queryByTestId('save-receipt-to-group')) {
      fireEvent.click(screen.getByTestId('wizard-continue-btn'));
    }
    expect(screen.getByLabelText('Paid by')).toHaveValue(ben);
    fireEvent.click(screen.getByTestId('save-receipt-to-group'));
    expect(await screen.findByText('you owe $10.00')).toBeInTheDocument();

    const saved = engine?.getSnapshot().log.pending.map((op) => JSON.stringify(op.change)) ?? [];
    expect(saved.slice(-2).some((change) => change.includes(benny))).toBe(false);
  });

  it('keeps what is typed when someone else changes the entry meanwhile', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');
    const [posted] = ledgerOf(groupId).entries;
    if (posted.entry.kind !== 'expense') throw new Error('expected an expense');
    const lunch = posted.entry;
    fireEvent.click(screen.getByRole('link', { name: /Lunch/ }));
    type('What was it for?', 'Team lunch');

    act(() => {
      groupSyncFor(groupId)?.submit({
        kind: 'entry.put',
        entry: { ...lunch, title: 'Brunch' },
        base: posted.rev,
      });
    });

    expect(screen.getByLabelText('What was it for?')).toHaveValue('Team lunch');
  });

  it('keeps the editor and what is typed when someone else deletes the entry meanwhile', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');
    const [posted] = ledgerOf(groupId).entries;
    fireEvent.click(screen.getByRole('link', { name: /Lunch/ }));
    type('What was it for?', 'Team lunch');

    act(() => {
      groupSyncFor(groupId)?.submit({
        kind: 'entry.removed',
        entryId: posted.entry.id,
        base: posted.rev,
      });
    });

    expect(screen.getByLabelText('What was it for?')).toHaveValue('Team lunch');
  });

  it('cancels a new receipt back to the group', () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);
    go(`/g/${groupId}/receipt`);

    fireEvent.click(screen.getByTestId('receipt-editor-cancel-btn'));

    expect(window.location.pathname).toBe(`/g/${groupId}`);
  });

  it('says so when an entry or the group itself is not there', async () => {
    const groupId = makeGroup(['Ben']);
    render(<App />);

    go(`/g/${groupId}/e/nothing`);
    expect(await screen.findByRole('heading', { name: 'This entry is gone' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Japan 2026' })).toBeInTheDocument();
    go(`/g/${newGroupId()}`);
    expect(
      screen.getByRole('heading', { name: "This group isn't on this phone" }),
    ).toBeInTheDocument();
  });

  it('opens an entry that arrives after its screen did', async () => {
    const groupId = makeGroup(['Ben']);
    const [ana, ben] = ledgerOf(groupId).members.map((member) => member.id);
    const lunch = postWeights(
      {
        id: newEntryId(),
        title: 'Lunch',
        date: asLocalDate('2026-11-19'),
        currency: 'SGD',
        rate: 1,
        payment: { payer: ana, others: {} },
      },
      3000,
      { [ana]: 1, [ben]: 1 },
    );
    if (!lunch) throw new Error('lunch did not post');
    setFakeOffline(true);
    render(<App />);
    go(`/g/${groupId}/e/${lunch.id}`);
    expect(screen.queryByRole('heading', { name: 'This entry is gone' })).not.toBeInTheDocument();

    act(() => groupSyncFor(groupId)?.submit({ kind: 'entry.put', entry: lunch, base: null }));

    expect(await screen.findByDisplayValue('Lunch')).toBeInTheDocument();
  });

  it('keeps working offline and says what is waiting', async () => {
    setFakeOffline(true);
    const groupId = makeGroup(['Ben']);
    render(<App />);
    await addQuickExpense(groupId, '20', 'Lunch');

    expect(await screen.findByText(/Saved on this phone · \d+ waiting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Online' }));
    await waitFor(() => expect(screen.queryByText(/waiting/)).not.toBeInTheDocument());
  });
});

describe('joining by link', () => {
  async function groupFromAnotherPhone() {
    const other = createFakeBackend({
      server: createLocalStorageServer(),
      profile: 'ben',
      isOnline: () => true,
    });
    const group = { groupId: newGroupId(), inviteCode: newInviteCode() };
    const ana = { id: asMemberId('ana-member'), name: 'Ana', paynowMobile: null, archived: false };
    await other.publishGroup(
      group,
      pendingOp({ kind: 'group.created', name: 'Friday lunch', currency: 'SGD' }),
    );
    await other.push(group.groupId, [
      pendingOp({ kind: 'member.put', member: ana }),
      pendingOp({ kind: 'member.claimed', memberId: ana.id }),
      pendingOp({
        kind: 'member.put',
        member: { ...ana, id: asMemberId('cat-member'), name: 'Cat' },
      }),
    ]);
    return group;
  }

  it('joins, asks who you are with taken names marked, and remembers the answer', async () => {
    const group = await groupFromAnotherPhone();
    render(<App />);
    go(`/join#${group.inviteCode}`);

    expect(
      await screen.findByRole('heading', { name: 'Who are you in Friday lunch?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ana/ })).toBeDisabled();
    click("I'm not on the list");
    type('Your name', 'Dan');
    click('Join as Dan');

    expect(await screen.findByRole('heading', { name: 'Friday lunch' })).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'People' })).getAllByText(/./)).toHaveLength(
      3,
    );
  });

  it('says a link that opens nothing is bad, and waits for a signal to join', async () => {
    render(<App />);
    go(`/join#${newInviteCode()}`);
    expect(
      await screen.findByRole('heading', { name: "This link doesn't open a group" }),
    ).toBeInTheDocument();

    const group = await groupFromAnotherPhone();
    setFakeOffline(true);
    go(`/join#${group.inviteCode}`);
    expect(
      await screen.findByRole('heading', { name: 'Joining needs a signal' }),
    ).toBeInTheDocument();
    setFakeOffline(false);
    click('Try again');
    expect(
      await screen.findByRole('heading', { name: 'Who are you in Friday lunch?' }),
    ).toBeInTheDocument();
  });

  it('waits for a signal before a group joined offline can open', () => {
    setFakeOffline(true);
    const group = { groupId: newGroupId(), inviteCode: newInviteCode() };
    useJoinedGroupsStore.getState().add({ ...group, createdHere: false, name: '' });
    render(<App />);
    go(`/g/${group.groupId}`);

    return waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Waiting for a signal' })).toBeInTheDocument(),
    );
  });
});
