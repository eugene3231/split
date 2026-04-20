import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptStep } from './ReceiptStep';
type ReceiptStepProps = React.ComponentProps<typeof ReceiptStep>;

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

vi.mock('@features/workspace/stores/receiptStore', () => ({
  useReceiptStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setReceiptCurrency: vi.fn(),
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

function makeProps(overrides: Partial<ReceiptStepProps> = {}): ReceiptStepProps {
  return {
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
      },
    ],
    activeReceiptId: 'r1',
    onSelectReceipt: vi.fn(),
    onAddReceipt: vi.fn(),
    onRemoveReceipt: vi.fn(),
    onRenameReceipt: vi.fn(),
    items: [],
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
    discount: disabledChargeState,
    serviceCharge: disabledChargeState,
    gst: disabledChargeState,
    reconciliationCents: null,
    receiptTotalInput: '',
    onApplyDiscount: vi.fn(),
    onReceiptFileSelected: vi.fn(),
    onScanReceipt: vi.fn(),
    mockReceipts: [],
    onDiscountChange: vi.fn(),
    onServiceChargeChange: vi.fn(),
    onGstChange: vi.fn(),
    onReceiptTotalInputChange: vi.fn(),
    onAddItem: vi.fn(),
    onRemoveItem: vi.fn(),
    onUpdateItem: vi.fn(),
    ...overrides,
  };
}

describe('ReceiptStep', () => {
  it('renders the receipt step with key components', () => {
    const props = makeProps();
    render(<ReceiptStep {...props} />);

    expect(screen.getByTestId('receipt-import-actions')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('global-charges-panel')).toBeInTheDocument();
  });

  it('renders the receipt_long icon in the card when no file is uploaded', () => {
    const props = makeProps();
    render(<ReceiptStep {...props} />);

    const icons = screen
      .getAllByText('receipt_long')
      .filter((el) => el.classList.contains('material-symbols-outlined'));
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('passes onReceiptFileSelected to ReceiptImportActions', () => {
    const onReceiptFileSelected = vi.fn();
    const props = makeProps({ onReceiptFileSelected });
    render(<ReceiptStep {...props} />);

    expect(screen.getByTestId('receipt-import-actions')).toBeInTheDocument();
  });
});
