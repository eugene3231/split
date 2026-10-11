import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useSavedGroupsStore } from '@features/split-workspace/stores/savedGroupsStore';
import { makeItem, makeReceipt } from '../../../../../tests/integration/testHelpers';
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

  it('deletes a saved group only from Manage groups without removing current people', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben'] }],
    });
    render(<PeopleStep />);

    addNames('Ana, Ben');
    expect(
      screen.queryByRole('button', { name: 'Delete Housemates group' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Housemates group' }));

    expect(loadSavedGroups()).toEqual([]);
    expect(peopleNames()).toEqual(['Ana', 'Ben']);
    expect(screen.getByText('No saved groups')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('saved-groups')).not.toBeInTheDocument();
  });
  it('shows members before a group is added and keeps adding separate from managing', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben', 'Cai'] }],
    });
    render(<PeopleStep />);

    expect(screen.getByTestId('saved-group-g1')).toHaveTextContent('Ana, Ben, Cai');
    fireEvent.click(screen.getByRole('button', { name: 'Manage groups' }));
    expect(screen.queryByTestId('saved-group-g1')).not.toBeInTheDocument();
    expect(screen.getByText('Ana, Ben, Cai')).toBeVisible();
    expect(peopleNames()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByTestId('saved-group-g1'));
    expect(peopleNames()).toEqual(['Ana', 'Ben', 'Cai']);
  });

  it('removes all current people and assignments across receipts while keeping groups and typed input', () => {
    useSavedGroupsStore.setState({
      groups: [{ id: 'g1', name: 'Housemates', names: ['Ana', 'Ben'] }],
    });
    const first = makeReceipt({
      id: 'r1',
      items: [
        makeItem({
          id: 'i1',
          name: 'Dinner',
          amountInput: '90',
          assignment: {
            mode: 'equal',
            personId: '',
            personIds: ['p1', 'p2'],
            weights: { p1: 2, p2: 1 },
            unassignedWeight: 1,
          },
        }),
      ],
    });
    const second = makeReceipt({
      id: 'r2',
      items: [
        makeItem({
          id: 'i2',
          name: 'Tea',
          amountInput: '6',
          assignment: { mode: 'single', personId: 'p2', personIds: [] },
        }),
      ],
    });
    useReceiptStore.setState({
      people: [
        { id: 'p1', name: 'Ana' },
        { id: 'p2', name: 'Ben' },
      ],
      peopleInput: 'Dee',
      receipts: [first, second],
      activeReceiptId: 'r2',
    });
    render(<PeopleStep />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove all' }));

    expect(peopleNames()).toEqual([]);
    expect(screen.getByTestId('people-input')).toHaveValue('Dee');
    expect(screen.queryByRole('button', { name: 'Remove all' })).not.toBeInTheDocument();
    expect(useReceiptStore.getState().activeReceiptId).toBe('r2');
    expect(useReceiptStore.getState().receipts).toEqual([
      {
        ...first,
        items: [{ ...first.items[0], assignment: { mode: 'equal', personId: '', personIds: [] } }],
      },
      {
        ...second,
        items: [{ ...second.items[0], assignment: { mode: 'equal', personId: '', personIds: [] } }],
      },
    ]);
    expect(useSavedGroupsStore.getState().groups).toEqual([
      { id: 'g1', name: 'Housemates', names: ['Ana', 'Ben'] },
    ]);
    fireEvent.click(screen.getByTestId('saved-group-g1'));
    expect(peopleNames()).toEqual(['Ana', 'Ben']);
  });
});
