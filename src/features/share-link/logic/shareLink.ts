import { z } from 'zod';
import { resolveDiscountedAmountCents } from '@shared/logic/split/pricing';
import { computeSplit } from '@shared/logic/split/split';
import type { Receipt } from '@shared/types';

export interface SharedItem {
  name: string;
  cents: number;
}

export interface SharedReceipt {
  name: string;
  currency: string;
  people: string[];
  payerName: string;
  payerMobile: string;
  items: SharedItem[];
  subtotalCents: number;
  totalCents: number;
}

/** How many people a claimed item is shared between, keyed by item index. */
export type Claims = Record<number, number>;

export interface MyShare {
  itemsCents: number;
  chargesCents: number;
  totalCents: number;
}

const encodedSchema = z.object({
  v: z.literal(1),
  n: z.string(),
  c: z.string(),
  p: z.array(z.string()),
  pn: z.string(),
  pm: z.string(),
  i: z.array(z.tuple([z.string(), z.number().int().nonnegative()])),
  s: z.number().int().nonnegative(),
  t: z.number().int().nonnegative(),
});

/**
 * Resolves the receipt as a whole, regardless of who it's assigned to, so the
 * friend's share can carry the same proportional charges as the organizer's split.
 */
export function buildSharedReceipt(
  receipt: Receipt,
  people: string[],
  payer: { name: string; mobile: string },
): SharedReceipt {
  const whole = { id: 'whole', name: 'Whole receipt' };
  const split = computeSplit({
    people: [whole],
    items: receipt.items.map((item) => ({
      ...item,
      assignment: { mode: 'equal', personId: '', personIds: [whole.id] },
    })),
    discount: receipt.discount,
    serviceCharge: receipt.serviceCharge,
    gst: receipt.gst,
  });

  const items = receipt.items.flatMap((item) => {
    const cents = resolveDiscountedAmountCents(item);
    return cents ? [{ name: item.name.trim() || 'Untitled item', cents }] : [];
  });

  return {
    name: receipt.name,
    currency: receipt.currency,
    people,
    payerName: payer.name,
    payerMobile: payer.mobile,
    items,
    subtotalCents: split.subtotalCents,
    totalCents: split.grandTotalCents,
  };
}

export function encodeSharedReceipt(receipt: SharedReceipt): string {
  const json = JSON.stringify({
    v: 1,
    n: receipt.name,
    c: receipt.currency,
    p: receipt.people,
    pn: receipt.payerName,
    pm: receipt.payerMobile,
    i: receipt.items.map((item) => [item.name, item.cents]),
    s: receipt.subtotalCents,
    t: receipt.totalCents,
  });
  const binary = Array.from(new TextEncoder().encode(json), (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharedReceipt(encoded: string): SharedReceipt | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    const parsed = encodedSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;

    const d = parsed.data;
    return {
      name: d.n,
      currency: d.c,
      people: d.p,
      payerName: d.pn,
      payerMobile: d.pm,
      items: d.i.map(([name, cents]) => ({ name, cents })),
      subtotalCents: d.s,
      totalCents: d.t,
    };
  } catch {
    return null;
  }
}

export function resolveMyShare(receipt: SharedReceipt, claims: Claims): MyShare {
  const itemsCents = Object.entries(claims).reduce((sum, [index, splitCount]) => {
    const item = receipt.items[Number(index)];
    return item ? sum + Math.round(item.cents / splitCount) : sum;
  }, 0);

  const totalCents =
    receipt.subtotalCents > 0
      ? Math.round((itemsCents * receipt.totalCents) / receipt.subtotalCents)
      : itemsCents;

  return { itemsCents, chargesCents: totalCents - itemsCents, totalCents };
}
