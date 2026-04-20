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

  it('returns null for wrong country code length', () => {
    // 11 digits total but not matching 65+8
    expect(normalizeMobile('12345678901')).toBeNull();
  });
});

// ─── buildPaynowString ────────────────────────────────────────────────────────

describe('buildPaynowString', () => {
  const mobile = '+6591234567';
  const amountCents = 1250; // $12.50

  it('starts with payload format indicator 000201', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str.startsWith('000201')).toBe(true);
  });

  it('contains SG.PAYNOW GUID', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str).toContain('SG.PAYNOW');
  });

  it('contains the normalised mobile number', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str).toContain('+6591234567');
  });

  it('contains the correct amount formatted as decimal', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str).toContain('12.50');
  });

  it('contains SGD currency code 702', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str).toContain('5303702');
  });

  it('contains Singapore city', () => {
    const str = buildPaynowString(mobile, amountCents);
    expect(str).toContain('Singapore');
  });

  it('ends with a 4-char hex CRC after "6304"', () => {
    const str = buildPaynowString(mobile, amountCents);
    const crcIdx = str.lastIndexOf('6304');
    expect(crcIdx).toBeGreaterThan(-1);
    const crcPart = str.slice(crcIdx + 4);
    expect(crcPart).toHaveLength(4);
    expect(/^[0-9A-F]{4}$/.test(crcPart)).toBe(true);
  });

  it('the CRC is correct (verify by recomputing)', () => {
    const str = buildPaynowString(mobile, amountCents);
    // The CRC covers everything up to and including the "6304" tag+length
    const payloadForCrc = str.slice(0, str.lastIndexOf('6304') + 4);
    const expectedCrc = computeCrc16(payloadForCrc).toString(16).toUpperCase().padStart(4, '0');
    const actualCrc = str.slice(-4);
    expect(actualCrc).toBe(expectedCrc);
  });

  it('accepts bare 8-digit number (normalises internally)', () => {
    expect(() => buildPaynowString('91234567', amountCents)).not.toThrow();
    const str = buildPaynowString('91234567', amountCents);
    expect(str).toContain('+6591234567');
  });

  it('throws for invalid mobile', () => {
    expect(() => buildPaynowString('invalid', amountCents)).toThrow();
  });

  it('formats whole dollar amounts correctly', () => {
    const str = buildPaynowString(mobile, 500); // $5.00
    expect(str).toContain('5.00');
  });

  it('formats sub-dollar amounts correctly', () => {
    const str = buildPaynowString(mobile, 50); // $0.50
    expect(str).toContain('0.50');
  });

  it('produces different strings for different amounts', () => {
    const a = buildPaynowString(mobile, 100);
    const b = buildPaynowString(mobile, 200);
    expect(a).not.toBe(b);
  });

  it('produces different strings for different mobile numbers', () => {
    const a = buildPaynowString('+6591234567', 1000);
    const b = buildPaynowString('+6598765432', 1000);
    expect(a).not.toBe(b);
  });
});
