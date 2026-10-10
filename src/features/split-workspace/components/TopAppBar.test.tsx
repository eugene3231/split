import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopAppBar } from './TopAppBar';

describe('TopAppBar', () => {
  it('renders header actions inside the app bar', () => {
    render(
      <TopAppBar
        activeStep="final"
        itemsSubPhase="review"
        assignedItemCount={0}
        detectedItemsCount={0}
        stepReachability={{ people: true, receipt: true, items: true, final: true }}
        onStepSelect={vi.fn()}
      >
        <button type="button">New split</button>
      </TopAppBar>,
    );

    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'New split' }),
    ).toBeInTheDocument();
  });
});
