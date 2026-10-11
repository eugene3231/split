import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '@features/receipt-scanner/constants';
import { LOCAL_STORAGE_OCR_SETTINGS_KEY } from '@features/split-workspace/constants';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';

const { generateReceiptSplitImageLightMock } = vi.hoisted(() => ({
  generateReceiptSplitImageLightMock: vi.fn(),
}));

vi.mock('../features/sharing/logic/receiptSplitImageLight', () => ({
  generateReceiptSplitImageLight: generateReceiptSplitImageLightMock,
}));

import { ReceiptSplitterPage } from '@pages/ReceiptSplitterPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useReceiptStore.setState({
    peopleInput: '',
    initialized: false,
  });
  useGeminiStore.setState({
    geminiApiKeyInput: 'test-key',
    rememberGeminiApiKey: false,
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
}

const disabledChargeState = {
  enabled: false,
  mode: 'amount',
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

function makeReceipt(overrides: { id: string; items?: object[]; receiptTotalInput?: string }) {
  return {
    id: overrides.id,
    name: `Receipt ${overrides.id}`,
    items: overrides.items ?? [
      {
        id: `${overrides.id}-i1`,
        name: 'Chicken Rice',
        amountInput: '10.00',
        discountPercentInput: '',
        assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
      },
    ],
    discount: disabledChargeState,
    serviceCharge: disabledChargeState,
    gst: disabledChargeState,
    receiptTotalInput: overrides.receiptTotalInput ?? '',
  };
}

function seedV2Draft(overrides: {
  people?: object[];
  receipts?: object[];
  activeReceiptId?: string;
}) {
  const people = overrides.people ?? [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ];
  const receipts = overrides.receipts ?? [makeReceipt({ id: 'r1' })];
  window.localStorage.setItem(
    'split:receipt-draft:v1',
    JSON.stringify({
      version: 2,
      people,
      receipts,
      activeReceiptId: overrides.activeReceiptId ?? (receipts[0] as { id: string }).id,
      savedAt: '2026-03-21T00:00:00.000Z',
    }),
  );
}

function addPeople(names: string) {
  fireEvent.change(screen.getByTestId('people-input'), { target: { value: names } });
  fireEvent.click(screen.getByTestId('people-add-btn'));
}

function clickContinue() {
  fireEvent.click(screen.getByTestId('wizard-continue-btn'));
}

function clickBack() {
  fireEvent.click(screen.getByTestId('wizard-back-btn'));
}

function clickStepNav(step: 'people' | 'receipt' | 'items' | 'final') {
  fireEvent.click(screen.getByTestId(`wizard-step-nav-${step}`));
}

function expectActiveStepNav(step: 'people' | 'receipt' | 'items' | 'final') {
  expect(screen.getByTestId(`wizard-step-nav-${step}`)).toHaveAttribute('aria-current', 'step');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetStore();
  generateReceiptSplitImageLightMock.mockReset();
  generateReceiptSplitImageLightMock.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReceiptSplitterPage integration', () => {
  describe('People step', () => {
    it('renders the people step as the initial step with continue disabled', () => {
      render(<ReceiptSplitterPage />);
      expect(screen.getByTestId('workspace')).toBeInTheDocument();
      expect(screen.getByTestId('people-empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('does not show a back button on the first step', () => {
      render(<ReceiptSplitterPage />);
      expect(screen.queryByTestId('wizard-back-btn')).not.toBeInTheDocument();
    });

    it('adds people from comma-separated input and enables continue', () => {
      render(<ReceiptSplitterPage />);
      addPeople('Alice, Bob');
      expect(screen.getByTestId('people-list')).toBeInTheDocument();
      expect(screen.queryByTestId('people-empty-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled();
    });

    it('ignores duplicate names case-insensitively', () => {
      render(<ReceiptSplitterPage />);
      addPeople('Alice, Bob');
      addPeople('alice, Carol');
      const chips = screen.getByTestId('people-list').querySelectorAll('button');
      expect(chips).toHaveLength(3);
    });

    it('removes a person when their chip is clicked', () => {
      render(<ReceiptSplitterPage />);
      addPeople('Alice, Bob');
      expect(screen.getByTestId('people-list').querySelectorAll('button')).toHaveLength(2);
      fireEvent.click(screen.getByTestId('people-list').querySelectorAll('button')[0]);
      expect(screen.getByTestId('people-list').querySelectorAll('button')).toHaveLength(1);
    });

    it('removing all people shows the empty state and disables continue', () => {
      render(<ReceiptSplitterPage />);
      addPeople('Alice');
      expect(screen.queryByTestId('people-empty-state')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('people-list').querySelector('button')!);
      expect(screen.getByTestId('people-empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
    });

    it('clears the input field after adding people', () => {
      render(<ReceiptSplitterPage />);
      addPeople('Alice');
      expect(screen.getByTestId('people-input')).toHaveValue('');
    });
  });

  describe('Navigation', () => {
    it('progresses through all 4 steps with valid seeded data', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 1/i);
      clickContinue();
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);
      clickContinue();
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 3/i);
      clickContinue(); // Alice → Bob
      clickContinue(); // Bob → final
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 4/i);
    });

    it('keeps the credit footer below the wizard nav so it closes the page', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      const workspace = screen.getByTestId('workspace');
      const nav = screen.getByTestId('wizard-continue-btn').closest('footer');
      const credit = screen.getByRole('link', { name: 'Source on GitHub' }).closest('footer');

      expect(workspace.lastElementChild).toBe(credit);
      expect(nav?.nextElementSibling).toBe(credit);
    });

    it('supports back navigation through all steps', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → claim, Alice
      clickContinue(); // → Bob
      clickContinue(); // → final

      clickBack(); // final → claim, still on Bob
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Bob have?');

      clickBack(); // Bob → Alice
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Alice have?');

      clickBack(); // claim → receipt
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);

      clickBack(); // receipt → people
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 1/i);
      expect(screen.queryByTestId('wizard-back-btn')).not.toBeInTheDocument();
    });

    it('slides each step in from the side it was reached from', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      const panelDirection = () =>
        screen.getByTestId('wizard-step-panel').getAttribute('data-direction');

      expect(panelDirection()).toBe('none');
      clickContinue(); // → receipt
      expect(panelDirection()).toBe('forward');
      clickBack(); // → people
      expect(panelDirection()).toBe('back');
    });

    it('jumps from summary directly back to people through the top nav', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue();
      clickContinue();
      expectActiveStepNav('final');

      clickStepNav('people');

      expectActiveStepNav('people');
      expect(screen.getByTestId('people-list')).toBeInTheDocument();
    });

    it('jumps from summary directly back to receipt through the top nav', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue();
      clickContinue();
      expectActiveStepNav('final');

      clickStepNav('receipt');

      expectActiveStepNav('receipt');
      expect(screen.getByTestId('receipt-add-item-btn')).toBeInTheDocument();
    });

    it('jumps from receipt directly to assign when receipt data is valid', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      expectActiveStepNav('receipt');

      clickStepNav('items');

      expectActiveStepNav('items');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Alice have?');
    });

    it('jumps from receipt directly to summary when assignments are complete', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      expectActiveStepNav('receipt');

      clickStepNav('final');

      expectActiveStepNav('final');
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();
    });

    it('disables top-nav jumps until each step prerequisite is met', () => {
      render(<ReceiptSplitterPage />);

      expect(screen.getByTestId('wizard-step-nav-receipt')).toBeDisabled();
      expect(screen.getByTestId('wizard-step-nav-items')).toBeDisabled();
      expect(screen.getByTestId('wizard-step-nav-final')).toBeDisabled();

      addPeople('Alice, Bob');

      expect(screen.getByTestId('wizard-step-nav-receipt')).not.toBeDisabled();
      expect(screen.getByTestId('wizard-step-nav-items')).toBeDisabled();
      expect(screen.getByTestId('wizard-step-nav-final')).toBeDisabled();

      clickStepNav('receipt');

      expectActiveStepNav('receipt');
      expect(screen.getByTestId('wizard-step-nav-items')).toBeDisabled();
      expect(screen.getByTestId('wizard-step-nav-final')).toBeDisabled();
    });

    it('blocks continue on receipt step until valid items exist', async () => {
      seedV2Draft({
        receipts: [{ ...makeReceipt({ id: 'r1' }), items: [] }],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();

      act(() =>
        useReceiptStore.getState().patchReceipt('r1', {
          items: [
            {
              id: 'r1-i1',
              name: 'Chicken Rice',
              amountInput: '8.50',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: [] },
            },
          ],
        }),
      );
      expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled();
    });

    it('keeps the summary out of reach while an item is unclaimed', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → claim, Alice
      expect(screen.getByTestId('wizard-step-nav-final')).not.toBeDisabled();
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1')); // Alice
      fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1')); // Bob
      expect(screen.getByTestId('wizard-step-nav-final')).toBeDisabled();
    });
  });

  describe('Even split', () => {
    it('starts everyone on every item, then opens Items so exceptions can be unticked', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'r1-i1',
                name: 'Dinner',
                amountInput: '90.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: [] },
              },
            ],
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → items
      fireEvent.click(screen.getByRole('button', { name: 'Share equally' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

      expectActiveStepNav('items');
      expect(useReceiptStore.getState().receipts[0].items[0].assignment.personIds).toEqual([
        'p1',
        'p2',
      ]);
    });

    it('shares only the active untouched receipt and preserves claims on other receipts', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'r1-i1',
                name: 'Tea',
                amountInput: '12',
                discountPercentInput: '',
                assignment: {
                  mode: 'equal',
                  personId: '',
                  personIds: ['p1', 'p2'],
                  weights: { p1: 2, p2: 1 },
                },
              },
            ],
          }),
          makeReceipt({
            id: 'r2',
            items: [
              {
                id: 'r2-i1',
                name: 'Dinner',
                amountInput: '90',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: [] },
              },
            ],
          }),
        ],
        activeReceiptId: 'r2',
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      clickContinue();

      fireEvent.click(
        within(screen.getByTestId('claim-section-r2')).getByRole('button', {
          name: 'Share equally',
        }),
      );

      expectActiveStepNav('items');
      expect(useReceiptStore.getState().receipts[0].items[0].assignment).toEqual({
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
        weights: { p1: 2, p2: 1 },
      });
      expect(useReceiptStore.getState().receipts[1].items[0].assignment).toEqual({
        mode: 'equal',
        personId: '',
        personIds: ['p1', 'p2'],
      });
    });

    it('confirms replacement, preserves selections on cancel, and disables after sharing', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.queryByRole('button', { name: 'Share equally' })).not.toBeInTheDocument();
      clickContinue();
      expect(screen.getByRole('button', { name: 'Share equally' })).toBeDisabled();
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1'));
      const original = useReceiptStore.getState().receipts;
      fireEvent.click(screen.getByRole('button', { name: 'Share equally' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );
      expect(useReceiptStore.getState().receipts).toEqual(original);
      fireEvent.click(screen.getByRole('button', { name: 'Share equally' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Share equally' }),
      );
      expect(screen.getByRole('button', { name: 'Share equally' })).toBeDisabled();
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1'));
      expect(screen.getByRole('button', { name: 'Share equally' })).toBeEnabled();
      vi.restoreAllMocks();
    });
  });

  describe('Receipt step', () => {
    it('shows empty state when all items are removed', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      expect(screen.queryByTestId('receipt-empty-state')).not.toBeInTheDocument();

      // Remove all items via the store to trigger empty state
      useReceiptStore.setState((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, items: [] } : r,
        ),
      }));
      await waitFor(() => expect(screen.getByTestId('receipt-empty-state')).toBeInTheDocument());
    });

    it('adds an item to the store when the empty state add button is clicked', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();

      // Clear items to trigger empty state
      useReceiptStore.setState((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, items: [] } : r,
        ),
      }));
      await waitFor(() => expect(screen.getByTestId('receipt-empty-state')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('receipt-add-item-btn'));
      expect(useReceiptStore.getState().receipts[0].items.length).toBe(1);
    });
  });

  describe('Claim step', () => {
    async function navigateToClaim(receipts?: object[]) {
      seedV2Draft(receipts ? { receipts } : {});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue(); // → receipt
      clickContinue(); // → claim
    }

    const unclaimedItem = {
      id: 'r1-i2',
      name: 'Teh Peng',
      amountInput: '2.00',
      discountPercentInput: '',
      assignment: { mode: 'equal', personId: '', personIds: [] },
    };

    it('shows completion inside the bottom status then restores the owes label', async () => {
      await navigateToClaim([makeReceipt({ id: 'r1', items: [unclaimedItem] })]);
      vi.useFakeTimers();
      try {
        fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i2'));
        const message = screen.getByTestId('claim-all-assigned');
        expect(screen.getByTestId('wizard-status')).toContainElement(message);
        expect(screen.getByTestId('claim-owes-panel')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('All assigned');
        expect(screen.getByTestId('wizard-step-panel')).not.toContainElement(message);
        expect(screen.getByTestId('wizard-status')).toHaveTextContent('$2.00');
        act(() => vi.advanceTimersByTime(1600));
        expect(screen.queryByTestId('claim-all-assigned')).not.toBeInTheDocument();
        expect(screen.getByTestId('wizard-status')).toHaveTextContent('Alice owes$2.00');
        expect(screen.getByTestId('claim-owes-panel')).toHaveAttribute('aria-hidden', 'false');
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns from completion to the currently selected person and amount', async () => {
      await navigateToClaim([makeReceipt({ id: 'r1', items: [unclaimedItem] })]);
      vi.useFakeTimers();
      try {
        fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i2'));
        fireEvent.click(screen.getAllByTestId('claim-person-p2')[0]);
        expect(screen.getByRole('status')).toHaveTextContent('All assigned');
        act(() => vi.advanceTimersByTime(1600));
        expect(screen.queryByTestId('claim-all-assigned')).not.toBeInTheDocument();
        expect(screen.getByTestId('wizard-status')).toHaveTextContent('Bob owes$0.00');
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears completion immediately if an item becomes unassigned again', async () => {
      await navigateToClaim([makeReceipt({ id: 'r1', items: [unclaimedItem] })]);
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i2'));
      expect(screen.getByTestId('wizard-status')).toContainElement(
        screen.getByTestId('claim-all-assigned'),
      );
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i2'));
      expect(screen.queryByTestId('claim-all-assigned')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-status')).toHaveTextContent('Alice owes$0.00');
    });

    it('starts with the first person and shows who owes what in the bottom bar', async () => {
      await navigateToClaim();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Alice have?');
      expect(screen.getByTestId('wizard-status')).toHaveTextContent('Alice owes$5.00');
      expect(screen.getByTestId('wizard-continue-btn')).toHaveTextContent('Next: Bob');
      expect(screen.getByTestId('claim-item-toggle-r1-i1')).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles the active person off an item and updates their total', async () => {
      await navigateToClaim();

      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1'));

      expect(screen.getByTestId('claim-item-toggle-r1-i1')).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.getByTestId('claim-item-claimants-r1-i1')).toHaveAccessibleName('Bob');
      expect(screen.getByTestId('wizard-status')).toHaveTextContent('Alice owes$0.00');
    });

    it('moves to the next person and shows See summary on the last one when all is claimed', async () => {
      await navigateToClaim();

      clickContinue();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Bob have?');
      expect(screen.getByTestId('wizard-continue-btn')).toHaveTextContent('See summary');
      clickContinue();
      expect(screen.getByTestId('export-save-image-btn')).toBeInTheDocument();
    });

    it('splits what is left evenly from the last person, then shows the summary', async () => {
      await navigateToClaim([
        makeReceipt({
          id: 'r1',
          items: [
            {
              id: 'r1-i1',
              name: 'Chicken Rice',
              amountInput: '10.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
            },
            unclaimedItem,
          ],
        }),
      ]);

      clickContinue(); // → Bob
      expect(screen.getByTestId('wizard-continue-btn')).toHaveTextContent('Split 1 left evenly');
      clickContinue();

      expect(screen.getByTestId('export-save-image-btn')).toBeInTheDocument();
      const items = useReceiptStore.getState().receipts[0].items;
      expect(items[1].assignment.personIds).toEqual(['p1', 'p2']);
      expect(items[0].assignment.personIds).toEqual(['p1']);
    });

    it('shows the full receipt total on the receipt step before anything is claimed', async () => {
      seedV2Draft({ receipts: [makeReceipt({ id: 'r1', items: [unclaimedItem] })] });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt

      expect(screen.getByTestId('wizard-status')).toHaveTextContent('Receipt total$2.00');
    });

    it('leaves the other half of an item for the next person and splits it from the last', async () => {
      await navigateToClaim([
        makeReceipt({
          id: 'r1',
          items: [
            {
              id: 'r1-i1',
              name: 'Garlic bread',
              amountInput: '6.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
            },
          ],
        }),
      ]);

      fireEvent.click(screen.getByTestId('claim-item-amount-r1-i1'));
      const input = screen.getByTestId('claim-item-amount-r1-i1-input');
      fireEvent.change(input, { target: { value: '50%' } });
      fireEvent.blur(input);
      expect(screen.getByTestId('wizard-status')).toHaveTextContent('Alice owes$3.00');
      expect(screen.getByTestId('claim-left-filter')).toHaveTextContent('1 item left');

      clickContinue(); // → Bob
      expect(screen.getByTestId('claim-item-claimants-r1-i1')).toHaveAccessibleName(
        'Alice, 1/2 left',
      );
      expect(screen.getByTestId('wizard-continue-btn')).toHaveTextContent('Split 1 left evenly');
      clickContinue();

      expect(screen.getByTestId('export-save-image-btn')).toBeInTheDocument();
      const [item] = useReceiptStore.getState().receipts[0].items;
      expect(item.assignment.unassignedWeight).toBeUndefined();
      expect(item.assignment.weights).toEqual({ p1: 3, p2: 1 });
    });

    it('shows every receipt on one page and counts what is left across them', async () => {
      await navigateToClaim([
        makeReceipt({ id: 'r1' }),
        makeReceipt({ id: 'r2', items: [{ ...unclaimedItem, id: 'r2-i1' }] }),
      ]);

      expect(screen.getByTestId('claim-left-filter')).toHaveTextContent('1 item left');
      expect(screen.getByTestId('claim-item-r1-i1')).toBeInTheDocument();
      expect(screen.getByTestId('claim-item-r2-i1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('claim-item-toggle-r2-i1'));

      const [, r2] = useReceiptStore.getState().receipts;
      expect(r2.items[0].assignment.personIds).toEqual(['p1']);
      expect(screen.queryByTestId('claim-left-filter')).not.toBeInTheDocument();
    });
  });

  describe('Summary step', () => {
    async function navigateToFinal() {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue(); // → receipt
      clickContinue(); // → claim, Alice
      clickContinue(); // → Bob
      clickContinue(); // → final
    }

    it('shows export buttons on the final step', async () => {
      await navigateToFinal();
      expect(screen.getByTestId('export-save-image-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-copy-text-btn')).toBeInTheDocument();
    });

    it('does not show a continue button on the final step', async () => {
      await navigateToFinal();
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();
    });

    it('triggers image generation when save image is clicked', async () => {
      await navigateToFinal();
      fireEvent.click(screen.getByTestId('export-save-image-btn'));
      await waitFor(() => expect(generateReceiptSplitImageLightMock).toHaveBeenCalledTimes(1));
    });

    it('triggers clipboard write when copy text is clicked', async () => {
      await navigateToFinal();
      fireEvent.click(screen.getByTestId('export-copy-text-btn'));
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    });

    it('does not show receipt tabs with a single receipt', async () => {
      await navigateToFinal();
      expect(screen.queryByTestId('summary-tab-total')).not.toBeInTheDocument();
    });

    it('shows receipt tabs when multiple receipts exist', async () => {
      seedV2Draft({
        receipts: [makeReceipt({ id: 'r1' }), makeReceipt({ id: 'r2' })],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      clickContinue();
      clickContinue();
      clickContinue();
      expect(screen.getByTestId('summary-tab-total')).toBeInTheDocument();
      expect(screen.getByTestId('summary-tab-receipt-0')).toBeInTheDocument();
      expect(screen.getByTestId('summary-tab-receipt-1')).toBeInTheDocument();
    });

    it('navigates back to receipt step when add new receipt is clicked', async () => {
      await navigateToFinal();
      fireEvent.click(screen.getByTestId('summary-add-receipt-btn'));
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);
    });
  });

  describe('Reconciliation', () => {
    it('shows the apply discount button when computed total exceeds the receipt total', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'i1',
                name: 'Pizza',
                amountInput: '10.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
              },
            ],
            receiptTotalInput: '8.00',
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.getByTestId('apply-discount-reconcile-btn')).toBeInTheDocument();
    });

    it('does not show the button when totals match', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'i1',
                name: 'Pizza',
                amountInput: '10.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
              },
            ],
            receiptTotalInput: '10.00',
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument();
    });

    it('does not show the button when no receipt total is set', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'i1',
                name: 'Pizza',
                amountInput: '10.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
              },
            ],
            receiptTotalInput: '',
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument();
    });

    it('applying the discount resolves the discrepancy and hides the button', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'i1',
                name: 'Pizza',
                amountInput: '10.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
              },
            ],
            receiptTotalInput: '8.00',
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      fireEvent.click(screen.getByTestId('apply-discount-reconcile-btn'));
      expect(screen.queryByTestId('apply-discount-reconcile-btn')).not.toBeInTheDocument();
    });
  });

  describe('GeminiApiKeyModal', () => {
    beforeEach(() => {
      useGeminiStore.setState({ geminiApiKeyInput: '' });
    });

    it('shows the modal when navigating from people to receipt without an API key', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });

    it('skip closes the modal without saving a key', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
      expect(useGeminiStore.getState().geminiApiKeyInput).toBe('');
    });

    it('saving a key closes the modal and persists the value in the store', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'my-gemini-key' } });
      fireEvent.click(screen.getByRole('button', { name: /Save/i }));
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
      expect(useGeminiStore.getState().geminiApiKeyInput).toBe('my-gemini-key');
    });

    it('shows the current Gemini model and saves model selection changes', async () => {
      useGeminiStore.setState({ geminiApiKeyInput: '', geminiModel: GEMINI_MODELS[1] });
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();

      expect(screen.getByLabelText(/Model/i)).toHaveValue(GEMINI_MODELS[1]);

      fireEvent.change(screen.getByLabelText(/Model/i), { target: { value: GEMINI_MODELS[3] } });
      fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'my-gemini-key' } });
      fireEvent.click(screen.getByRole('button', { name: /Save/i }));

      expect(useGeminiStore.getState().geminiModel).toBe(GEMINI_MODELS[3]);
      expect(window.localStorage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY)).toContain(
        GEMINI_MODELS[3],
      );
    });

    it('does not show the modal when an API key is already set', async () => {
      useGeminiStore.setState({ geminiApiKeyInput: 'existing-key' });
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.queryByLabelText('API Key')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('falls back to people step and blocks continue when all people are removed', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → claim, Alice
      clickContinue(); // → Bob
      clickContinue(); // → final

      clickBack(); // → claim, Bob
      clickBack(); // → Alice
      clickBack(); // → receipt
      clickBack(); // → people

      fireEvent.click(screen.getByTestId('person-chip-p1'));
      fireEvent.click(screen.getByTestId('person-chip-p2'));

      expect(screen.getByTestId('people-empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
    });

    it('falls back from final to the claim step when assignments become incomplete', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue();
      clickContinue();
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();

      act(() =>
        useReceiptStore.getState().updateItem('r1-i1', (item) => ({
          ...item,
          assignment: { ...item.assignment, personIds: [] },
        })),
      );

      await waitFor(() => {
        expect(screen.queryByTestId('export-save-image-btn')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('claim-left-filter')).toHaveTextContent('1 item left');
    });
  });

  describe('Header menu', () => {
    it('loads a test split on an empty workspace straight into Items', () => {
      render(<ReceiptSplitterPage />);

      fireEvent.keyDown(screen.getByTestId('workspace-menu-btn'), { key: 'Enter' });
      fireEvent.click(screen.getByTestId('workspace-preset-dinner-for-twelve'));

      expectActiveStepNav('items');
      expect(useReceiptStore.getState().people).toHaveLength(12);
      expect(screen.getByTestId('wizard-step-nav-final')).not.toBeDisabled();
    });

    it('exports the workspace as a dated JSON file', () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);

      fireEvent.keyDown(screen.getByTestId('workspace-menu-btn'), { key: 'Enter' });
      fireEvent.click(screen.getByTestId('workspace-export-btn'));

      const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
      expect(blob.type).toBe('application/json');
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Persistence', () => {
    it('does not overwrite localStorage with empty state during StrictMode double-invocation', async () => {
      seedV2Draft({});
      render(
        <StrictMode>
          <ReceiptSplitterPage />
        </StrictMode>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('people-list')).toBeInTheDocument();
      });

      const saved = window.localStorage.getItem('split:receipt-draft:v1');
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.people).toHaveLength(2);
    });

    it('restores the wizard step after unmount and remount', async () => {
      seedV2Draft({});
      const { unmount } = render(<ReceiptSplitterPage />);

      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue(); // → receipt
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);

      await waitFor(() => {
        const saved = window.localStorage.getItem('split:simple-wizard-state:v1');
        expect(saved).toContain('receipt');
      });

      unmount();
      render(<ReceiptSplitterPage />);

      await waitFor(() => {
        expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);
      });
    });

    it('restores item assignments after unmount and remount', async () => {
      seedV2Draft({});
      const { unmount } = render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → claim, Alice
      clickContinue(); // → Bob
      fireEvent.click(screen.getByTestId('claim-item-toggle-r1-i1'));
      expect(screen.getByTestId('claim-item-toggle-r1-i1')).toHaveAttribute(
        'aria-pressed',
        'false',
      );

      // Wait for both draft and wizard state to persist before unmounting
      await waitFor(() => {
        const draft = window.localStorage.getItem('split:receipt-draft:v1');
        const wizard = window.localStorage.getItem('split:simple-wizard-state:v1');
        expect(draft).toContain('"personIds":["p1"]');
        expect(wizard).toContain('items');
      });

      unmount();
      render(<ReceiptSplitterPage />);

      // Restores to Bob on the claim step from localStorage — no navigation needed
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What did Bob have?');
        expect(screen.getByTestId('claim-item-claimants-r1-i1')).toHaveAccessibleName('Alice');
      });
    });
  });
});

it('completes a person removal when navigating away before the exit finishes', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  try {
    render(<ReceiptSplitterPage />);
    addPeople('Alice, Bob');
    const alice = useReceiptStore.getState().people.find((person) => person.name === 'Alice');
    if (!alice) throw new Error('Alice was not added');
    fireEvent.click(screen.getByTestId(`person-chip-${alice.id}`));
    clickContinue();
    clickBack();
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual(['Bob']);
  } finally {
    vi.unstubAllGlobals();
  }
});
