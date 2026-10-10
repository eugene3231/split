import { describe, expect, it } from 'vitest';
import {
  amountCharge,
  makeItem,
  makeReceipt,
  percentCharge,
} from '../../../tests/integration/testHelpers';
import {
  buildSharedReceipt,
  decodeSharedReceipt,
  encodeSharedReceipt,
  resolveMyShare,
  type SharedReceipt,
} from './shareLink';

const dinner: SharedReceipt = {
  name: 'Dinner at Jumbo',
  currency: 'SGD',
  people: ['Ana', 'Ben', 'Cai'],
  payerName: 'Ana',
  payerMobile: '91234567',
  items: [
    { name: 'Chilli crab', cents: 8800 },
    { name: 'Tiger × 3', cents: 2700 },
    { name: 'Mantou', cents: 500 },
  ],
  subtotalCents: 12000,
  totalCents: 14388,
};

describe('encodeSharedReceipt / decodeSharedReceipt', () => {
  it('round-trips a receipt through a URL-safe string', () => {
    const encoded = encodeSharedReceipt(dinner);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSharedReceipt(encoded)).toEqual(dinner);
  });

  it('keeps non-ASCII item names intact', () => {
    const receipt = { ...dinner, items: [{ name: '海南鸡饭 ×2', cents: 1000 }] };

    expect(decodeSharedReceipt(encodeSharedReceipt(receipt))?.items[0].name).toBe('海南鸡饭 ×2');
  });

  it('rejects a link that has been cut short or tampered with', () => {
    const encoded = encodeSharedReceipt(dinner);

    expect(decodeSharedReceipt(encoded.slice(0, 20))).toBeNull();
    expect(decodeSharedReceipt('not-a-receipt')).toBeNull();
  });
});

describe('resolveMyShare', () => {
  it('adds charges in proportion to the items claimed', () => {
    expect(resolveMyShare(dinner, { 2: 1 })).toEqual({
      itemsCents: 500,
      chargesCents: 100,
      totalCents: 600,
    });
  });

  it('divides a shared item by the number of people sharing it', () => {
    expect(resolveMyShare(dinner, { 0: 2, 1: 3 }).itemsCents).toBe(5300);
  });

  it('owes nothing when nothing is claimed', () => {
    expect(resolveMyShare(dinner, {})).toEqual({ itemsCents: 0, chargesCents: 0, totalCents: 0 });
  });
});

describe('buildSharedReceipt', () => {
  it('captures discounted item prices and the whole-receipt charges', () => {
    const receipt = makeReceipt({
      name: 'Lunch',
      items: [
        makeItem({ name: 'Laksa', amountInput: '10.00' }),
        makeItem({ name: 'Kopi', amountInput: '4.00', discountPercentInput: '50' }),
        makeItem({ name: '', amountInput: '' }),
      ],
      serviceCharge: percentCharge('10'),
      gst: amountCharge('1.00'),
    });

    const shared = buildSharedReceipt(receipt, ['Ana', 'Ben'], { name: 'Ana', mobile: '' });

    expect(shared.items).toEqual([
      { name: 'Laksa', cents: 1000 },
      { name: 'Kopi', cents: 200 },
    ]);
    expect(shared.subtotalCents).toBe(1200);
    expect(shared.totalCents).toBe(1420);
  });
});
