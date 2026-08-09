import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryStep } from './SummaryStep';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';

beforeEach(resetAllStores);

describe('SummaryStep', () => {
  it('shows a static Grand Total label on the Total tab instead of an editable receipt name', () => {
    const alice = makePerson('Alice');
    const receipt1 = makeReceipt({
      id: 'r1',
      name: 'Dinner',
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
    });
    const receipt2 = makeReceipt({
      id: 'r2',
      name: 'Drinks',
      items: [
        makeItem({
          amountInput: '5.00',
          assignment: { mode: 'single', personId: alice.id, personIds: [alice.id] },
        }),
      ],
    });

    seedStore([alice], [receipt1, receipt2], { activeReceiptId: 'r1' });

    render(<SummaryStep onAddReceipt={vi.fn()} />);

    // Defaults to the consolidated "total" tab when there are multiple receipts.
    const grandTotalLabel = screen.getByText('Grand Total');
    expect(grandTotalLabel.closest('[contenteditable="true"]')).toBeNull();
  });
});
