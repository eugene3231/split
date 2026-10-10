import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import type { EditableItem, ItemAssignment, Person, Receipt } from '@shared/types';
import { AssignStep } from './AssignStep';

interface AssignStepStoreMock {
  receipts: Receipt[];
  activeReceiptId: string;
  people: Person[];
  setActiveReceiptId: ReturnType<typeof vi.fn>;
  renameReceipt: ReturnType<typeof vi.fn>;
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
    currency,
    exchangeRateOverride: null,
  };
}

function setStoreMock(receipts: Receipt[]) {
  storeMock = {
    receipts,
    activeReceiptId: receipts[0].id,
    people: [
      { id: 'p1', name: 'Alice Tan' },
      { id: 'p2', name: 'Bob' },
    ],
    setActiveReceiptId: vi.fn(),
    renameReceipt: vi.fn(),
    updateItem: vi.fn((itemId: string, updater: (item: EditableItem) => EditableItem) => {
      storeMock = {
        ...storeMock,
        receipts: storeMock.receipts.map((receipt) =>
          receipt.id === storeMock.activeReceiptId
            ? {
                ...receipt,
                items: receipt.items.map((item) => (item.id === itemId ? updater(item) : item)),
              }
            : receipt,
        ),
      };
    }),
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

  it('asks what the active person had by first name and shows running totals', () => {
    renderStep('p2');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Bob have?');
    expect(screen.getAllByTestId('claim-person-p1')[0]).toHaveTextContent('$12.00');
    expect(screen.getAllByTestId('claim-person-p2')[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('claim-progress')).toHaveTextContent('2 of 3 claimed');
  });

  it('toggles the active person on and off an item when the tile is tapped', () => {
    const { refresh } = renderStep('p2');
    const toggle = () => screen.getByTestId('claim-item-toggle-open');

    fireEvent.click(toggle());
    refresh();
    expect(assignmentOf('open').personIds).toEqual(['p2']);
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('claim-item-share-open')).toHaveTextContent('Just you');

    fireEvent.click(toggle());
    refresh();
    expect(assignmentOf('open').personIds).toEqual([]);
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('shares an unclaimed item with everyone', () => {
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-everyone-open'));
    refresh();

    expect(assignmentOf('open').personIds).toEqual(['p1', 'p2']);
    expect(screen.queryByTestId('claim-item-everyone-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('claim-item-share-open')).toHaveTextContent(
      'Shared 2 ways · $6.00 each',
    );
  });

  it('switches the claiming person from the people rail', () => {
    const { onActivePersonChange } = renderStep();

    fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);

    expect(onActivePersonChange).toHaveBeenCalledWith('p2');
  });

  it('only offers Adjust split on items with two or more claimants', () => {
    renderStep();

    expect(screen.queryByTestId('claim-item-adjust-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('claim-item-adjust-shared')).toBeInTheDocument();
  });

  it('changes the share label when shares are adjusted in the sheet', () => {
    const { refresh } = renderStep();
    expect(screen.getByTestId('claim-item-share-shared')).toHaveTextContent(
      'Shared 2 ways · $6.00 each',
    );

    fireEvent.click(screen.getByTestId('claim-item-adjust-shared'));
    refresh();
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByTestId('assign-weight-p1-value')).toHaveTextContent('1/2');

    fireEvent.click(within(sheet).getByTestId('assign-weight-p1-increment'));
    refresh();

    expect(assignmentOf('shared').weights).toEqual({ p1: 2, p2: 1 });
    expect(screen.getByTestId('assign-weight-p1-value')).toHaveTextContent('2/3');
    expect(screen.getByTestId('split-adjust-share-p1')).toHaveTextContent('$8.00');
    expect(screen.getByTestId('claim-item-share-shared')).toHaveTextContent(
      'Custom split · you pay $8.00',
    );
  });

  it('shows the unsimplified share fraction for saved weights', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('w', { personIds: ['p1', 'p2'], weights: { p1: 3, p2: 9 } })]),
    ]);
    const { refresh } = renderStep();

    fireEvent.click(screen.getByTestId('claim-item-adjust-w'));
    refresh();

    expect(screen.getByTestId('assign-weight-p1-value')).toHaveTextContent('3/12');
    expect(screen.getByTestId('assign-weight-p2-value')).toHaveTextContent('9/12');
    expect(screen.getByTestId('assign-weight-p1-decrement')).not.toBeDisabled();
    expect(screen.getByTestId('assign-weight-p2-decrement')).not.toBeDisabled();
  });

  it('clears custom weights with Split equally and keeps the chosen tab', () => {
    const { refresh } = renderStep();
    fireEvent.click(screen.getByTestId('claim-item-adjust-weighted'));
    refresh();

    fireEvent.click(screen.getByTestId('assign-mode-tab-percent'));
    refresh();
    fireEvent.click(screen.getByTestId('assign-split-equally-btn'));
    refresh();

    expect(assignmentOf('weighted').weights).toBeUndefined();
    expect(assignmentOf('weighted').weightsInputMode).toBe('percent');
  });

  it('prefixes amounts with the receipt currency symbol', () => {
    setStoreMock([makeReceipt('r1', [makeItem('w', { personIds: ['p1', 'p2'] })], 'EUR')]);
    const { refresh } = renderStep();
    fireEvent.click(screen.getByTestId('claim-item-adjust-w'));
    refresh();

    fireEvent.click(screen.getByTestId('assign-mode-tab-amount'));
    refresh();

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getAllByText('€')).toHaveLength(2);
    expect(within(sheet).queryByText('$')).not.toBeInTheDocument();
  });

  it('closes the sheet for good when a percent commit leaves one claimant', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('w', { personIds: ['p1', 'p2'], weightsInputMode: 'percent' })]),
    ]);
    const { refresh } = renderStep('p2');
    fireEvent.click(screen.getByTestId('claim-item-adjust-w'));
    refresh();

    const input = screen.getByTestId('assign-percent-p1');
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.blur(input);
    refresh();

    expect(assignmentOf('w').personIds).toEqual(['p1']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('claim-item-toggle-w'));
    refresh();
    expect(assignmentOf('w').personIds).toEqual(['p1', 'p2']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the sheet with Done or Escape', () => {
    const { refresh } = renderStep();
    fireEvent.click(screen.getByTestId('claim-item-adjust-shared'));
    refresh();
    fireEvent.click(screen.getByTestId('split-adjust-done-btn'));
    refresh();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('claim-item-adjust-shared'));
    refresh();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    refresh();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows receipt tabs only with several receipts and switches the active receipt', () => {
    setStoreMock([
      makeReceipt('r1', [makeItem('a')]),
      makeReceipt('r2', [makeItem('b', { personIds: ['p2'] })]),
    ]);
    renderStep();

    expect(screen.getByTestId('claim-item-a')).toBeInTheDocument();
    expect(screen.queryByTestId('claim-item-b')).not.toBeInTheDocument();
    expect(screen.getByTestId('claim-progress')).toHaveTextContent('1 of 2 claimed');

    fireEvent.click(screen.getByText('Receipt r2'));
    expect(storeMock.setActiveReceiptId).toHaveBeenCalledWith('r2');
  });

  it('hides receipt tabs for a single receipt', () => {
    renderStep();

    expect(screen.queryByText('Receipt r1')).not.toBeInTheDocument();
  });
});
