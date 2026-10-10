import { useState } from 'react';
import { computeSplit } from '@shared/logic/split/split';
import {
  PROTOTYPE_CHARGES,
  PROTOTYPE_INITIAL_ASSIGNMENTS,
  PROTOTYPE_ITEMS,
  PROTOTYPE_PEOPLE,
  setAssignees,
  toEditableItems,
  toggleAssignee,
} from '@features/ux-prototypes/logic/prototypeReceipt';

export function usePrototypeSplit() {
  const [assignments, setAssignments] = useState(PROTOTYPE_INITIAL_ASSIGNMENTS);

  const split = computeSplit({
    people: PROTOTYPE_PEOPLE,
    items: toEditableItems(PROTOTYPE_ITEMS, assignments),
    ...PROTOTYPE_CHARGES,
  });

  return {
    people: PROTOTYPE_PEOPLE,
    items: PROTOTYPE_ITEMS,
    assignments,
    split,
    toggle: (itemId: string, personId: string) =>
      setAssignments((current) => toggleAssignee(current, itemId, personId)),
    assign: (itemId: string, personIds: string[]) =>
      setAssignments((current) => setAssignees(current, itemId, personIds)),
  };
}
