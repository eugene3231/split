import type { ChargeState, EditableItem, Person } from '@shared/types';

export type PrototypeAssignments = Record<string, string[]>;

export interface PrototypeItem {
  id: string;
  name: string;
  amountInput: string;
}

export const PROTOTYPE_RECEIPT_NAME = 'Tiong Bahru Social';

export const PROTOTYPE_PEOPLE: Person[] = [
  { id: 'eugene', name: 'Eugene' },
  { id: 'mei', name: 'Mei' },
  { id: 'arjun', name: 'Arjun' },
  { id: 'sofia', name: 'Sofia' },
  { id: 'tom', name: 'Tom' },
];

export const PROTOTYPE_ITEMS: PrototypeItem[] = [
  { id: 'mala', name: 'Mala Xiang Guo (L)', amountInput: '28.00' },
  { id: 'chicken-rice', name: 'Hainanese Chicken Rice', amountInput: '8.50' },
  { id: 'laksa', name: 'Laksa', amountInput: '9.80' },
  { id: 'ckt', name: 'Char Kway Teow', amountInput: '10.50' },
  { id: 'fries', name: 'Truffle Fries', amountInput: '12.00' },
  { id: 'lemon-tea', name: 'Iced Lemon Tea', amountInput: '3.20' },
  { id: 'kopi', name: 'Kopi Peng', amountInput: '2.80' },
  { id: 'beer', name: 'Tiger Beer Tower', amountInput: '48.00' },
];

export const PROTOTYPE_INITIAL_ASSIGNMENTS: PrototypeAssignments = {
  mala: ['eugene', 'mei', 'arjun', 'sofia', 'tom'],
  'chicken-rice': ['mei'],
  laksa: ['arjun'],
  ckt: [],
  fries: ['eugene', 'sofia'],
  'lemon-tea': ['mei'],
  kopi: [],
  beer: ['eugene', 'arjun', 'tom'],
};

function percentCharge(percentInput: string): ChargeState {
  return {
    enabled: percentInput !== '',
    mode: 'percent',
    amountInput: '',
    percentInput,
    detectedConfidence: null,
    detectedSource: null,
  };
}

export const PROTOTYPE_CHARGES = {
  discount: percentCharge(''),
  serviceCharge: percentCharge('10'),
  gst: percentCharge('9'),
};

export function toggleAssignee(
  assignments: PrototypeAssignments,
  itemId: string,
  personId: string,
): PrototypeAssignments {
  const current = assignments[itemId] ?? [];
  const next = current.includes(personId)
    ? current.filter((id) => id !== personId)
    : [...current, personId];
  return { ...assignments, [itemId]: next };
}

export function setAssignees(
  assignments: PrototypeAssignments,
  itemId: string,
  personIds: string[],
): PrototypeAssignments {
  return { ...assignments, [itemId]: [...personIds] };
}

export function toEditableItems(
  items: PrototypeItem[],
  assignments: PrototypeAssignments,
): EditableItem[] {
  return items.map((item) => ({
    ...item,
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: assignments[item.id] ?? [] },
  }));
}
