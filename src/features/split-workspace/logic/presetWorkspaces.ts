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

/** A percent or a fixed amount; null leaves the charge off, e.g. a receipt with no GST line. */
type PresetCharge = { percent: string } | { amount: string } | null;

interface PresetReceipt {
  name: string;
  currency?: string;
  items: PresetItem[];
  serviceCharge: PresetCharge;
  gst: PresetCharge;
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
      serviceCharge: { percent: '10' },
      gst: { percent: '9' },
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
      serviceCharge: { percent: '10' },
      gst: null,
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

const BALI_TRIP = ['Eugene', 'Sam', 'Moses', 'Glen', 'Beelee'];

// Copied from a real Split export. Alchemy Cafe and Ulekan Berawa were tagged SGD and Alchemy
// Cafe's total read 329.98; both are corrected to rupiah here.
const BALI_TRIP_FOR_FIVE: PresetDefinition = {
  id: 'bali-trip-for-five',
  label: 'Bali trip for 5',
  peopleNames: BALI_TRIP,
  payerMobile: '',
  receipts: [
    {
      name: 'Woods pererenan',
      currency: 'IDR',
      serviceCharge: { amount: '71750.00' },
      gst: { amount: '109675.00' },
      total: '1206500.00',
      items: [
        { name: 'Osmathus Flower', price: '50000.00', claim: 'Moses' },
        { name: 'Ice Cappucino', price: '55000.00', claim: 'Sam' },
        { name: 'Extra Almond Milk', price: '15000.00', claim: 'Sam' },
        { name: 'Ice Matcha Latte', price: '55000.00', claim: 'Glen' },
        { name: 'Extra Oat Milk', price: '15000.00', claim: 'Glen' },
        { name: 'Bamboo Benny', price: '95000.00', claim: 'Sam' },
        { name: '#Add Ham', price: '25000.00', claim: 'Sam' },
        { name: 'Buckwheat Pancakes', price: '105000.00', claim: BALI_TRIP },
        { name: 'Pan Seared Barramundi', price: '270000.00', claim: ['Moses', 'Eugene'] },
        { name: 'Moroccan Shakshouka', price: '105000.00', claim: 'Glen' },
        { name: '#Add Pork Sausage', price: '40000.00', claim: 'Glen' },
        { name: 'Pandan Pannacea', price: '50000.00', claim: 'Eugene' },
        { name: 'Green V', price: '55000.00', claim: 'Beelee' },
        { name: 'Scrambled Egg On Toast', price: '90000.00', claim: 'Beelee' },
      ],
    },
    {
      name: 'Alchemy Cafe',
      currency: 'IDR',
      serviceCharge: { amount: '16980' },
      gst: { amount: '30000' },
      total: '329980',
      items: [
        { name: 'ACAI BOWL', price: '139000', claim: ['Sam', 'Eugene'] },
        { name: 'PB&J SMOOTHIE', price: '75000', claim: 'Beelee' },
        { name: 'BANOFFEE PIE', price: '69000', claim: 'Beelee' },
      ],
    },
    {
      name: 'Ulekan Berawa',
      currency: 'IDR',
      serviceCharge: { amount: '79100.00' },
      gst: { amount: '120910.00' },
      total: '1330010.00',
      items: [
        { name: 'homemade turmeric jamu', price: '65000.00', claim: 'Beelee' },
        { name: 'mocktails-pina colada (1gls)', price: '75000.00', claim: 'Glen' },
        { name: 'reflection still water (1ge)', price: '65000.00', claim: BALI_TRIP },
        { name: 'healty juice - clean green', price: '60000.00', claim: 'Sam' },
        { name: 'arak (50ml) - by pak jero', price: '85000.00', claim: 'Moses' },
        { name: 'ayam betutu', price: '150000.00', claim: ['Eugene', 'Moses', 'Glen', 'Beelee'] },
        { name: 'rendang sapi', price: '170000.00', claim: ['Eugene', 'Moses', 'Glen', 'Beelee'] },
        { name: 'bebek goreng', price: '145000.00', claim: ['Eugene', 'Moses', 'Glen', 'Beelee'] },
        { name: 'urap urap', price: '60000.00', claim: ['Eugene', 'Moses', 'Glen', 'Beelee'] },
        { name: 'nasi campur', price: '120000.00', claim: 'Sam' },
        { name: 'nasi putih', price: '20000.00', claim: ['Eugene', 'Moses', 'Glen', 'Beelee'] },
        { name: 'nasi merah', price: '25000.00', claim: ['Moses', 'Glen', 'Beelee'] },
        { name: 'nasi kuning', price: '25000.00', claim: ['Moses', 'Glen', 'Beelee'] },
        { name: 'pisang goreng', price: '65000.00', claim: ['Sam', 'Moses', 'Glen', 'Beelee'] },
      ],
    },
  ],
};

function buildCharge(fallback: ChargeState, charge: PresetCharge): ChargeState {
  if (!charge) return { ...fallback, enabled: false };
  if ('amount' in charge)
    return { ...fallback, enabled: true, mode: 'amount', amountInput: charge.amount };
  return { ...fallback, enabled: true, mode: 'percent', percentInput: charge.percent };
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
    serviceCharge: buildCharge(defaultServiceChargeState, receipt.serviceCharge),
    gst: buildCharge(defaultGstState, receipt.gst),
    receiptTotalInput: receipt.total,
    roundingInput: '',
    currency: receipt.currency ?? BASE_CURRENCY,
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
  const receiptCount = definition.receipts.length;
  return [
    `${definition.peopleNames.length} people`,
    receiptCount > 1 && `${receiptCount} receipts`,
    `${itemCount} items`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const PRESET_WORKSPACES: PresetWorkspace[] = [
  LUNCH_FOR_THREE,
  DINNER_FOR_TWELVE,
  BALI_TRIP_FOR_FIVE,
].map((definition) => ({
  id: definition.id,
  label: definition.label,
  description: describePreset(definition),
  build: () => buildPresetDraft(definition),
}));
