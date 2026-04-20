import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useReceiptStore } from '@features/workspace/stores/receiptStore';
import { useGeminiStore } from '@features/workspace/stores/geminiStore';

const { generateReceiptSplitImageLightMock } = vi.hoisted(() => ({
  generateReceiptSplitImageLightMock: vi.fn(),
}));

vi.mock('../features/split-results/logic/receiptSplitImageLight', () => ({
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
      clickContinue(); // assign → review
      clickContinue(); // review → final
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 4/i);
    });

    it('supports back navigation through all steps', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → items/assign
      clickContinue(); // → items/review
      clickContinue(); // → final

      clickBack(); // final → items/review
      expect(screen.getByTestId('wizard-edit-btn')).toBeInTheDocument();

      clickBack(); // items/review → items/assign
      expect(screen.getByTestId('assign-item-counter')).toBeInTheDocument();

      clickBack(); // items/assign → receipt
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 2/i);

      clickBack(); // receipt → people
      expect(screen.getByTestId('wizard-step-context')).toHaveTextContent(/Step 1/i);
      expect(screen.queryByTestId('wizard-back-btn')).not.toBeInTheDocument();
    });

    it('blocks continue on receipt step until valid items exist', async () => {
      seedV2Draft({
        receipts: [{ ...makeReceipt({ id: 'r1' }), items: [] }],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();

      fireEvent.click(screen.getByTestId('load-mock-receipt-btn-0'));
      expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled();
    });

    it('blocks continue on review sub-phase when items are unassigned', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → items/assign
      fireEvent.click(screen.getByTestId('assign-select-none-btn'));
      clickContinue(); // → items/review
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
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

    it('loads a mock receipt and populates items, hiding the empty state', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();

      // Clear items to trigger empty state, then load mock to hide it
      useReceiptStore.setState((state) => ({
        receipts: state.receipts.map((r) =>
          r.id === state.activeReceiptId ? { ...r, items: [] } : r,
        ),
      }));
      await waitFor(() => expect(screen.getByTestId('receipt-empty-state')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('load-mock-receipt-btn-0'));
      expect(screen.queryByTestId('receipt-empty-state')).not.toBeInTheDocument();
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

  describe('Assign step', () => {
    it('shows item counter and person toggle buttons with aria-pressed', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → items/assign
      expect(screen.getByTestId('assign-item-counter')).toBeInTheDocument();
      expect(screen.getByTestId('assign-person-btn-p1')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggles a person assignment on/off', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();

      const bobBtn = screen.getByTestId('assign-person-btn-p2');
      expect(bobBtn).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(bobBtn);
      expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'false');
    });

    it('select none deselects all, select all reselects all', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();

      fireEvent.click(screen.getByTestId('assign-select-none-btn'));
      expect(screen.getByTestId('assign-person-btn-p1')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(screen.getByTestId('assign-select-all-btn'));
      expect(screen.getByTestId('assign-person-btn-p1')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'true');
    });

    it('navigates between items with prev/next arrow buttons', async () => {
      seedV2Draft({
        receipts: [
          makeReceipt({
            id: 'r1',
            items: [
              {
                id: 'i1',
                name: 'Item A',
                amountInput: '5.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
              },
              {
                id: 'i2',
                name: 'Item B',
                amountInput: '8.00',
                discountPercentInput: '',
                assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p2'] },
              },
            ],
          }),
        ],
      });
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();

      expect(screen.getByTestId('assign-item-counter')).toHaveTextContent(/Item 1 of 2/i);
      fireEvent.click(screen.getByTestId('assign-next-item-btn'));
      expect(screen.getByTestId('assign-item-counter')).toHaveTextContent(/Item 2 of 2/i);
      fireEvent.click(screen.getByTestId('assign-prev-item-btn'));
      expect(screen.getByTestId('assign-item-counter')).toHaveTextContent(/Item 1 of 2/i);
    });

    it('transitions to review sub-phase on continue from assign', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue(); // assign → review
      expect(screen.getByTestId('wizard-edit-btn')).toBeInTheDocument();
    });

    it('clicking edit in review returns to assign phase', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue(); // → review
      fireEvent.click(screen.getByTestId('wizard-edit-btn'));
      expect(screen.getByTestId('assign-item-counter')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-edit-btn')).not.toBeInTheDocument();
    });
  });

  describe('Summary step', () => {
    async function navigateToFinal() {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue(); // → receipt
      clickContinue(); // → items/assign
      clickContinue(); // → items/review
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
      expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
    });

    it('skip closes the modal without saving a key', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
      expect(useGeminiStore.getState().geminiApiKeyInput).toBe('');
    });

    it('saving a key closes the modal and persists the value in the store', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'my-gemini-key' } });
      fireEvent.click(screen.getByRole('button', { name: /Save/i }));
      expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
      expect(useGeminiStore.getState().geminiApiKeyInput).toBe('my-gemini-key');
    });

    it('does not show the modal when an API key is already set', async () => {
      useGeminiStore.setState({ geminiApiKeyInput: 'existing-key' });
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());
      clickContinue();
      expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('falls back to people step and blocks continue when all people are removed', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue(); // → receipt
      clickContinue(); // → items/assign
      clickContinue(); // → items/review
      clickContinue(); // → final

      clickBack(); // → items/review
      clickBack(); // → items/assign
      clickBack(); // → receipt
      clickBack(); // → people

      fireEvent.click(screen.getByTestId('person-chip-p1'));
      fireEvent.click(screen.getByTestId('person-chip-p2'));

      expect(screen.getByTestId('people-empty-state')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-continue-btn')).toBeDisabled();
    });

    it('falls back from final to assign step when assignments become incomplete', async () => {
      seedV2Draft({});
      render(<ReceiptSplitterPage />);
      await waitFor(() => expect(screen.getByTestId('wizard-continue-btn')).not.toBeDisabled());

      clickContinue();
      clickContinue();
      clickContinue();
      clickContinue();
      expect(screen.queryByTestId('wizard-continue-btn')).not.toBeInTheDocument();

      clickBack(); // → items/review
      fireEvent.click(screen.getByTestId('wizard-edit-btn'));
      fireEvent.click(screen.getByTestId('assign-select-none-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('export-save-image-btn')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('assign-item-counter')).toBeInTheDocument();
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
      clickContinue(); // → items/assign
      fireEvent.click(screen.getByTestId('assign-person-btn-p2'));
      expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'false');

      // Wait for both draft and wizard state to persist before unmounting
      await waitFor(() => {
        const draft = window.localStorage.getItem('split:receipt-draft:v1');
        const wizard = window.localStorage.getItem('split:simple-wizard-state:v1');
        expect(draft).toContain('"personIds":["p1"]');
        expect(wizard).toContain('items');
      });

      unmount();
      render(<ReceiptSplitterPage />);

      // Wizard restores to items/assign from localStorage — no navigation needed
      await waitFor(() => {
        expect(screen.getByTestId('assign-person-btn-p1')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('assign-person-btn-p2')).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
