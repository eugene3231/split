import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSavedGroupsStore } from '@features/split-workspace/stores/savedGroupsStore';
import { loadSavedGroups } from '@features/split-workspace/logic/savedGroups';
import { PeopleStep } from './PeopleStep';

function peopleNames() {
  return useReceiptStore.getState().people.map((person) => person.name);
}

function addNames(names: string) {
  fireEvent.change(screen.getByTestId('people-input'), { target: { value: names } });
  fireEvent.click(screen.getByTestId('people-add-btn'));
}

beforeEach(() => {
  window.localStorage.clear();
  useReceiptStore.setState({ peopleInput: '', people: [], receipts: [] });
  useSavedGroupsStore.setState({ groups: [] });
});

describe('PeopleStep saved groups', () => {
  it('saves the current people as a named group that survives a reload', () => {
    render(<PeopleStep />);
    addNames('Ana, Ben, Cai');

    fireEvent.click(screen.getByTestId('save-group-btn'));
    fireEvent.change(screen.getByTestId('save-group-name-input'), {
      target: { value: 'Housemates' },
    });
    fireEvent.click(screen.getByTestId('save-group-submit'));

    expect(screen.getByTestId('saved-groups')).toHaveTextContent('Housemates');
    expect(loadSavedGroups()).toEqual([
      expect.objectContaining({ name: 'Housemates', names: ['Ana', 'Ben', 'Cai'] }),
    ]);
  });

  it('offers to save a group only once two people are added', () => {
    render(<PeopleStep />);
    addNames('Ana');

    expect(screen.queryByTestId('save-group-btn')).not.toBeInTheDocument();
  });

  it('adds everyone in a saved group in one tap, skipping people already in the split', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben', 'Cai'] }],
    });
    render(<PeopleStep />);
    addNames('ben, Zoe');

    fireEvent.click(screen.getByTestId('saved-group-g1'));

    expect(peopleNames()).toEqual(['ben', 'Zoe', 'Ana', 'Cai']);
    expect(screen.getByTestId('saved-group-g1')).toBeDisabled();
  });

  it('keeps a half-typed name in the input when a group is added', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben'] }],
    });
    render(<PeopleStep />);
    fireEvent.change(screen.getByTestId('people-input'), { target: { value: 'Dee' } });

    fireEvent.click(screen.getByTestId('saved-group-g1'));

    expect(screen.getByTestId('people-input')).toHaveValue('Dee');
  });

  it('deletes a saved group', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben'] }],
    });
    render(<PeopleStep />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Housemates group' }));

    expect(screen.queryByTestId('saved-groups')).not.toBeInTheDocument();
    expect(loadSavedGroups()).toEqual([]);
  });
});
