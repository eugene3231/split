import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptStep } from './ReceiptStep';

vi.mock('@features/workspace/components/shared/ReceiptImportActions', () => ({
  ReceiptImportActions: () => <div data-testid="receipt-import-actions" />,
}));

vi.mock('@features/workspace/components/shared/LineItemCard', () => ({
  LineItemCard: () => <div data-testid="line-item-card" />,
}));

vi.mock('@features/workspace/components/shared/GlobalChargesPanel', () => ({
  GlobalChargesPanel: () => <div data-testid="global-charges-panel" />,
}));

vi.mock('@features/workspace/components/shared/ReceiptTabs', () => ({
  ReceiptTabs: () => <div data-testid="receipt-tabs" />,
}));

vi.mock('@features/workspace/components/shared/ReceiptNameField', () => ({
  ReceiptNameField: () => <div data-testid="receipt-name-field" />,
}));

vi.mock('@features/workspace/components/shared/CurrencySelector', () => ({
  CurrencySelector: () => <div data-testid="currency-selector" />,
}));

vi.mock('@features/workspace/components/shared/ExchangeRateDisplay', () => ({
  ExchangeRateDisplay: () => <div data-testid="exchange-rate-display" />,
}));

vi.mock('@features/workspace/hooks/useReceiptSplit', () => ({
  useReceiptSplit: () => ({
    split: {
      lineItemsByPerson: {},
      involvedCountByPerson: {},
      subtotalByPersonCents: {},
      discountByPersonCents: {},
      serviceByPersonCents: {},
      gstByPersonCents: {},
      totalByPersonCents: {},
      subtotalCents: 0,
      discountCents: 0,
      serviceChargeCents: 0,
      gstCents: 0,
      grandTotalCents: 0,
      unassignedItemCount: 0,
    },
    consolidatedSplit: null,
    splitByReceipt: [],
    reconciliationCents: null,
    handleApplyReconciliationDiscount: vi.fn(),
  }),
}));

vi.mock('@features/workspace/stores/geminiStore', () => ({
  useGeminiStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      geminiApiKeyInput: 'test-key',
      geminiModel: 'gemini-2.5-flash',
    }),
  ),
}));

const disabledChargeState = {
  enabled: false,
  mode: 'amount' as const,
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

vi.mock('@features/workspace/stores/receiptStore', () => ({
  useReceiptStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      people: [{ id: 'p1', name: 'Alice' }],
      receipts: [
        {
          id: 'r1',
          name: 'Receipt 1',
          items: [],
          discount: disabledChargeState,
          serviceCharge: disabledChargeState,
          gst: disabledChargeState,
          receiptTotalInput: '',
          currency: 'SGD',
          exchangeRateOverride: null,
          receiptFile: null,
        },
      ],
      activeReceiptId: 'r1',
      handleReceiptFileSelected: vi.fn(),
      patchReceipt: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      updateItem: vi.fn(),
      setDiscount: vi.fn(),
      setServiceCharge: vi.fn(),
      setGst: vi.fn(),
      setReceiptTotalInput: vi.fn(),
      setActiveReceiptId: vi.fn(),
      removeReceipt: vi.fn(),
      renameReceipt: vi.fn(),
      setReceiptCurrency: vi.fn(),
    }),
  ),
}));

describe('ReceiptStep', () => {
  it('renders the receipt step with key components', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);

    expect(screen.getByTestId('receipt-import-actions')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('global-charges-panel')).toBeInTheDocument();
  });

  it('renders the receipt_long icon in the card when no file is uploaded', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);

    const icons = screen
      .getAllByText('receipt_long')
      .filter((el) => el.classList.contains('material-symbols-outlined'));
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });
});
