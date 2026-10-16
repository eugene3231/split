import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import type { CurrencyCode } from '@shared/constants';
import { makeReceipt, resetAllStores, seedStore } from '../../../../tests/integration/testHelpers';
import { ExchangeRateDisplay } from './ExchangeRateDisplay';

/** The display as the receipt step shows it: re-rendered as the receipt's rate changes. */
function ReceiptRate({ currency }: { currency: CurrencyCode }) {
  const override = useReceiptStore((state) => state.receipts[0].exchangeRateOverride);
  return <ExchangeRateDisplay receiptId="r1" currency={currency} exchangeRateOverride={override} />;
}

function renderRate(currency: CurrencyCode, exchangeRateOverride: number | null = null) {
  seedStore([], [makeReceipt({ id: 'r1', currency, exchangeRateOverride })]);
  render(<ReceiptRate currency={currency} />);
}

function savedOverride() {
  return useReceiptStore.getState().receipts[0].exchangeRateOverride;
}

function typeRate(value: string, key: 'Enter' | 'Escape' = 'Enter') {
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key });
}

describe('ExchangeRateDisplay', () => {
  beforeEach(() => {
    resetAllStores();
    useCurrencyStore.setState({ exchangeRates: { SGD: 1, IDR: 1 / 12650, USD: 1.3 } });
  });

  it('shows rupiah one way, as SGD to IDR, and flips when the label is tapped', () => {
    render(<ExchangeRateDisplay receiptId="r1" currency="IDR" exchangeRateOverride={null} />);

    expect(screen.getByRole('button', { name: '12,650 IDR' })).toBeInTheDocument();
    expect(screen.queryByText(/1 IDR =/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show the rate as 1 IDR in SGD' }));

    expect(screen.getByText('1 IDR =')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '0.000079051 SGD' })).toBeInTheDocument();
  });

  it('shows a currency stronger than SGD as that currency to SGD', () => {
    render(<ExchangeRateDisplay receiptId="r1" currency="USD" exchangeRateOverride={null} />);

    expect(screen.getByText('1 USD =')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1.3 SGD' })).toBeInTheDocument();
  });

  it('saves a typed rate as a manual rate for this receipt', () => {
    renderRate('USD');

    fireEvent.click(screen.getByRole('button', { name: '1.3 SGD' }));
    typeRate('1.42');

    expect(savedOverride()).toBe(1.42);
    expect(screen.getByRole('button', { name: '1.42 SGD' })).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('reads a rate typed as SGD to rupiah the other way round', () => {
    renderRate('IDR');

    fireEvent.click(screen.getByRole('button', { name: '12,650 IDR' }));
    typeRate('12500');

    expect(savedOverride()).toBe(1 / 12500);
    expect(screen.getByRole('button', { name: '12,500 IDR' })).toBeInTheDocument();
  });

  it('keeps the rate when the edit is cancelled or the number is not a rate', () => {
    renderRate('USD');

    fireEvent.click(screen.getByRole('button', { name: '1.3 SGD' }));
    typeRate('2', 'Escape');
    expect(savedOverride()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1.3 SGD' }));
    typeRate('0');
    expect(savedOverride()).toBeNull();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('goes back to the live rate when the manual one is reset', () => {
    renderRate('USD', 1.5);

    fireEvent.click(screen.getByTitle('Reset to auto rate'));

    expect(savedOverride()).toBeNull();
    expect(screen.getByRole('button', { name: '1.3 SGD' })).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });
});
