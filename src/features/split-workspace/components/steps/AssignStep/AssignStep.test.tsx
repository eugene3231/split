import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { splitUnassignedItemsEqually } from '@features/split-workspace/logic/assignmentInteraction';
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

function setStoreMock(withSavedWeights = true, weights: Record<string, number> = { p1: 2, p2: 1 }) {
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
              weights: withSavedWeights ? weights : undefined,
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

    // Equal item: all three tabs enabled; Shares is the resting tab, so both
    // people show an even 1/2 stepper even though no explicit weights are saved.
    expect(screen.getByTestId('assign-split-card')).toBeInTheDocument();
    expect(screen.getByTestId('assign-mode-tab-shares')).not.toBeDisabled();
    expect(screen.getByTestId('assign-mode-tab-percent')).not.toBeDisabled();
    expect(screen.getByTestId('assign-mode-tab-amount')).not.toBeDisabled();
    expect(screen.getByTestId('assign-weight-p1-value')).toHaveTextContent('1/2');
    expect(screen.getByTestId('assign-weight-p2-value')).toHaveTextContent('1/2');

    rerender(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // Weighted item: shares steppers visible, reflecting the saved weights (unsimplified 2/3, 1/3 fraction display)
    expect(screen.getByTestId('assign-weight-p1-value')).toHaveTextContent('2/3');
    expect(screen.getByTestId('assign-weight-p2-value')).toHaveTextContent('1/3');
    // Decrement is never disabled at the floor — pressing it at weight 1 removes the person instead.
    expect(screen.getByTestId('assign-weight-p1-decrement')).not.toBeDisabled();
    expect(screen.getByTestId('assign-weight-p2-decrement')).not.toBeDisabled();
  });

  it('shows the unsimplified share fraction rather than reducing it', () => {
    setStoreMock(true, { p1: 3, p2: 9 });
    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // 3/12 and 9/12 would reduce to 1/4 and 3/4 — the display must keep the raw form.
    expect(screen.getByTestId('assign-weight-p1-value')).toHaveTextContent('3/12');
    expect(screen.getByTestId('assign-weight-p2-value')).toHaveTextContent('9/12');
  });

  it('removes a person instead of decrementing below the floor weight', () => {
    render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('assign-weight-p2-decrement'));

    const weightedItem = storeMock.receipts[0].items[1];
    expect(weightedItem.assignment.personIds).toEqual(['p1']);
  });

  it('clears saved weights when clicking Split equally, leaving the active tab untouched', () => {
    const { rerender } = render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('assign-mode-tab-percent'));

    // The store mock has no real reactivity, so force a re-render to pick up
    // the tab switch before dispatching the next command.
    rerender(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('assign-split-equally-btn'));

    const weightedItem = storeMock.receipts[0].items[1];
    expect(weightedItem.assignment.weights).toBeUndefined();
    expect(weightedItem.assignment.weightsInputMode).toBe('percent');
  });

  it('shows the receipt currency symbol on the Amount tab, not a hardcoded $', () => {
    storeMock = {
      ...storeMock,
      receipts: [{ ...storeMock.receipts[0], currency: 'EUR' }],
    };

    const { rerender } = render(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('assign-mode-tab-amount'));
    rerender(
      <AssignStep
        itemsSubPhase="assign"
        activeItemIndex={1}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    // Both p1 and p2 are fractional (selectedCount === 2, neither solo), so each
    // renders its own amount-input prefix — assert on all matches, not a single one.
    expect(screen.getAllByText('€').length).toBeGreaterThan(0);
    expect(screen.queryByText('$')).not.toBeInTheDocument();
  });

  it('shows all three split tabs disabled when fewer than two people are selected', () => {
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

    expect(screen.getByTestId('assign-split-card')).toBeInTheDocument();
    expect(screen.getByTestId('assign-mode-tab-shares')).toBeDisabled();
    expect(screen.getByTestId('assign-mode-tab-percent')).toBeDisabled();
    expect(screen.getByTestId('assign-mode-tab-amount')).toBeDisabled();
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

  it('shows items from every receipt in Review All, not just the active one', () => {
    storeMock = {
      ...storeMock,
      receipts: [
        ...storeMock.receipts,
        {
          id: 'r2',
          name: 'Receipt 2',
          discount: { ...defaultDiscountState },
          serviceCharge: { ...defaultServiceChargeState },
          gst: { ...defaultGstState },
          receiptTotalInput: '',
          currency: 'SGD',
          exchangeRateOverride: null,
          items: [
            {
              id: 'other-receipt-item',
              name: 'Other receipt item',
              amountInput: '5.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
            },
          ],
        },
      ],
    };

    render(
      <AssignStep
        itemsSubPhase="review"
        activeItemIndex={0}
        onActiveItemIndexChange={vi.fn()}
        onItemsSubPhaseChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Equal item')).toBeInTheDocument();
    expect(screen.getByText('Weighted item')).toBeInTheDocument();
    expect(screen.getByText('Other receipt item')).toBeInTheDocument();
    expect(screen.getAllByText('Receipt 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Receipt 2').length).toBeGreaterThan(0);
  });

  it('switches to the owning receipt when editing an item from Review All', () => {
    storeMock = {
      ...storeMock,
      receipts: [
        ...storeMock.receipts,
        {
          id: 'r2',
          name: 'Receipt 2',
          discount: { ...defaultDiscountState },
          serviceCharge: { ...defaultServiceChargeState },
          gst: { ...defaultGstState },
          receiptTotalInput: '',
          currency: 'SGD',
          exchangeRateOverride: null,
          items: [
            {
              id: 'other-receipt-item',
              name: 'Other receipt item',
              amountInput: '5.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
            },
          ],
        },
      ],
    };
    const onActiveItemIndexChange = vi.fn();
    const onItemsSubPhaseChange = vi.fn();

    render(
      <AssignStep
        itemsSubPhase="review"
        activeItemIndex={0}
        onActiveItemIndexChange={onActiveItemIndexChange}
        onItemsSubPhaseChange={onItemsSubPhaseChange}
      />,
    );

    const editButtons = screen.getAllByTestId('wizard-edit-btn');
    fireEvent.click(editButtons[editButtons.length - 1]);

    expect(storeMock.setActiveReceiptId).toHaveBeenCalledWith('r2');
    expect(onActiveItemIndexChange).toHaveBeenCalledWith(0);
    expect(onItemsSubPhaseChange).toHaveBeenCalledWith('assign');
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
