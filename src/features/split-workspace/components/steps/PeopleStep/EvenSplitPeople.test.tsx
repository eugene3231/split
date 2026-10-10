import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { PeopleStep } from './PeopleStep';

function peopleNames() {
  return useReceiptStore.getState().people.map((person) => person.name);
}

beforeEach(() => {
  useReceiptStore.setState({ peopleInput: '', people: [], receipts: [] });
});

describe('PeopleStep even split', () => {
  it('adds numbered people for the chosen head count', () => {
    render(<PeopleStep />);

    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fewer people' }));
    fireEvent.click(screen.getByTestId('even-split-add-people-btn'));

    expect(peopleNames()).toEqual(['Person 1', 'Person 2', 'Person 3']);
  });

  it('starts at two people and cannot go below', () => {
    render(<PeopleStep />);

    expect(screen.getByTestId('even-split-count')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Fewer people' })).toBeDisabled();
  });

  it('hides once anyone has been added', () => {
    useReceiptStore.setState({ people: [{ id: 'p1', name: 'Ana' }] });
    render(<PeopleStep />);

    expect(screen.queryByTestId('even-split-people')).not.toBeInTheDocument();
  });
});
