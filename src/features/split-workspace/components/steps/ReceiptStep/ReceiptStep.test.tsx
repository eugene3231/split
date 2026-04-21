import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptStep } from './ReceiptStep';

vi.mock('./ReceiptImportActions', () => ({
  ReceiptImportActions: () => <div data-testid="receipt-import-actions" />,
}));

vi.mock('@features/split-workspace/components/shared/LineItemCard', () => ({
  LineItemCard: () => <div data-testid="line-item-card" />,
}));

vi.mock('@features/split-workspace/components/shared/GlobalChargesPanel', () => ({
  GlobalChargesPanel: () => <div data-testid="global-charges-panel" />,
}));

vi.mock('@features/split-workspace/components/shared/ReceiptTabs', () => ({
  ReceiptTabs: () => <div data-testid="receipt-tabs" />,
}));

vi.mock('@features/split-workspace/components/shared/ReceiptNameField', () => ({
  ReceiptNameField: () => <div data-testid="receipt-name-field" />,
}));

vi.mock('@features/split-workspace/components/shared/CurrencySelector', () => ({
  CurrencySelector: () => <div data-testid="currency-selector" />,
}));

vi.mock('@features/split-workspace/components/shared/ExchangeRateDisplay', () => ({
  ExchangeRateDisplay: () => <div data-testid="exchange-rate-display" />,
}));

const disabledChargeState = {
  enabled: false,
  mode: 'amount' as const,
  amountInput: '',
  percentInput: '',
  detectedConfidence: null,
  detectedSource: null,
};

vi.mock('./useReceiptImport', () => ({
  useReceiptImport: () => ({
    handleReceiptFileChange: vi.fn(),
    handleScanReceipt: vi.fn(),
    mockReceipts: [],
  }),
}));

vi.mock('./useReceiptStepModel', () => ({
  useReceiptStepModel: () => ({
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
    activeReceipt: {
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
    items: [],
    discount: disabledChargeState,
    serviceCharge: disabledChargeState,
    gst: disabledChargeState,
    receiptTotalInput: '',
    activeCurrency: 'SGD',
    hasItems: false,
    activeSplit: {
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
    reconciliation: {
      cents: null,
      applyCorrectiveDiscount: vi.fn(),
    },
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
