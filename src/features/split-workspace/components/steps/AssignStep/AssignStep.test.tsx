import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import type { EditableItem, ItemAssignment, Person, Receipt } from '@shared/types';
import { setPersonOnEveryItem } from '@features/split-workspace/logic/assignmentInteraction';
import { AssignStep } from './AssignStep';

interface AssignStepStoreMock {
  receipts: Receipt[];
  people: Person[];
  splitReceiptEvenly: ReturnType<typeof vi.fn>;
  setPersonOnReceiptItems: ReturnType<typeof vi.fn>;
  updateReceiptItem: ReturnType<typeof vi.fn>;
}

let storeMock: AssignStepStoreMock;

vi.mock('@features/split-workspace/stores/receiptStore', () => ({
  useReceiptStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeMock as unknown as Record<string, unknown>),
  ),
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: (state: Record<string, unknown>) => unknown) => fn,
}));

vi.mock('@features/split-workspace/hooks/useReceiptSplit', () => ({
  useReceiptSplit: () => ({
    consolidated: { split: { totalByPersonCents: { p1: 1200, p2: 450 } } },
  }),
}));

function makeItem(id: string, assignment: Partial<ItemAssignment> = {}): EditableItem {
  return {
    id,
    name: `Item ${id}`,
    amountInput: '12.00',
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: [], ...assignment },
  };
}

function makeReceipt(id: string, items: EditableItem[], currency = 'SGD'): Receipt {
  return {
    id,
    name: `Receipt ${id}`,
    items,
    discount: { ...defaultDiscountState },
    serviceCharge: { ...defaultServiceChargeState },
    gst: { ...defaultGstState },
    receiptTotalInput: '',
    roundingInput: '',
    currency,
    exchangeRateOverride: null,
  };
}

function setStoreMock(receipts: Receipt[]) {
  storeMock = {
    receipts,
    people: [
      { id: 'p1', name: 'Alice Tan' },
      { id: 'p2', name: 'Bob' },
    ],
    splitReceiptEvenly: vi.fn(),
    setPersonOnReceiptItems: vi.fn((receiptId: string, personId: string, checked: boolean) => {
      storeMock = {
        ...storeMock,
        receipts: storeMock.receipts.map((receipt) =>
          receipt.id === receiptId
            ? { ...receipt, items: setPersonOnEveryItem(receipt.items, personId, checked) }
            : receipt,
        ),
      };
    }),
    updateReceiptItem: vi.fn(
      (receiptId: string, itemId: string, updater: (item: EditableItem) => EditableItem) => {
        storeMock = {
          ...storeMock,
          receipts: storeMock.receipts.map((receipt) =>
            receipt.id === receiptId
              ? {
                  ...receipt,
                  items: receipt.items.map((item) => (item.id === itemId ? updater(item) : item)),
                }
              : receipt,
          ),
        };
      },
    ),
  };
}

function renderStep(activePersonId = 'p1') {
  const onActivePersonChange = vi.fn();
  const view = render(
    <AssignStep activePersonId={activePersonId} onActivePersonChange={onActivePersonChange} />,
  );
  // The store mock is not reactive, so re-render after each action to read the new state.
  const refresh = () =>
    view.rerender(
      <AssignStep activePersonId={activePersonId} onActivePersonChange={onActivePersonChange} />,
    );
  return { onActivePersonChange, refresh };
}

function assignmentOf(itemId: string) {
  const item = storeMock.receipts.flatMap((r) => r.items).find((i) => i.id === itemId);
  return item!.assignment;
}

describe('AssignStep', () => {
  beforeEach(() => {
    setStoreMock([
      makeReceipt('r1', [
        makeItem('open'),
        makeItem('shared', { personIds: ['p1', 'p2'] }),
        makeItem('weighted', { personIds: ['p1', 'p2'], weights: { p1: 2, p2: 1 } }),
      ]),
    ]);
  });

  it('asks what the active person had and shows their total without an item count', () => {
    renderStep('p2');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Bob have?');
    expect(screen.getAllByTestId('claim-person-p2')[0]).toHaveTextContent('$4.50');
    expect(screen.getAllByTestId('claim-person-p2')[0]).not.toHaveTextContent(/\d+ items?/);
    expect(screen.getAllByTestId('claim-person-p2')[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not insert a completion message into the item list', () => {
    const { refresh } = renderStep('p2');
    expect(screen.queryByTestId('claim-all-assigned')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('claim-item-toggle-open'));
    refresh();

    expect(screen.queryByTestId('claim-all-assigned')).not.toBeInTheDocument();
  });

  it('ticks the active person on and off an item', () => {
    const { refresh } = renderStep('p2');
    const toggle = () => screen.getByTestId('claim-item-toggle-open');

    fireEvent.click(toggle());
    refresh();
    expect(assignmentOf('open').personIds).toEqual(['p2']);
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('claim-item-share-open')).toHaveTextContent('1');
    expect(screen.getByTestId('claim-item-share-open-increase')).toBeDisabled();
    expect(screen.getByTestId('claim-item-share-open-decrease')).toBeEnabled();
    expect(screen.getByTestId('claim-item-amount-open')).toHaveTextContent('$12.00');

    fireEvent.click(toggle());
    refresh();
    expect(assignmentOf('open').personIds).toEqual([]);
    expect(screen.queryByTestId('claim-item-share-open')).not.toBeInTheDocument();
  });

  it('names a person on tapping their avatar without ticking the item', () => {
    renderStep('p2');

    fireEvent.click(within(screen.getByTestId('claim-item-claimants-shared')).getByText('Bob'));

    expect(storeMock.updateReceiptItem).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('claim-item-claimants-shared')).getByText('Bob')).toHaveClass(
      'opacity-100',
    );
  });

  it('switches the person from the people rail', () => {
    const { onActivePersonChange } = renderStep();

    fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);

    expect(onActivePersonChange).toHaveBeenCalledWith('p2');
  });

  it('steps a shared item up to half and down to a third in the row', () => {
    setStoreMock([makeReceipt('r1', [makeItem('w', { personIds: ['p1', 'p2'] })])]);
    storeMock.people.push({ id: 'p3', name: 'Cara' });
    storeMock.receipts[0].items[0].assignment.personIds.push('p3');
    const { refresh } = renderStep();
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/3');

    fireEvent.click(screen.getByTestId('claim-item-share-w-increase'));
    refresh();
    expect(assignmentOf('w').weights).toEqual({ p1: 2, p2: 1, p3: 1 });
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/2');
    expect(screen.getByTestId('claim-item-amount-w')).toHaveTextContent('$6.00');

    fireEvent.click(screen.getByTestId('claim-item-share-w-decrease'));
    refresh();
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/3');
  });

  it('halves a solo item by typing 1/2 and shows the other half as left', () => {
    setStoreMock([makeReceipt('r1', [makeItem('bread', { personIds: ['p1'] })])]);
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-amount-bread'));
    const input = screen.getByTestId('claim-item-amount-bread-input');
    fireEvent.change(input, { target: { value: '1/2' } });
    fireEvent.blur(input);
    refresh();

    expect(assignmentOf('bread').unassignedWeight).toBe(1);
    expect(screen.getByTestId('claim-item-claimants-bread')).toHaveAccessibleName(
      'Alice Tan, 1/2 left',
    );
  });

  it('takes a typed amount or percent from the price and splits the rest', () => {
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-amount-shared'));
    const input = screen.getByTestId('claim-item-amount-shared-input');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    refresh();
    expect(screen.getByTestId('claim-item-amount-shared')).toHaveTextContent('$9.00');

    fireEvent.click(screen.getByTestId('claim-item-amount-shared'));
    const percent = screen.getByTestId('claim-item-amount-shared-input');
    fireEvent.change(percent, { target: { value: '25%' } });
    fireEvent.blur(percent);
    refresh();
    expect(screen.getByTestId('claim-item-amount-shared')).toHaveTextContent('$3.00');
    expect(screen.getByTestId('claim-item-share-shared')).toHaveTextContent('1/4');
  });

  it('keeps the share when a typed value is unreadable or Escape is pressed', () => {
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-amount-shared'));
    const input = screen.getByTestId('claim-item-amount-shared-input');
    fireEvent.change(input, { target: { value: 'lots' } });
    fireEvent.blur(input);
    refresh();

    fireEvent.click(screen.getByTestId('claim-item-amount-shared'));
    fireEvent.keyDown(screen.getByTestId('claim-item-amount-shared-input'), { key: 'Escape' });
    refresh();

    expect(storeMock.updateReceiptItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('claim-item-amount-shared')).toHaveTextContent('$6.00');
  });

  it('splits an item evenly or gives it to the active person from the row', () => {
    const { refresh } = renderStep('p1');
    const splitEvenly = () => screen.getByTestId('claim-item-split-evenly-weighted');
    const takeAlone = () => screen.getByTestId('claim-item-take-alone-weighted');

    expect(screen.queryByTestId('claim-item-split-evenly-open')).not.toBeInTheDocument();
    expect(takeAlone()).toHaveAccessibleName('Alice only');

    fireEvent.click(splitEvenly());
    refresh();
    expect(assignmentOf('weighted')).toEqual({
      mode: 'equal',
      personId: '',
      personIds: ['p1', 'p2'],
    });
    expect(splitEvenly()).toBeDisabled();

    fireEvent.click(takeAlone());
    refresh();
    expect(assignmentOf('weighted').personIds).toEqual(['p1']);
    expect(takeAlone()).toBeDisabled();
    expect(splitEvenly()).toBeEnabled();
    expect(screen.getByTestId('claim-item-amount-weighted')).toHaveTextContent('$12.00');
  });

  it('selects and deselects every item on one receipt for the active person', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('a'), makeItem('b', { personIds: ['p1'] })]),
      makeReceipt('r2', [makeItem('c')]),
    ]);
    const { refresh } = renderStep('p2');
    const selectAll = () =>
      within(screen.getByTestId('claim-section-r1')).getByRole('checkbox', {
        name: 'Select all items on Receipt r1',
      });
    expect(selectAll()).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(selectAll());
    refresh();
    expect(assignmentOf('a').personIds).toEqual(['p2']);
    expect(assignmentOf('b').personIds).toEqual(['p1', 'p2']);
    expect(assignmentOf('c').personIds).toEqual([]);
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(selectAll());
    refresh();
    expect(assignmentOf('a').personIds).toEqual([]);
    expect(assignmentOf('b').personIds).toEqual(['p1']);
    expect(selectAll()).toHaveAttribute('aria-checked', 'false');
  });

  it('shows a receipt as partly selected and selects the rest on tap', () => {
    setStoreMock([makeReceipt('r1', [makeItem('a', { personIds: ['p2'] }), makeItem('b')])]);
    const { refresh } = renderStep('p2');
    const selectAll = () =>
      screen.getByRole('checkbox', { name: 'Select all items on Receipt r1' });
    expect(selectAll()).toHaveAttribute('aria-checked', 'mixed');

    fireEvent.click(selectAll());
    refresh();

    expect(assignmentOf('b').personIds).toEqual(['p2']);
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
  });

  it('asks before deselecting all when the person would lose a custom share', () => {
    setStoreMock([
      makeReceipt('r1', [
        makeItem('a', { personIds: ['p2'] }),
        makeItem('b', { personIds: ['p1', 'p2'], weights: { p1: 1, p2: 2 } }),
      ]),
    ]);
    const { refresh } = renderStep('p2');
    const selectAll = () =>
      screen.getByRole('checkbox', { name: 'Select all items on Receipt r1' });

    fireEvent.click(selectAll());
    const dialog = within(screen.getByRole('alertdialog'));
    expect(assignmentOf('a').personIds).toEqual(['p2']);

    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(assignmentOf('b').personIds).toEqual(['p1', 'p2']);

    fireEvent.click(selectAll());
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deselect all' }),
    );
    refresh();
    expect(assignmentOf('a').personIds).toEqual([]);
    expect(assignmentOf('b').personIds).toEqual(['p1']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lists every receipt on one page with a heading per receipt', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('a')]),
      makeReceipt('r2', [makeItem('b', { personIds: ['p2'] })]),
    ]);
    const { refresh } = renderStep();

    const second = screen.getByTestId('claim-section-r2');
    expect(screen.getByTestId('claim-item-a')).toBeInTheDocument();
    expect(within(second).getByTestId('claim-item-b')).toBeInTheDocument();
    expect(within(second).getByRole('heading', { level: 2 })).toHaveTextContent(/^Receipt r2$/);

    fireEvent.click(within(second).getByTestId('claim-item-toggle-b'));
    refresh();
    expect(assignmentOf('b').personIds).toEqual(['p2', 'p1']);
  });

  it('shows a single receipt heading when everything is assigned', () => {
    setStoreMock([makeReceipt('r1', [makeItem('a', { personIds: ['p1'] })])]);
    renderStep();

    expect(screen.getByRole('heading', { level: 2, name: /Receipt r1/ })).toBeVisible();
  });
});
