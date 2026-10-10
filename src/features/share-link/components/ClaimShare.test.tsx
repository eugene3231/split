import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SharedReceipt } from '../logic/shareLink';
import { ClaimShare } from './ClaimShare';

const receipt: SharedReceipt = {
  name: 'Jumbo Seafood',
  currency: 'SGD',
  people: ['Ana', 'Ben'],
  payerName: 'Ana',
  payerMobile: '+6591234567',
  items: [
    { name: 'Chilli crab', cents: 8000 },
    { name: 'Lime juice', cents: 2000 },
  ],
  subtotalCents: 10000,
  totalCents: 12000,
};

describe('ClaimShare', () => {
  it('builds the friend’s total as they claim and share items', () => {
    render(<ClaimShare receipt={receipt} />);

    fireEvent.click(screen.getByRole('button', { name: /Chilli crab/ }));
    expect(screen.getByText('$96.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    expect(screen.getByText('$48.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Chilli crab/ }));
    expect(screen.getByRole('button', { name: 'Pay Ana' })).toBeDisabled();
  });

  it('offers PayNow only for receipts in the base currency', () => {
    render(<ClaimShare receipt={{ ...receipt, currency: 'MYR' }} />);

    expect(screen.queryByRole('button', { name: 'Pay Ana' })).not.toBeInTheDocument();
  });
});
