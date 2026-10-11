import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { exportDraftToJson } from '@features/split-workspace/logic/draftStorage';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../tests/integration/testHelpers';
import { WorkspaceMenu } from './WorkspaceMenu';

function seedBlankWorkspace() {
  seedStore([], [makeReceipt({ id: 'r1', items: [makeItem({ name: '', amountInput: '' })] })]);
}

function seedWorkspaceWithPeople() {
  seedStore([makePerson('Zed')], [makeReceipt({ id: 'r1', items: [makeItem({ name: 'Laksa' })] })]);
}

function openMenu() {
  fireEvent.keyDown(screen.getByTestId('workspace-menu-btn'), { key: 'Enter' });
}

async function pickFile(file: File) {
  await act(async () => {
    fireEvent.change(screen.getByTestId('workspace-import-input'), { target: { files: [file] } });
  });
}

describe('WorkspaceMenu', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('opens and closes the menu from the header button and on Escape', () => {
    seedBlankWorkspace();
    render(<WorkspaceMenu onLoadWorkspace={vi.fn()} />);

    openMenu();
    expect(screen.getByTestId('workspace-menu-btn')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /Lunch for 3/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    seedBlankWorkspace();
    render(<WorkspaceMenu onLoadWorkspace={vi.fn()} />);

    openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('loads a test split without asking when there is nothing to lose', () => {
    seedBlankWorkspace();
    const onLoadWorkspace = vi.fn();
    render(<WorkspaceMenu onLoadWorkspace={onLoadWorkspace} />);

    openMenu();
    fireEvent.click(screen.getByTestId('workspace-preset-lunch-for-three'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onLoadWorkspace).toHaveBeenCalledTimes(1);
    expect(onLoadWorkspace.mock.calls[0][0].people).toHaveLength(3);
  });

  it('asks before a test split replaces people already in the split', () => {
    seedWorkspaceWithPeople();
    const onLoadWorkspace = vi.fn();
    render(<WorkspaceMenu onLoadWorkspace={onLoadWorkspace} />);

    openMenu();
    fireEvent.click(screen.getByTestId('workspace-preset-lunch-for-three'));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace this split?' });
    expect(dialog).toHaveTextContent('Loading Lunch for 3');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onLoadWorkspace).not.toHaveBeenCalled();

    openMenu();
    fireEvent.click(screen.getByTestId('workspace-preset-lunch-for-three'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace split' }));
    expect(onLoadWorkspace).toHaveBeenCalledTimes(1);
  });

  it('imports a Split export after confirming', async () => {
    seedWorkspaceWithPeople();
    const onLoadWorkspace = vi.fn();
    render(<WorkspaceMenu onLoadWorkspace={onLoadWorkspace} />);
    const json = exportDraftToJson({
      people: [{ id: 'p9', name: 'Mei' }],
      receipts: [makeReceipt({ id: 'r9', items: [makeItem({ name: 'Satay' })] })],
      activeReceiptId: 'r9',
      payerMobile: '',
    });

    openMenu();
    fireEvent.click(screen.getByTestId('workspace-import-btn'));
    await pickFile(new File([json], 'friday.json', { type: 'application/json' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Replace this split?' });
    expect(dialog).toHaveTextContent('Loading friday.json');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace split' }));

    expect(onLoadWorkspace.mock.calls[0][0].people).toEqual([{ id: 'p9', name: 'Mei' }]);
  });

  it('says so when the picked file is not a Split export, and keeps the split', async () => {
    seedWorkspaceWithPeople();
    const onLoadWorkspace = vi.fn();
    render(<WorkspaceMenu onLoadWorkspace={onLoadWorkspace} />);

    await pickFile(new File(['{"version":7}'], 'other.json', { type: 'application/json' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("That file isn't a Split export."),
    );
    expect(onLoadWorkspace).not.toHaveBeenCalled();
    expect(useReceiptStore.getState().people.map((person) => person.name)).toEqual(['Zed']);
  });
});
