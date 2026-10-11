import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrandTotalCard } from './GrandTotalCard';
import { resetAllStores } from '../../../../../tests/integration/testHelpers';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

beforeEach(resetAllStores);

const props = {
  totalLabel: 'Grand total',
  grandTotal: 1000,
  displayCurrency: 'SGD',
  currentReceipt: null,
  people: [],
  onRenameReceipt: vi.fn(),
};

describe('GrandTotalCard PayNow status', () => {
  it('shows where the completed QR codes are while the number field is collapsed', () => {
    render(<GrandTotalCard {...props} payNowStatus="ready" />);
    expect(screen.getByRole('status')).toHaveTextContent(/bottom of each person.s card/i);
    expect(screen.getByLabelText('PayNow QR codes ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('PayNow Number')).toBeNull();
  });

  it('replaces the number-field helper with QR-location guidance after generation', () => {
    render(<GrandTotalCard {...props} payNowStatus="ready" />);
    fireEvent.click(screen.getByRole('button', { name: 'PayNow' }));
    expect(screen.getByLabelText('PayNow Number')).toHaveAccessibleDescription(
      /bottom of each person.s card/i,
    );
    expect(screen.queryByText(/Enter the bill payer.s number/)).toBeNull();
  });

  it('keeps the validation error visible after collapsing the number field', () => {
    useReceiptStore.getState().setPayerMobile('123');
    render(<GrandTotalCard {...props} payNowStatus="invalid" />);
    fireEvent.click(screen.getByRole('button', { name: 'PayNow' }));
    expect(screen.getByLabelText('PayNow Number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('PayNow Number')).toHaveAccessibleDescription(
      /valid SG mobile number/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'PayNow' }));
    expect(screen.getByRole('status')).toHaveTextContent(/valid SG mobile number/);
    expect(screen.getByLabelText('PayNow number invalid')).toBeInTheDocument();
  });

  it('clears the ready indicator when generation restarts and when the number is removed', () => {
    const { rerender } = render(<GrandTotalCard {...props} payNowStatus="ready" />);
    rerender(<GrandTotalCard {...props} payNowStatus="generating" />);
    expect(screen.queryByLabelText('PayNow QR codes ready')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/Generating/);
    rerender(<GrandTotalCard {...props} payNowStatus="empty" />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
