import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import type { EditableItem, ItemAssignment, Person, Receipt } from '@shared/types';
import { NOBODY, equalShares, makeAssignment } from '@features/split-workspace/logic/assignment';
import { AssignStep } from './AssignStep';
import type { CurrencyCode } from '@shared/constants';
import type { AssignMode } from '@features/split-workspace/types';

interface AssignStepStoreMock {
  receipts: Receipt[];
  people: Person[];
  updateItems: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
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

vi.mock('@features/split-workspace/hooks/useSplits', () => ({
  useSplits: () => ({
    consolidated: { byPerson: { p1: { totalCents: 1200 }, p2: { totalCents: 450 } } },
  }),
}));

function makeItem(id: string, assignment: ItemAssignment = NOBODY): EditableItem {
  return {
    id,
    name: `Item ${id}`,
    amountInput: '12.00',
    discountPercentInput: '',
    assignment,
  };
}

function makeReceipt(id: string, items: EditableItem[], currency: CurrencyCode = 'SGD'): Receipt {
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
    updateItems: vi.fn(
      (receiptId: string, update: (items: EditableItem[], people: Person[]) => EditableItem[]) => {
        storeMock = {
          ...storeMock,
          receipts: storeMock.receipts.map((receipt) =>
            receipt.id === receiptId
              ? { ...receipt, items: update(receipt.items, storeMock.people) }
              : receipt,
          ),
        };
      },
    ),
    updateItem: vi.fn(
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

function renderStep(activePersonId = 'p1', initialMode: AssignMode = 'person') {
  const onSelectPerson = vi.fn();
  let mode = initialMode;
  const step = () => (
    <AssignStep
      mode={mode}
      onModeChange={(next) => {
        mode = next;
        refresh();
      }}
      activePersonId={activePersonId}
      onSelectPerson={onSelectPerson}
    />
  );
  const view = render(step());
  // The store mock is not reactive, so re-render after each action to read the new state.
  const refresh = () => view.rerender(step());
  return { onSelectPerson, refresh };
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
        makeItem('shared', equalShares(['p1', 'p2'])),
        makeItem('weighted', makeAssignment({ p1: 2, p2: 1 })),
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

  it("counts what is left in the receipt's header, and drops the count once nothing is", () => {
    const { refresh } = renderStep('p2');
    expect(screen.getByTestId('claim-section-left-r1')).toHaveTextContent('1 left');

    fireEvent.click(screen.getByTestId('claim-item-toggle-open'));
    refresh();

    expect(screen.queryByTestId('claim-section-left-r1')).not.toBeInTheDocument();
  });

  it('ticks the active person on and off an item', () => {
    const { refresh } = renderStep('p2');
    const toggle = () => screen.getByTestId('claim-item-toggle-open');

    fireEvent.click(toggle());
    refresh();
    expect(Object.keys(assignmentOf('open').shares)).toEqual(['p2']);
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('claim-item-share-open')).toHaveTextContent('Your share: All');
    expect(screen.getByTestId('claim-item-share-open-increase')).toBeDisabled();
    expect(screen.getByTestId('claim-item-share-open-decrease')).toBeEnabled();
    expect(screen.getByTestId('claim-item-amount-open')).toHaveTextContent('$12.00');

    fireEvent.click(toggle());
    refresh();
    expect(Object.keys(assignmentOf('open').shares)).toEqual([]);
    expect(screen.queryByTestId('claim-item-share-open')).not.toBeInTheDocument();
  });

  it('names a person on tapping their avatar without ticking the item', () => {
    renderStep('p2');

    fireEvent.click(within(screen.getByTestId('claim-item-claimants-shared')).getByText('Bob'));

    expect(storeMock.updateItem).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('claim-item-claimants-shared')).getByText('Bob')).toHaveClass(
      'opacity-100',
    );
  });

  it('switches the person from the people rail', () => {
    const { onSelectPerson } = renderStep();

    fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);

    expect(onSelectPerson).toHaveBeenCalledWith('p2');
  });

  it('steps a shared item up to half and down to a third in the row', () => {
    setStoreMock([makeReceipt('r1', [makeItem('w', equalShares(['p1', 'p2', 'p3']))])]);
    storeMock.people.push({ id: 'p3', name: 'Cara' });
    const { refresh } = renderStep();
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/3');

    fireEvent.click(screen.getByTestId('claim-item-share-w-increase'));
    refresh();
    expect(assignmentOf('w').shares).toEqual({ p1: 2, p2: 1, p3: 1 });
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/2');
    expect(screen.getByTestId('claim-item-amount-w')).toHaveTextContent('$6.00');

    fireEvent.click(screen.getByTestId('claim-item-share-w-decrease'));
    refresh();
    expect(screen.getByTestId('claim-item-share-w')).toHaveTextContent('1/3');
  });

  it('halves a solo item by typing 1/2 and shows the other half as left', () => {
    setStoreMock([makeReceipt('r1', [makeItem('bread', equalShares(['p1']))])]);
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-amount-bread'));
    const input = screen.getByTestId('claim-item-amount-bread-input');
    fireEvent.change(input, { target: { value: '1/2' } });
    fireEvent.blur(input);
    refresh();

    expect(assignmentOf('bread').unassignedShare).toBe(1);
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

    expect(storeMock.updateItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('claim-item-amount-shared')).toHaveTextContent('$6.00');
  });

  it('splits an item evenly or gives it to the active person from the row', () => {
    const { refresh } = renderStep('p1');
    const splitEvenly = () => screen.getByTestId('claim-item-split-evenly-weighted');
    const takeAlone = () => screen.getByTestId('claim-item-take-alone-weighted');

    expect(screen.queryByTestId('claim-item-split-evenly-open')).not.toBeInTheDocument();
    expect(takeAlone()).toHaveAccessibleName('Only Alice had this');
    expect(takeAlone()).toHaveTextContent('Only Alice');

    fireEvent.click(splitEvenly());
    refresh();
    expect(assignmentOf('weighted')).toEqual(equalShares(['p1', 'p2']));
    expect(splitEvenly()).toBeDisabled();

    fireEvent.click(takeAlone());
    refresh();
    expect(Object.keys(assignmentOf('weighted').shares)).toEqual(['p1']);
    expect(takeAlone()).toBeDisabled();
    expect(splitEvenly()).toBeEnabled();
    expect(screen.getByTestId('claim-item-amount-weighted')).toHaveTextContent('$12.00');
  });

  it('selects and deselects every item on one receipt for the active person', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('a'), makeItem('b', equalShares(['p1']))]),
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
    expect(Object.keys(assignmentOf('a').shares)).toEqual(['p2']);
    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p1', 'p2']);
    expect(Object.keys(assignmentOf('c').shares)).toEqual([]);
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(selectAll());
    refresh();
    expect(Object.keys(assignmentOf('a').shares)).toEqual([]);
    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p1']);
    expect(selectAll()).toHaveAttribute('aria-checked', 'false');
  });

  it('shows a receipt as partly selected and selects the rest on tap', () => {
    setStoreMock([makeReceipt('r1', [makeItem('a', equalShares(['p2'])), makeItem('b')])]);
    const { refresh } = renderStep('p2');
    const selectAll = () =>
      screen.getByRole('checkbox', { name: 'Select all items on Receipt r1' });
    expect(selectAll()).toHaveAttribute('aria-checked', 'mixed');

    fireEvent.click(selectAll());
    refresh();

    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p2']);
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
  });

  it('asks before deselecting all when the person would lose a custom share', () => {
    setStoreMock([
      makeReceipt('r1', [
        makeItem('a', equalShares(['p2'])),
        makeItem('b', makeAssignment({ p1: 1, p2: 2 })),
      ]),
    ]);
    const { refresh } = renderStep('p2');
    const selectAll = () =>
      screen.getByRole('checkbox', { name: 'Select all items on Receipt r1' });

    fireEvent.click(selectAll());
    const dialog = within(screen.getByRole('alertdialog'));
    expect(Object.keys(assignmentOf('a').shares)).toEqual(['p2']);

    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p1', 'p2']);

    fireEvent.click(selectAll());
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deselect all' }),
    );
    refresh();
    expect(Object.keys(assignmentOf('a').shares)).toEqual([]);
    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p1']);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lists every receipt on one page with a heading per receipt', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('a')]),
      makeReceipt('r2', [makeItem('b', equalShares(['p2']))]),
    ]);
    const { refresh } = renderStep();

    const second = screen.getByTestId('claim-section-r2');
    expect(screen.getByTestId('claim-item-a')).toBeInTheDocument();
    expect(within(second).getByTestId('claim-item-b')).toBeInTheDocument();
    expect(within(second).getByRole('heading', { level: 2 })).toHaveTextContent(/^Receipt r2$/);

    fireEvent.click(within(second).getByTestId('claim-item-toggle-b'));
    refresh();
    expect(Object.keys(assignmentOf('b').shares)).toEqual(['p2', 'p1']);
  });

  it('shows a single receipt heading when everything is assigned', () => {
    setStoreMock([makeReceipt('r1', [makeItem('a', equalShares(['p1']))])]);
    renderStep();

    expect(screen.getByRole('heading', { level: 2, name: /Receipt r1/ })).toBeVisible();
  });

  describe('by item', () => {
    const expanded = (itemId: string) =>
      screen.getByTestId(`item-claim-toggle-${itemId}`).getAttribute('aria-expanded');

    it('switches from By person to By item with nobody active', () => {
      renderStep('p2');

      fireEvent.click(screen.getByRole('radio', { name: 'By item' }));

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Who had each item?');
      expect(screen.getByRole('radio', { name: 'By item' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getAllByTestId('claim-person-p2')[0]).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('checkbox', { name: /Select all items/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Split all evenly' })).toBeInTheDocument();
    });

    it('opens the first item left, and one row at a time on tap', () => {
      renderStep('p1', 'item');

      expect(expanded('open')).toBe('true');
      expect(within(screen.getByTestId('item-claim-open')).getByText('Nobody yet')).toBeVisible();

      fireEvent.click(screen.getByTestId('item-claim-toggle-shared'));
      expect(expanded('shared')).toBe('true');
      expect(expanded('open')).toBe('false');

      fireEvent.click(screen.getByTestId('item-claim-toggle-shared'));
      expect(expanded('shared')).toBe('false');
      expect(screen.queryByRole('group', { name: /Who had/ })).not.toBeInTheDocument();
    });

    it('adds and removes a person with their chip and shows what they pay', () => {
      const { refresh } = renderStep('p1', 'item');
      const chip = (personId: string) => screen.getByTestId(`item-claim-chip-open-${personId}`);

      fireEvent.click(chip('p2'));
      refresh();
      expect(assignmentOf('open')).toEqual(equalShares(['p2']));
      expect(chip('p2')).toHaveAttribute('aria-pressed', 'true');
      expect(chip('p2')).toHaveTextContent('Bob$12.00');

      fireEvent.click(chip('p1'));
      refresh();
      expect(assignmentOf('open')).toEqual(equalShares(['p2', 'p1']));
      expect(chip('p1')).toHaveTextContent('Alice$6.00');
      expect(screen.getByTestId('item-claim-everyone-open')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      fireEvent.click(chip('p2'));
      refresh();
      expect(assignmentOf('open')).toEqual(equalShares(['p1']));
      expect(chip('p2')).toHaveAttribute('aria-pressed', 'false');
      expect(chip('p2')).toHaveTextContent(/^BBob$/);
    });

    it('splits an item between everyone, and clears it on a second tap', () => {
      const { refresh } = renderStep('p1', 'item');
      fireEvent.click(screen.getByTestId('item-claim-toggle-weighted'));
      const everyone = () => screen.getByTestId('item-claim-everyone-weighted');
      expect(everyone()).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(everyone());
      refresh();
      expect(assignmentOf('weighted')).toEqual(equalShares(['p1', 'p2']));
      expect(everyone()).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(everyone());
      refresh();
      expect(assignmentOf('weighted')).toEqual(NOBODY);
    });

    it('says when an item has uneven shares instead of offering a stepper', () => {
      renderStep('p1', 'item');

      fireEvent.click(screen.getByTestId('item-claim-toggle-weighted'));

      expect(screen.getByText(/uneven/)).toBeVisible();
      expect(screen.queryByTestId('claim-item-share-weighted')).not.toBeInTheDocument();
      expect(screen.getByTestId('item-claim-chip-weighted-p1')).toHaveTextContent('$8.00');
    });

    it('moves on to the next item left across receipts, then closes when none is left', () => {
      setStoreMock([
        makeReceipt('r1', [makeItem('a'), makeItem('b', equalShares(['p1']))]),
        makeReceipt('r2', [makeItem('c')]),
      ]);
      const { refresh } = renderStep('p1', 'item');
      expect(expanded('a')).toBe('true');

      fireEvent.click(screen.getByTestId('item-claim-next-a'));
      expect(expanded('c')).toBe('true');
      expect(expanded('a')).toBe('false');

      fireEvent.click(screen.getByTestId('item-claim-everyone-c'));
      refresh();
      expect(screen.getByTestId('item-claim-next-c')).toHaveTextContent('Next item');
      fireEvent.click(screen.getByTestId('item-claim-next-c'));
      expect(expanded('a')).toBe('true');

      fireEvent.click(screen.getByTestId('item-claim-chip-a-p2'));
      refresh();
      expect(screen.getByTestId('item-claim-next-a')).toHaveTextContent('Done');
      fireEvent.click(screen.getByTestId('item-claim-next-a'));
      expect(screen.queryByRole('group', { name: /Who had/ })).not.toBeInTheDocument();
    });

    it('opens the first row when every item is assigned', () => {
      setStoreMock([
        makeReceipt('r1', [makeItem('a', equalShares(['p1'])), makeItem('b', equalShares(['p2']))]),
      ]);
      renderStep('p1', 'item');

      expect(expanded('a')).toBe('true');
      expect(expanded('b')).toBe('false');
    });

    it('hands a person picked from the rail to By person', () => {
      const { onSelectPerson } = renderStep('p1', 'item');

      fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);

      expect(onSelectPerson).toHaveBeenCalledWith('p2');
    });
  });
});
