import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditableItem, Person, Receipt } from '@shared/types';
import { AssignStep } from './AssignStep';

type AssignStepStoreMock = {
  receipts: Receipt[];
  activeReceiptId: string;
  people: Person[];
  setActiveReceiptId: ReturnType<typeof vi.fn>;
  renameReceipt: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
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

  storeMock = {
    receipts: [
      {
        id: 'r1',
        name: 'Receipt 1',
        currency: 'SGD',
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

    expect(screen.getByRole('button', { name: 'Equal' })).toBeInTheDocument();
    expect(screen.queryByText('Share weights')).not.toBeInTheDocument();

    rerender(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Unequal' })).toBeInTheDocument();
    expect(screen.getByTestId('assign-weight-controls')).toBeInTheDocument();
    expect(screen.getByTestId('assign-weight-value-p1')).toHaveTextContent('2');
    expect(screen.getByTestId('assign-weight-value-p2')).toHaveTextContent('1');
    expect(screen.getByTestId('assign-weight-decrement-p1')).not.toBeDisabled();
    expect(screen.getByTestId('assign-weight-decrement-p2')).toBeDisabled();
  });

  it('clears saved weights on the first toggle click', () => {
    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unequal' }));

    const weightedItem = storeMock.receipts[0].items[1];
    expect(weightedItem.assignment.weights).toBeUndefined();
  });
});
