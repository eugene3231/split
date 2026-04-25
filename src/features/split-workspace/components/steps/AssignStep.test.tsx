import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { splitUnassignedItemsEqually } from '@features/split-workspace/logic/assignmentActions';
import type { EditableItem, Person, Receipt } from '@shared/types';
import { AssignStep } from './AssignStep';

type AssignStepStoreMock = {
  receipts: Receipt[];
  activeReceiptId: string;
  people: Person[];
  setActiveReceiptId: ReturnType<typeof vi.fn>;
  renameReceipt: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
  splitUnassignedItemsEquallyForActiveReceipt: ReturnType<typeof vi.fn>;
};

let storeMock: AssignStepStoreMock;

vi.mock('@features/split-workspace/stores/receiptStore', () => ({
  useReceiptStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeMock),
  ),
}));

vi.mock('zustand/shallow', () => ({
  useShallow: (fn: (state: Record<string, unknown>) => unknown) => fn,
}));

function setStoreMock(withSavedWeights = true) {
  const updateItem = vi.fn((itemId: string, updater: (item: EditableItem) => EditableItem) => {
    const receipt = storeMock.receipts[0];
    storeMock = {
      ...storeMock,
      receipts: [
        {
          ...receipt,
          items: receipt.items.map((item) => (item.id === itemId ? updater(item) : item)),
        },
      ],
    };
  });
  const splitUnassignedItemsEquallyForActiveReceipt = vi.fn(() => {
    const receipt = storeMock.receipts[0];
    storeMock = {
      ...storeMock,
      receipts: [
        {
          ...receipt,
          items: splitUnassignedItemsEqually(receipt.items, storeMock.people),
        },
      ],
    };
  });

  storeMock = {
    receipts: [
      {
        id: 'r1',
        name: 'Receipt 1',
        discount: { ...defaultDiscountState },
        serviceCharge: { ...defaultServiceChargeState },
        gst: { ...defaultGstState },
        receiptTotalInput: '',
        currency: 'SGD',
        exchangeRateOverride: null,
        items: [
          {
            id: 'equal-item',
            name: 'Equal item',
            amountInput: '12.00',
            discountPercentInput: '',
            assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
          },
          {
            id: 'weighted-item',
            name: 'Weighted item',
            amountInput: '12.00',
            discountPercentInput: '',
            assignment: {
              mode: 'equal',
              personId: '',
              personIds: ['p1', 'p2'],
              weights: withSavedWeights ? { p1: 2, p2: 1 } : undefined,
            },
          },
        ],
      },
    ],
    activeReceiptId: 'r1',
    people: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ],
    setActiveReceiptId: vi.fn(),
    renameReceipt: vi.fn(),
    updateItem,
    splitUnassignedItemsEquallyForActiveReceipt,
  };
}

describe('AssignStep', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setStoreMock();
  });

  it('shows saved unequal weights when opening a weighted item', () => {
    const { rerender } = render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={0}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // Equal item: both split buttons shown, weight controls hidden
    expect(screen.getByTestId('assign-split-mode-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equally' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'By shares' })).not.toBeDisabled();
    expect(screen.queryByText('Share weights')).not.toBeInTheDocument();

    rerender(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // Weighted item: both toggle buttons shown, weight controls visible
    expect(screen.getByTestId('assign-weight-controls')).toBeInTheDocument();
    expect(screen.getByTestId('assign-weight-value-p1')).toHaveValue('2');
    expect(screen.getByTestId('assign-weight-value-p2')).toHaveValue('1');
    expect(screen.getByTestId('assign-weight-decrement-p1')).not.toBeDisabled();
    expect(screen.getByTestId('assign-weight-decrement-p2')).toBeDisabled();
  });

  it('clears saved weights when clicking Equally in shares mode', () => {
    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // In shares mode, click "Equally" to switch back (By shares button does nothing)
    fireEvent.click(screen.getByRole('button', { name: 'Equally' }));

    const weightedItem = storeMock.receipts[0].items[1];
    expect(weightedItem.assignment.weights).toBeUndefined();
  });

  it('shows the Split control disabled when fewer than two people are selected', () => {
    storeMock = {
      ...storeMock,
      receipts: [
        {
          ...storeMock.receipts[0],
          items: [
            {
              ...storeMock.receipts[0].items[0],
              assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
            },
          ],
        },
      ],
    };

    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={0}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('assign-split-mode-toggle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equally' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'By shares' })).toBeDisabled();
  });

  it('splits unassigned items equally and jumps to review when clicking Split unassigned', () => {
    storeMock = {
      ...storeMock,
      receipts: [
        {
          ...storeMock.receipts[0],
          items: [
            ...storeMock.receipts[0].items,
            {
              id: 'unassigned-item',
              name: 'Unassigned item',
              amountInput: '8.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: [] },
            },
          ],
        },
      ],
    };
    const onActiveItemIndexChange = vi.fn();
    const onItemsSubPhaseChange = vi.fn();

    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={0}
        onActiveItemIndexChange={onActiveItemIndexChange}
        onItemsSubPhaseChange={onItemsSubPhaseChange}
      />,
    );

    fireEvent.click(screen.getByTestId('assign-split-rest-btn'));

    expect(storeMock.splitUnassignedItemsEquallyForActiveReceipt).toHaveBeenCalledTimes(1);
    expect(onActiveItemIndexChange).toHaveBeenCalledWith(0);
    expect(onItemsSubPhaseChange).toHaveBeenCalledWith('review');
    expect(storeMock.receipts[0].items[0].assignment.weights).toBeUndefined();
    expect(storeMock.receipts[0].items[1].assignment.weights).toEqual({ p1: 2, p2: 1 });
    expect(storeMock.receipts[0].items[2].assignment.personIds).toEqual(['p1', 'p2']);
  });

  it('disables Split unassigned when all items are already assigned', () => {
    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={0}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('assign-split-rest-btn')).toBeDisabled();
  });

  it('disables Split unassigned when there are no people', () => {
    storeMock = {
      ...storeMock,
      people: [],
      receipts: [
        {
          ...storeMock.receipts[0],
          items: [
            {
              id: 'unassigned-item',
              name: 'Unassigned item',
              amountInput: '8.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: [] },
            },
          ],
        },
      ],
    };

    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={0}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('assign-split-rest-btn')).toBeDisabled();
  });
});
