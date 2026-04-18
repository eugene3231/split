/**
 * PayNow QR code string builder (EMVCo / SGQR format).
 *
 * Generates the TLV payload string that can be rendered into a QR code by
 * any standard QR library (e.g. the `qrcode` npm package).  When scanned by
 * a Singapore banking app the app pre-fills the recipient and amount.
 *
 * Reference: MAS SGQR specification (based on EMVCo Merchant-Presented QR).
 */

// ─── CRC16-CCITT ─────────────────────────────────────────────────────────────

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — required by the SGQR spec. */
export function crc16(str: string): number {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

// ─── TLV helpers ─────────────────────────────────────────────────────────────

/** Encode a single EMVCo TLV field: ID (2 chars) + length (2 chars, zero-padded) + value. */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return id + len + value;
}

// ─── Mobile normalisation ─────────────────────────────────────────────────────

/**
 * Normalise a raw PayNow mobile number input to the canonical `+65XXXXXXXX` form.
 *
 * Accepts:
 *   - `+6591234567`  (already canonical)
 *   - `6591234567`   (country code without +)
 *   - `91234567`     (bare 8-digit SG number)
 *
 * Returns `null` if the input cannot be normalised to a valid SG mobile number.
 */
export function normalizeMobile(raw: string): string | null {
  // Strip all spaces, dashes, and parentheses.
  const stripped = raw.replace(/[\s\-()]/g, '');

  let digits: string;

  if (stripped.startsWith('+65')) {
    digits = stripped.slice(3);
  } else if (stripped.startsWith('65') && stripped.length === 10) {
    digits = stripped.slice(2);
  } else {
    digits = stripped;
  }

  // SG mobile numbers are exactly 8 digits and start with 8 or 9.
  if (!/^[89]\d{7}$/.test(digits)) {
    return null;
  }

  return `+65${digits}`;
}

// ─── PayNow string builder ───────────────────────────────────────────────────

/**
 * Build the PayNow QR payload string for a peer-to-peer transfer.
 *
 * @param mobile      Recipient's Singapore mobile number (any accepted format —
 *                    will be normalised internally).
 * @param amountCents Amount owed in SGD cents (integer).  Must be ≥ 1.
 * @returns           The full SGQR/EMVCo TLV string, including CRC checksum.
 *                    Pass this directly to `QRCode.toDataURL(string)`.
 * @throws            If `mobile` is not a valid SG mobile number.
 */
export function buildPaynowString(mobile: string, amountCents: number): string {
  const normalised = normalizeMobile(mobile);
  if (!normalised) {
    throw new Error(`Invalid PayNow mobile number: "${mobile}"`);
  }

  const amount = (amountCents / 100).toFixed(2);

  // ID 26 — Merchant Account Information (PayNow-specific sub-TLVs)
  const merchantAccountInfo = tlv(
    '26',
    tlv('00', 'SG.PAYNOW') + // GUID
      tlv('01', '0') + // Proxy type: 0 = mobile
      tlv('02', normalised) + // Proxy value
      tlv('03', '0'), // Amount editable: 0 = fixed
  );

  // Build the payload up to (but not including) the CRC value itself.
  const payloadWithoutCrc =
    tlv('00', '01') + // Payload Format Indicator
    tlv('01', '12') + // Point of Initiation: 12 = dynamic
    merchantAccountInfo +
    tlv('53', '702') + // Transaction Currency: 702 = SGD
    tlv('54', amount) + // Transaction Amount
    tlv('60', 'Singapore') + // Merchant City
    '6304'; // CRC field ID + length (value appended below)

  const checksum = crc16(payloadWithoutCrc).toString(16).toUpperCase().padStart(4, '0');
  return payloadWithoutCrc + checksum;
}
