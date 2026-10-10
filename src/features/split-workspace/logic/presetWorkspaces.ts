import type { SessionDraft } from '@features/split-workspace/types';
import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import { BASE_CURRENCY } from '@shared/constants';
import { createId } from '@shared/logic/core/id';
import type { ChargeState, EditableItem, Person, Receipt } from '@shared/types';

/** One person's name, several names sharing equally, or names mapped to share weights. */
type PresetClaim = string | string[] | Record<string, number>;

interface PresetItem {
  name: string;
  price: string;
  claim: PresetClaim;
}

interface PresetReceipt {
  name: string;
  items: PresetItem[];
  serviceChargePercent: string;
  gstPercent: string;
  total: string;
}

interface PresetDefinition {
  id: string;
  label: string;
  peopleNames: string[];
  payerMobile: string;
  receipts: PresetReceipt[];
}

export interface PresetWorkspace {
  id: string;
  label: string;
  description: string;
  build: () => SessionDraft;
}

const LUNCH_FOR_THREE: PresetDefinition = {
  id: 'lunch-for-three',
  label: 'Lunch for 3',
  peopleNames: ['Alice', 'Bob', 'Charlie'],
  payerMobile: '',
  receipts: [
    {
      name: 'Lunch',
      serviceChargePercent: '10',
      gstPercent: '9',
      total: '47.48',
      items: [
        { name: 'Chicken Rice', price: '8.50', claim: 'Alice' },
        { name: 'Iced Lemon Tea', price: '3.20', claim: 'Bob' },
        { name: 'Pasta Alfredo', price: '15.90', claim: { Bob: 2, Charlie: 1 } },
        { name: 'Truffle Fries', price: '12.00', claim: ['Alice', 'Bob', 'Charlie'] },
      ],
    },
  ],
};

const EVERYONE_AT_DINNER = [
  'Alice',
  'Bob',
  'Charlie',
  'David',
  'Emma',
  'Farid',
  'Grace',
  'Hiro',
  'Isla',
  'Jun',
  'Kavya',
  'Leo',
];

const DINNER_FOR_TWELVE: PresetDefinition = {
  id: 'dinner-for-twelve',
  label: 'Dinner for 12',
  peopleNames: EVERYONE_AT_DINNER,
  payerMobile: '81234567',
  receipts: [
    {
      name: 'Dinner',
      serviceChargePercent: '10',
      gstPercent: '',
      total: '166.98',
      items: [
        { name: 'Genki Forest', price: '2.50', claim: 'Alice' },
        { name: 'Jasmine Tea', price: '2.50', claim: 'Bob' },
        { name: 'Homemade Barley (warm)', price: '2.00', claim: 'Charlie' },
        { name: 'Chinese Tea (hot)', price: '1.80', claim: EVERYONE_AT_DINNER },
        { name: 'Homemade Barley (cold)', price: '2.00', claim: 'David' },
        { name: 'Chicken Gizzard', price: '3.00', claim: ['Emma', 'Farid'] },
        { name: 'Grilled Chicken Hearts', price: '4.00', claim: ['Grace', 'Hiro', 'Isla'] },
        { name: 'Flammulina (set)', price: '4.80', claim: EVERYONE_AT_DINNER },
        { name: 'Grilled Eggplant with Garlic', price: '5.00', claim: ['Jun', 'Kavya'] },
        { name: 'Grilled Pork Belly', price: '4.80', claim: { Leo: 2, Alice: 1 } },
        { name: 'Chives (set)', price: '4.80', claim: ['Bob', 'Charlie', 'David', 'Emma'] },
        { name: 'Lamb Kebab', price: '3.90', claim: 'Farid' },
        {
          name: 'Charcoal Grilled Scallops',
          price: '17.50',
          claim: { Grace: 2, Hiro: 1, Isla: 1, Jun: 1 },
        },
        { name: 'Rice', price: '6.40', claim: EVERYONE_AT_DINNER },
        { name: 'Green Chilli with Century Egg', price: '7.80', claim: ['Kavya', 'Leo'] },
        { name: 'Sweet and Sour Fish', price: '14.80', claim: EVERYONE_AT_DINNER },
        {
          name: 'Mala Baby Lobster',
          price: '23.80',
          claim: { Alice: 1, Bob: 2, Charlie: 1, David: 1 },
        },
        { name: 'Dried Chilli Chicken', price: '18.80', claim: EVERYONE_AT_DINNER.slice(0, 6) },
        { name: 'Twice Cooked Pork', price: '12.80', claim: EVERYONE_AT_DINNER.slice(6) },
        { name: 'French Beans with Minced Pork', price: '8.80', claim: EVERYONE_AT_DINNER },
      ],
    },
  ],
};

/** An empty percent leaves the charge off, e.g. a receipt with no GST line. */
function percentCharge(fallback: ChargeState, percent: string): ChargeState {
  return percent
    ? { ...fallback, enabled: true, mode: 'percent', percentInput: percent }
    : { ...fallback, enabled: false };
}

function buildAssignment(
  claim: PresetClaim,
  idByName: Map<string, string>,
): EditableItem['assignment'] {
  const toId = (name: string) => {
    const id = idByName.get(name);
    if (!id) throw new Error(`Preset claim names unknown person "${name}"`);
    return id;
  };

  if (typeof claim === 'string') {
    return { mode: 'equal', personId: '', personIds: [toId(claim)] };
  }
  if (Array.isArray(claim)) {
    return { mode: 'equal', personId: '', personIds: claim.map(toId) };
  }
  const entries = Object.entries(claim).map(([name, weight]) => [toId(name), weight] as const);
  return {
    mode: 'equal',
    personId: '',
    personIds: entries.map(([id]) => id),
    weights: Object.fromEntries(entries),
  };
}

function buildPresetDraft(definition: PresetDefinition): SessionDraft {
  const people: Person[] = definition.peopleNames.map((name) => ({ id: createId(), name }));
  const idByName = new Map(people.map((person) => [person.name, person.id]));

  const receipts: Receipt[] = definition.receipts.map((receipt) => ({
    id: createId(),
    name: receipt.name,
    items: receipt.items.map((item) => ({
      id: createId(),
      name: item.name,
      amountInput: item.price,
      discountPercentInput: '',
      assignment: buildAssignment(item.claim, idByName),
    })),
    discount: { ...defaultDiscountState },
    serviceCharge: percentCharge(defaultServiceChargeState, receipt.serviceChargePercent),
    gst: percentCharge(defaultGstState, receipt.gstPercent),
    receiptTotalInput: receipt.total,
    currency: BASE_CURRENCY,
    exchangeRateOverride: null,
  }));

  return {
    version: 2,
    people,
    receipts,
    activeReceiptId: receipts[0].id,
    payerMobile: definition.payerMobile,
    savedAt: new Date().toISOString(),
  };
}

function describePreset(definition: PresetDefinition): string {
  const itemCount = definition.receipts.reduce((count, receipt) => count + receipt.items.length, 0);
  return `${definition.peopleNames.length} people · ${itemCount} items`;
}

export const PRESET_WORKSPACES: PresetWorkspace[] = [LUNCH_FOR_THREE, DINNER_FOR_TWELVE].map(
  (definition) => ({
    id: definition.id,
    label: definition.label,
    description: describePreset(definition),
    build: () => buildPresetDraft(definition),
  }),
);
