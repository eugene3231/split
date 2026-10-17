import type { ChargeState, EditableItem, Person } from '@shared/types';

export type PrototypeAssignments = Record<string, string[]>;

export interface PrototypeItem {
  id: string;
  name: string;
  amountInput: string;
}

export interface PrototypeReceipt {
  name: string;
  people: Person[];
  items: PrototypeItem[];
  initialAssignments: PrototypeAssignments;
}

export const DINNER_RECEIPT: PrototypeReceipt = {
  name: 'Tiong Bahru Social',
  people: [
    { id: 'eugene', name: 'Eugene' },
    { id: 'mei', name: 'Mei' },
    { id: 'arjun', name: 'Arjun' },
    { id: 'sofia', name: 'Sofia' },
    { id: 'tom', name: 'Tom' },
  ],
  items: [
    { id: 'mala', name: 'Mala Xiang Guo (L)', amountInput: '28.00' },
    { id: 'chicken-rice', name: 'Hainanese Chicken Rice', amountInput: '8.50' },
    { id: 'laksa', name: 'Laksa', amountInput: '9.80' },
    { id: 'ckt', name: 'Char Kway Teow', amountInput: '10.50' },
    { id: 'fries', name: 'Truffle Fries', amountInput: '12.00' },
    { id: 'lemon-tea', name: 'Iced Lemon Tea', amountInput: '3.20' },
    { id: 'kopi', name: 'Kopi Peng', amountInput: '2.80' },
    { id: 'beer', name: 'Tiger Beer Tower', amountInput: '48.00' },
  ],
  initialAssignments: {
    mala: ['eugene', 'mei', 'arjun', 'sofia', 'tom'],
    'chicken-rice': ['mei'],
    laksa: ['arjun'],
    ckt: [],
    fries: ['eugene', 'sofia'],
    'lemon-tea': ['mei'],
    kopi: [],
    beer: ['eugene', 'arjun', 'tom'],
  },
};

const STRESS_PEOPLE: Person[] = [
  { id: 'alexandra', name: 'Alexandra Konstantinopoulou' },
  { id: 'bartholomew', name: 'Bartholomew' },
  { id: 'chen', name: 'Chen Wei Ling' },
  { id: 'dhanush', name: 'Dhanushkodi Ramachandran' },
  { id: 'eve', name: 'Eve' },
  { id: 'fx', name: 'François-Xavier' },
  { id: 'gwen', name: 'Gwendolyn' },
  { id: 'hiroshi', name: 'Hiroshi' },
  { id: 'isabella', name: 'Isabella Montgomery' },
  { id: 'jo', name: 'Jo' },
  { id: 'jonathan', name: 'Jonathan' },
  { id: 'kai', name: 'Kai' },
];

const everyone = STRESS_PEOPLE.map((person) => person.id);

export const STRESS_RECEIPT: PrototypeReceipt = {
  name: 'Annual Team Offsite Dinner at The Grand Peranakan Heritage Dining Room',
  people: STRESS_PEOPLE,
  items: [
    {
      id: 'hor-fun',
      name: 'Wagyu Beef Hor Fun with Extra Egg, Chilli Padi & Lime (Sharing Portion)',
      amountInput: '68.00',
    },
    { id: 'wine', name: 'Château Margaux 2015', amountInput: '1288.00' },
    { id: 'kopi', name: 'Kopi C Kosong Siu Dai Peng', amountInput: '2.20' },
    { id: 'babi', name: 'Babi Pongteh', amountInput: '24.00' },
    { id: 'ayam', name: 'Ayam Buah Keluak', amountInput: '28.00' },
    { id: 'chap-chye', name: 'Chap Chye', amountInput: '16.00' },
    { id: 'otah', name: 'Otah Otah (6 pcs)', amountInput: '18.00' },
    { id: 'kueh', name: 'Assorted Nyonya Kueh Platter', amountInput: '22.00' },
    { id: 'cendol', name: 'Cendol', amountInput: '6.50' },
    { id: 'water', name: 'Water', amountInput: '0.30' },
  ],
  initialAssignments: {
    'hor-fun': everyone,
    wine: ['alexandra', 'fx', 'isabella', 'jonathan'],
    kopi: ['dhanush'],
    babi: everyone,
    ayam: everyone,
    'chap-chye': [],
    otah: ['bartholomew', 'chen', 'eve', 'gwen', 'hiroshi', 'jo'],
    kueh: [],
    cendol: ['kai'],
    water: ['eve'],
  },
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
