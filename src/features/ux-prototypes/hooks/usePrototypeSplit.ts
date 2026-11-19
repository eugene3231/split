import { useState } from 'react';
import { computeSplit } from '@shared/logic/split/split';
import {
  PROTOTYPE_CHARGES,
  setAssignees,
  toEditableItems,
  toggleAssignee,
  type PrototypeReceipt,
} from '@features/ux-prototypes/logic/prototypeReceipt';

export function usePrototypeSplit(receipt: PrototypeReceipt) {
  const [assignments, setAssignments] = useState(receipt.initialAssignments);

  const split = computeSplit({
    people: receipt.people,
    items: toEditableItems(receipt.items, assignments),
    ...PROTOTYPE_CHARGES,
  });

  return {
    receiptName: receipt.name,
    people: receipt.people,
    items: receipt.items,
    assignments,
    split,
    toggle: (itemId: string, personId: string) =>
      setAssignments((current) => toggleAssignee(current, itemId, personId)),
    assign: (itemId: string, personIds: string[]) =>
      setAssignments((current) => setAssignees(current, itemId, personIds)),
  };
}
