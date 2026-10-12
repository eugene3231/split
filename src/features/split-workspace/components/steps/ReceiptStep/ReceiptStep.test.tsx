import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeItem,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
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

vi.mock('@features/split-workspace/components/shared/ReceiptNameField', () => ({
  ReceiptNameField: () => <div data-testid="receipt-name-field" />,
}));

vi.mock('@features/split-workspace/components/shared/CurrencySelector', () => ({
  CurrencySelector: () => <div data-testid="currency-selector" />,
}));

vi.mock('@features/split-workspace/components/shared/ExchangeRateDisplay', () => ({
  ExchangeRateDisplay: () => <div data-testid="exchange-rate-display" />,
}));

vi.mock('./useReceiptImport', () => ({
  useReceiptImport: () => ({
    handleReceiptFileChange: vi.fn(),
    handleScanReceipt: vi.fn(),
  }),
}));

beforeEach(() => {
  resetAllStores();
  seedStore([], [makeReceipt({ id: 'r1' })]);
});

describe('ReceiptStep', () => {
  it('renders the receipt step with key components', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);

    expect(screen.getByTestId('receipt-import-actions')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Receipts' })).toBeInTheDocument();
    expect(screen.getByTestId('global-charges-panel')).toBeInTheDocument();
  });

  it('renders one page heading for every screen size', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('adds a first item to a receipt that has none', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);
    expect(screen.getByTestId('receipt-empty-state')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('receipt-add-item-btn'));

    expect(useReceiptStore.getState().receipts[0].items).toHaveLength(1);
    expect(screen.getAllByTestId('line-item-card')).toHaveLength(1);
  });

  it('shows the receipt on the selected tab, and its items', () => {
    seedStore(
      [],
      [
        makeReceipt({ id: 'r1', name: 'Lunch', items: [makeItem({ id: 'a' })] }),
        makeReceipt({
          id: 'r2',
          name: 'Dinner',
          items: [makeItem({ id: 'b' }), makeItem({ id: 'c' })],
        }),
      ],
    );
    render(<ReceiptStep onAddReceipt={vi.fn()} />);
    expect(screen.getAllByTestId('line-item-card')).toHaveLength(1);

    act(() => useReceiptStore.getState().setActiveReceiptId('r2'));

    expect(screen.getAllByTestId('line-item-card')).toHaveLength(2);
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('renders the receipt_long icon in the card when no file is uploaded', () => {
    render(<ReceiptStep onAddReceipt={vi.fn()} />);

    const icons = screen
      .getAllByText('receipt_long')
      .filter((el) => el.classList.contains('material-symbols-outlined'));
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });
});
