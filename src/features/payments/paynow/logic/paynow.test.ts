import { describe, it, expect } from 'vitest';
import { normalizeMobile, buildPaynowString } from './paynow';

function computeCrc16(str: string): number {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/** Reads an EMV QR payload the way a bank app does: two-digit id, two-digit length, value. */
function readTlv(payload: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let at = 0;
  while (at < payload.length) {
    const id = payload.slice(at, at + 2);
    const length = Number(payload.slice(at + 2, at + 4));
    fields[id] = payload.slice(at + 4, at + 4 + length);
    at += 4 + length;
  }
  return fields;
}

function readPaynow(payload: string) {
  const { '26': merchantAccount, ...fields } = readTlv(payload);
  return { ...fields, '26': readTlv(merchantAccount) };
}

// ─── normalizeMobile ─────────────────────────────────────────────────────────

describe('normalizeMobile', () => {
  it('accepts canonical +65 format', () => {
    expect(normalizeMobile('+6591234567')).toBe('+6591234567');
  });

  it('accepts 65-prefixed without +', () => {
    expect(normalizeMobile('6591234567')).toBe('+6591234567');
  });

  it('accepts bare 8-digit number starting with 9', () => {
    expect(normalizeMobile('91234567')).toBe('+6591234567');
  });

  it('accepts bare 8-digit number starting with 8', () => {
    expect(normalizeMobile('81234567')).toBe('+6581234567');
  });

  it('strips spaces', () => {
    expect(normalizeMobile('+65 9123 4567')).toBe('+6591234567');
  });

  it('strips dashes', () => {
    expect(normalizeMobile('+65-9123-4567')).toBe('+6591234567');
  });

  it('returns null for empty string', () => {
    expect(normalizeMobile('')).toBeNull();
  });

  it('returns null for number starting with wrong digit (7)', () => {
    expect(normalizeMobile('71234567')).toBeNull();
  });

  it('returns null for 7-digit number', () => {
    expect(normalizeMobile('9123456')).toBeNull();
  });

  it('returns null for 9-digit number', () => {
    expect(normalizeMobile('912345678')).toBeNull();
  });

  it('returns null for letters', () => {
    expect(normalizeMobile('hello')).toBeNull();
  });

  it('returns null when extra digits come before a valid number', () => {
    expect(normalizeMobile('191234567')).toBeNull();
    expect(normalizeMobile('1291234567')).toBeNull();
  });

  it('returns null for wrong country code length', () => {
    // 11 digits total but not matching 65+8
    expect(normalizeMobile('12345678901')).toBeNull();
  });
});

// ─── buildPaynowString ────────────────────────────────────────────────────────

describe('buildPaynowString', () => {
  const mobile = '+6591234567';
  const amountCents = 1250; // $12.50

  it('asks the bank app for a fixed SGD amount to this mobile number', () => {
    const str = buildPaynowString(mobile, amountCents);

    expect(readPaynow(str)).toEqual({
      '00': '01', // payload format
      '01': '12', // dynamic QR, used once
      '26': {
        '00': 'SG.PAYNOW',
        '01': '0', // the proxy is a mobile number
        '02': '+6591234567',
        '03': '0', // the payer cannot edit the amount
      },
      '53': '702', // SGD
      '54': '12.50',
      '60': 'Singapore',
      '63': str.slice(-4),
    });
  });

  // $1.31 has a checksum below 0x1000, which must still be written as four characters.
  it.each([1250, 131])('writes a correct four-character CRC for %i cents', (cents) => {
    const str = buildPaynowString(mobile, cents);
    // The CRC covers everything up to and including the "6304" tag+length
    const payloadForCrc = str.slice(0, -4);
    const expectedCrc = computeCrc16(payloadForCrc).toString(16).toUpperCase().padStart(4, '0');
    expect(str.slice(-8)).toBe(`6304${expectedCrc}`);
  });

  it('normalises a bare 8-digit number before putting it in the payload', () => {
    expect(readPaynow(buildPaynowString('91234567', amountCents))['26']['02']).toBe('+6591234567');
  });

  it('throws for invalid mobile', () => {
    expect(() => buildPaynowString('invalid', amountCents)).toThrow(
      'Invalid PayNow mobile number: "invalid"',
    );
  });

  it.each([
    [500, '5.00'],
    [50, '0.50'],
    [123456, '1234.56'],
  ])('writes %i cents as the amount %s', (cents, amount) => {
    expect(readTlv(buildPaynowString(mobile, cents))['54']).toBe(amount);
  });
});
