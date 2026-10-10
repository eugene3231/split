import type { EditableItem } from '@shared/types';
import { createId } from '@shared/logic/core/id';

export function createItemFromOcr(item: { description: string; amount: number }): EditableItem {
  return {
    id: createId(),
    name: item.description,
    amountInput: item.amount.toFixed(2),
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: [] },
  };
}
