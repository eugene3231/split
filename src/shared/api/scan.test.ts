import { describe, expect, it } from 'vitest';
import {
  SCAN_ERROR_KINDS,
  apiErrorBodySchema,
  asksForKey,
  fallbackKindFromStatus,
  scanResponseSchema,
} from './scan';

describe('which scan failures ask for a key', () => {
  it('asks for a key for every kind except a bad photo and a missing pass', () => {
    const quiet = SCAN_ERROR_KINDS.filter((kind) => !asksForKey(kind));
    expect(quiet).toEqual(['needs-device', 'bad-image']);
  });
});

describe('reading a status when the body is not ours', () => {
  it.each([
    [401, 'needs-device'],
    [403, 'bot-check-failed'],
    [413, 'bad-image'],
    [415, 'bad-image'],
    [422, 'bad-image'],
    [429, 'over-limit'],
    [408, 'unreachable'],
    [502, 'unreachable'],
    [503, 'unreachable'],
    [504, 'unreachable'],
    [522, 'unreachable'],
    [530, 'unreachable'],
    [500, 'unknown'],
    [404, 'unknown'],
  ])('maps %i to %s', (status, kind) => {
    expect(fallbackKindFromStatus(status)).toBe(kind);
  });
});

describe('parsing server bodies', () => {
  it('accepts an error body with a scope', () => {
    expect(apiErrorBodySchema.parse({ kind: 'over-limit', scope: 'device' })).toEqual({
      kind: 'over-limit',
      scope: 'device',
    });
  });

  it('rejects an error kind it does not know', () => {
    expect(apiErrorBodySchema.safeParse({ kind: 'teapot' }).success).toBe(false);
  });

  it('rejects a scan response without a receipt', () => {
    expect(scanResponseSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it('accepts a full receipt', () => {
    const charge = {
      enabled: false,
      amount: null,
      percent: null,
      confidence: null,
      source: 'none',
    };
    const body = {
      receipt: {
        items: [{ description: 'Noodles', amount: 6.5 }],
        subtotal: 6.5,
        total: null,
        detected: { gst: charge, serviceCharge: charge },
        warnings: [],
      },
    };
    expect(scanResponseSchema.parse(body)).toEqual(body);
  });
});
