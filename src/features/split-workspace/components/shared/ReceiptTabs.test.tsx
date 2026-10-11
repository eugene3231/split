import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddReceiptButton, ReceiptTab, ReceiptTabs } from './ReceiptTabs';

function renderTabs({
  onSelect = vi.fn(),
  onRename = vi.fn(),
  onRemove,
  onAdd,
}: {
  onSelect?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
  onAdd?: () => void;
} = {}) {
  render(
    <ReceiptTabs
      value="r1"
      onValueChange={onSelect}
      action={onAdd && <AddReceiptButton onClick={onAdd} />}
    >
      {['Receipt 1', 'Receipt 2'].map((name, index) => {
        const id = `r${index + 1}`;
        return (
          <ReceiptTab
            key={id}
            value={id}
            label={name}
            onRename={(newName) => onRename(id, newName)}
            onRemove={onRemove && (() => onRemove(id))}
          />
        );
      })}
    </ReceiptTabs>,
  );
}

describe('ReceiptTabs', () => {
  it('marks only the active receipt as the selected tab', () => {
    renderTabs();

    expect(screen.getByRole('tab', { name: /Receipt 1/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Receipt 2/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('keeps Add receipt outside the tabs as an action', () => {
    const onAdd = vi.fn();
    renderTabs({ onAdd });

    const add = screen.getByRole('button', { name: 'Add receipt' });
    fireEvent.click(add);

    expect(onAdd).toHaveBeenCalledOnce();
    expect(screen.getByRole('tablist')).not.toContainElement(add);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('removes a receipt without selecting its tab', () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    renderTabs({ onSelect, onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Receipt 2' }));

    expect(onRemove).toHaveBeenCalledWith('r2');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers no remove buttons when removing is not allowed', () => {
    renderTabs();

    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('selects a tab when pressed, and moves between tabs with the arrow keys', async () => {
    const onSelect = vi.fn();
    renderTabs({ onSelect });

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Receipt 2/ }));
    expect(onSelect).toHaveBeenLastCalledWith('r2');

    const first = screen.getByRole('tab', { name: /Receipt 1/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Receipt 2/ })).toHaveFocus());
  });

  it('still selects the tab with Enter when not renaming', () => {
    const onSelect = vi.fn();
    renderTabs({ onSelect });

    fireEvent.keyDown(screen.getByRole('tab', { name: /Receipt 2/ }), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('r2');
  });

  describe('rename', () => {
    function startRenaming() {
      const onSelect = vi.fn();
      const onRename = vi.fn();
      renderTabs({ onSelect, onRename });
      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.click(within(activeTab).getByRole('button', { name: 'Rename receipt' }));
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
  });
});
