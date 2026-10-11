import { fireEvent, render, screen, within } from '@testing-library/react';
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
  it('makes share controls available without opening another control', () => {
    const callbacks = renderRow();
    expect(screen.getByTestId('claim-item-share-bread')).toHaveTextContent('1/2');
    expect(screen.getByRole('button', { name: 'Take a smaller share' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Take a bigger share' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Split evenly' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Alice only' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Take a bigger share' }));
    expect(callbacks.onStepShare).toHaveBeenCalledWith('increase');
  });

  it('renders the full amount directly for selected and unselected items', () => {
    const { rerender } = render(
      <ClaimItemRow
        item={{ ...item, share: null, priceLabel: '$123,456,789.00' }}
        personName="Alice"
        onToggle={vi.fn()}
        onStepShare={vi.fn()}
        onSetShare={vi.fn()}
        onSplitEvenly={vi.fn()}
        onTakeAlone={vi.fn()}
      />,
    );
    expect(screen.getByText('$123,456,789.00')).toBeInTheDocument();
    rerender(
      <ClaimItemRow
        item={{ ...item, share: item.share && { ...item.share, amountLabel: '$61,728,394.50' } }}
        personName="Alice"
        onToggle={vi.fn()}
        onStepShare={vi.fn()}
        onSetShare={vi.fn()}
        onSplitEvenly={vi.fn()}
        onTakeAlone={vi.fn()}
      />,
    );
    expect(screen.getByTestId('claim-item-amount-bread')).toHaveTextContent('$61,728,394.50');
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

  it('shows split evenly and person-only as direct icon buttons, not a menu', () => {
    const callbacks = renderRow({
      ...item,
      share: item.share && { ...item.share, canSplitEvenly: false },
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More share options' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Split evenly' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Alice only' }));
    expect(callbacks.onTakeAlone).toHaveBeenCalledOnce();
    expect(callbacks.onToggle).not.toHaveBeenCalled();
  });

  it('puts the share stepper on the same line as the item name and price', () => {
    renderRow();
    const nameLine = screen.getByTestId('claim-item-toggle-bread').parentElement!;
    expect(within(nameLine).getByTestId('claim-item-share-bread')).toHaveTextContent('1/2');
    expect(within(nameLine).getByTestId('claim-item-amount-bread')).toBeInTheDocument();
    expect(within(nameLine).queryByTestId('claim-item-split-evenly-bread')).not.toBeInTheDocument();
  });

  it('offers no share controls for an unclaimed item', () => {
    renderRow({ ...item, share: null, claimedByActive: false });
    expect(screen.queryByTestId('claim-item-amount-bread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('claim-item-share-bread')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('$12.00')).toBeInTheDocument();
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
