import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCurrencyStore } from '@features/split-workspace/stores/currencyStore';
import { ExchangeRateDisplay } from './ExchangeRateDisplay';

describe('ExchangeRateDisplay', () => {
  beforeEach(() => {
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
});
