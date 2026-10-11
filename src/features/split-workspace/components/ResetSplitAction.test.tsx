import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResetSplitAction } from './ResetSplitAction';

function openConfirmation() {
  const onConfirm = vi.fn();
  render(<ResetSplitAction onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset split' }));
  return { onConfirm, dialog: screen.getByRole('alertdialog', { name: 'Reset this split?' }) };
}

describe('ResetSplitAction', () => {
  it('requires confirmation before resetting the split', () => {
    const { onConfirm, dialog } = openConfirmation();

    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset split' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the split when the user cancels', () => {
    const { onConfirm, dialog } = openConfirmation();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the split when Escape closes the dialog', () => {
    const { onConfirm, dialog } = openConfirmation();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
