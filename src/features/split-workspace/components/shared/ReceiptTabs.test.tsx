import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceiptTabs } from './ReceiptTabs';

const receipts = [
  { id: 'r1', name: 'Receipt 1' },
  { id: 'r2', name: 'Receipt 2' },
];

describe('ReceiptTabs rename', () => {
  function startRenaming() {
    const onSelect = vi.fn();
    const onRename = vi.fn();
    render(
      <ReceiptTabs
        receipts={receipts}
        activeReceiptId="r1"
        onSelect={onSelect}
        onRename={onRename}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename receipt' }));
    return { onSelect, onRename, input: screen.getByDisplayValue('Receipt 1') };
  }

  it('commits the rename on Enter without re-selecting the tab', () => {
    const { onSelect, onRename, input } = startRenaming();

    fireEvent.change(input, { target: { value: 'Team Lunch' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('r1', 'Team Lunch');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Team Lunch')).not.toBeInTheDocument();
  });

  it('keeps Space keydowns inside the rename input', () => {
    const { onSelect, input } = startRenaming();

    fireEvent.keyDown(input, { key: ' ' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('cancels the rename on Escape without renaming', () => {
    const { onRename, input } = startRenaming();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Receipt 1')).not.toBeInTheDocument();
  });

  it('still selects the tab with Enter when not renaming', () => {
    const onSelect = vi.fn();
    render(
      <ReceiptTabs
        receipts={receipts}
        activeReceiptId="r1"
        onSelect={onSelect}
        onRename={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByText('Receipt 2'), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('r2');
  });
});
