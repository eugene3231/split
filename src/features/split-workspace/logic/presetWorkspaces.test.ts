import { describe, expect, it } from 'vitest';
import { PRESET_WORKSPACES } from '@features/split-workspace/logic/presetWorkspaces';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { isStepValid } from '@features/split-workspace/logic/wizardValidation';

const [lunch, dinner] = PRESET_WORKSPACES;

function splitOf(preset: (typeof PRESET_WORKSPACES)[number]) {
  const draft = preset.build();
  const receipt = draft.receipts[0];
  return { draft, receipt, split: computeSplit({ people: draft.people, ...receipt }) };
}

describe('PRESET_WORKSPACES', () => {
  it('offers one test split per sample receipt', () => {
    expect(PRESET_WORKSPACES.map((preset) => preset.label)).toEqual([
      'Lunch for 3',
      'Dinner for 12',
    ]);
    expect(lunch.description).toBe('3 people · 4 items');
    expect(dinner.description).toBe('12 people · 20 items');
  });

  it.each(PRESET_WORKSPACES)(
    'assigns every item in $label so the summary is reachable',
    (preset) => {
      const draft = preset.build();
      const items = draft.receipts.flatMap((receipt) => receipt.items);
      expect(isStepValid('items', { items, people: draft.people })).toBe(true);
    },
  );

  it.each(PRESET_WORKSPACES)('matches the printed total of $label', (preset) => {
    const { receipt, split } = splitOf(preset);
    expect((split.grandTotalCents / 100).toFixed(2)).toBe(receipt.receiptTotalInput);
  });

  it('mixes solo, shared, and weighted shares', () => {
    const { draft, receipt } = splitOf(lunch);
    const nameOf = (id: string) => draft.people.find((person) => person.id === id)?.name;
    const shares = receipt.items.map((item) => ({
      name: item.name,
      people: item.assignment.personIds.map(nameOf),
      weights: item.assignment.weights ? Object.values(item.assignment.weights) : undefined,
    }));

    expect(shares).toEqual([
      { name: 'Chicken Rice', people: ['Alice'], weights: undefined },
      { name: 'Iced Lemon Tea', people: ['Bob'], weights: undefined },
      { name: 'Pasta Alfredo', people: ['Bob', 'Charlie'], weights: [2, 1] },
      { name: 'Truffle Fries', people: ['Alice', 'Bob', 'Charlie'], weights: undefined },
    ]);
  });

  it('leaves GST off the dinner and sets a payer mobile for the PayNow QR', () => {
    const { draft, receipt } = splitOf(dinner);
    expect(receipt.gst.enabled).toBe(false);
    expect(receipt.serviceCharge).toMatchObject({ enabled: true, percentInput: '10' });
    expect(draft.payerMobile).toBe('81234567');
  });

  it('builds fresh ids each time so a reload never collides with the last one', () => {
    const first = lunch.build();
    const second = lunch.build();
    expect(second.people[0].id).not.toBe(first.people[0].id);
    expect(second.receipts[0].id).not.toBe(first.receipts[0].id);
    expect(second.activeReceiptId).toBe(second.receipts[0].id);
  });
});
