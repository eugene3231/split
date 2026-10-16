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
  takenByOthers: false,
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
    expect(screen.getByRole('button', { name: 'Split evenly with everyone' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Only Alice had this' })).toBeEnabled();
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

  it('shows split evenly and person-only as labelled buttons, not a menu', () => {
    const callbacks = renderRow({
      ...item,
      share: item.share && { ...item.share, canSplitEvenly: false },
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More share options' })).not.toBeInTheDocument();
    expect(screen.getByTestId('claim-item-split-evenly-bread')).toHaveTextContent('Everyone');
    expect(screen.getByTestId('claim-item-take-alone-bread')).toHaveTextContent('Only Alice');
    expect(screen.getByRole('button', { name: 'Split evenly with everyone' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Only Alice had this' }));
    expect(callbacks.onTakeAlone).toHaveBeenCalledOnce();
    expect(callbacks.onToggle).not.toHaveBeenCalled();
  });

  it('keeps the stepper beside the amount, and moves who else has it under the name', () => {
    const alice = {
      id: 'a',
      name: 'Alice',
      firstName: 'Alice',
      colorIndex: 0,
      totalCents: 0,
      isActive: true,
    };
    renderRow({ ...item, claimants: [alice] });
    const nameLine = screen.getByTestId('claim-item-toggle-bread').parentElement!;
    const actionLine = screen.getByTestId('claim-item-split-evenly-bread').parentElement!;
    expect(within(nameLine).getByTestId('claim-item-share-bread')).toBeInTheDocument();
    expect(within(nameLine).getByTestId('claim-item-amount-bread')).toBeInTheDocument();
    expect(within(nameLine).queryByTestId('claim-item-claimants-bread')).not.toBeInTheDocument();
    expect(within(actionLine).getByTestId('claim-item-claimants-bread')).toBeInTheDocument();
  });

  it('names the share as a share, and the whole item as All rather than a quantity', () => {
    renderRow({ ...item, share: item.share && { ...item.share, label: 'All' } });
    expect(screen.getByTestId('claim-item-share-bread')).toHaveTextContent('Your share: All');
  });

  it('flags how much is still open under the name', () => {
    renderRow({ ...item, isLeft: true, leftLabel: '1/2 left' });
    expect(screen.getByTestId('claim-item-bread')).toHaveAttribute('data-left');
    expect(screen.getByTestId('claim-item-left-bread')).toHaveTextContent('1/2 left');
    expect(screen.getByTestId('claim-item-toggle-bread')).toHaveAccessibleName(item.name);
  });

  it('flags an item nobody has yet', () => {
    renderRow({ ...item, share: null, claimedByActive: false, isLeft: true });
    expect(screen.getByTestId('claim-item-bread')).toHaveAttribute('data-left');
    expect(screen.getByTestId('claim-item-left-bread')).toHaveTextContent('Nobody yet');
  });

  it('does not flag an item that is fully claimed', () => {
    renderRow();
    expect(screen.getByTestId('claim-item-bread')).not.toHaveAttribute('data-left');
    expect(screen.queryByTestId('claim-item-left-bread')).not.toBeInTheDocument();
  });

  it('marks an item someone else has in full, and gives it a single line', () => {
    renderRow({ ...item, share: null, claimedByActive: false, takenByOthers: true });
    expect(screen.getByTestId('claim-item-bread')).toHaveAttribute('data-taken');
    expect(screen.queryByTestId('claim-item-share-bread')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('labels the amount as something to tap and type into', () => {
    renderRow();
    expect(screen.getByTestId('claim-item-amount-bread')).toHaveAccessibleName(
      'Your share $6.00, tap to type an amount or percent',
    );
  });

  it('offers no share controls for an unclaimed item', () => {
    renderRow({ ...item, share: null, claimedByActive: false });
    expect(screen.queryByTestId('claim-item-amount-bread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('claim-item-share-bread')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
