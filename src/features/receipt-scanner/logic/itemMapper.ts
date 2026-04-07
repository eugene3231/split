import type { EditableItem, Person } from '@shared/types';
import { createId } from '@shared/logic/core/id';

export function createItemFromOcr(
  item: { description: string; amount: number },
  people: Person[],
): EditableItem {
  return {
    id: createId(),
    name: item.description,
    amountInput: item.amount.toFixed(2),
    discountPercentInput: '',
    assignment: {
      mode: 'single',
      personId: people[0]?.id ?? '',
      personIds: people.map((person) => person.id),
    },
  };
}
