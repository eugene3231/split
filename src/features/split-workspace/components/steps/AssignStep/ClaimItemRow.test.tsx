import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClaimItem } from '@features/split-workspace/logic/claim';
import { ClaimItemRow } from './ClaimItemRow';

const item: ClaimItem = {
  id: 'bread',
  receiptId: 'receipt',
  name: 'A very long sourdough bread with rosemary',
  priceLabel: '$12.00',
  claimedByActive: true,
  isLeft: false,
  claimants: [],
  leftLabel: null,
  share: {
    label: '1/2',
    amountCents: 600,
    amountLabel: '$6.00',
    canIncrease: true,
    canDecrease: true,
    canSplitEvenly: true,
    canTakeAlone: true,
  },
};

function renderRow(value = item) {
  const callbacks = {
    onToggle: vi.fn(),
    onStepShare: vi.fn(),
    onSetShare: vi.fn(),
    onSplitEvenly: vi.fn(),
    onTakeAlone: vi.fn(),
  };
  render(
    <ul>
      <ClaimItemRow item={value} personName="Alice" {...callbacks} />
    </ul>,
  );
  return callbacks;
}

describe('ClaimItemRow', () => {
  it('exposes the fraction and full item name through one mobile controls trigger', () => {
    renderRow();
    const trigger = screen.getByTestId('claim-item-controls-bread');
    expect(trigger).toHaveTextContent('1/2');
    expect(trigger).toHaveAccessibleName(`Adjust share for ${item.name}, 1/2`);
    expect(trigger).toHaveAttribute('popovertarget');
    expect(document.getElementById(trigger.getAttribute('popovertarget') ?? '')).toHaveAttribute(
      'popover',
      'auto',
    );
    expect(screen.getAllByTestId('claim-item-share-bread-increase')).toHaveLength(1);
  });

  it('exposes full item and selected-share amounts in mobile details', () => {
    renderRow({
      ...item,
      priceLabel: '$123,456,789.00',
      share: item.share && { ...item.share, amountLabel: '$61,728,394.50' },
    });
    expect(screen.getByText('Item total: $123,456,789.00')).toBeInTheDocument();
    expect(screen.getByText('Your share: $61,728,394.50')).toBeInTheDocument();
    expect(screen.getAllByText(item.name)).toHaveLength(2);
  });

  it('keeps selection separate from every share action', () => {
    const callbacks = renderRow();
    fireEvent.click(screen.getByTestId('claim-item-share-bread-increase'));
    fireEvent.click(screen.getByTestId('claim-item-share-bread-decrease'));
    fireEvent.click(screen.getByTestId('claim-item-split-evenly-bread'));
    fireEvent.click(screen.getByTestId('claim-item-take-alone-bread'));
    expect(callbacks.onStepShare.mock.calls).toEqual([['increase'], ['decrease']]);
    expect(callbacks.onSplitEvenly).toHaveBeenCalledOnce();
    expect(callbacks.onTakeAlone).toHaveBeenCalledOnce();
    expect(callbacks.onToggle).not.toHaveBeenCalled();
    const toggle = screen.getByTestId('claim-item-toggle-bread');
    expect(toggle).toHaveAccessibleName(item.name);
    expect(toggle.querySelector('button, input')).toBeNull();
  });

  it('offers no share controls for an unclaimed item', () => {
    renderRow({ ...item, share: null, claimedByActive: false });
    expect(screen.queryByTestId('claim-item-controls-bread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('claim-item-amount-bread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('claim-item-share-bread')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('claim-item-details-bread')).toHaveAccessibleName(
      `Item details for ${item.name}`,
    );
    expect(screen.getByText('Item total: $12.00')).toBeInTheDocument();
    expect(screen.queryByText(/Your share:/)).not.toBeInTheDocument();
  });

  it('commits a typed fraction without selecting the item', () => {
    const callbacks = renderRow();
    fireEvent.click(screen.getByTestId('claim-item-amount-bread'));
    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '1/3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(callbacks.onSetShare).toHaveBeenCalledWith({ kind: 'fraction', divisor: 3 });
    expect(callbacks.onToggle).not.toHaveBeenCalled();
  });
});
