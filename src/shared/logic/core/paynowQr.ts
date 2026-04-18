import QRCode from 'qrcode';
import type { Person, SplitResult } from '@shared/types';
import { buildPaynowString, normalizeMobile } from './paynow';

/**
 * Generate PayNow QR data URLs for each person.
 * Returns an empty object if `payerMobile` is invalid or empty.
 * Persons with zero or negative amounts get an empty string value.
 */
export async function generatePaynowQrDataUrls(
  people: Person[],
  split: SplitResult,
  payerMobile: string,
  qrSize = 160,
): Promise<Record<string, string>> {
  const normalised = normalizeMobile(payerMobile);
  if (!normalised) return {};
  const entries = await Promise.all(
    people.map(async (person) => {
      const amountCents = split.totalByPersonCents[person.id] ?? 0;
      if (amountCents <= 0) return [person.id, ''] as const;
      try {
        const paynowStr = buildPaynowString(normalised, amountCents);
        const dataUrl = await QRCode.toDataURL(paynowStr, { width: qrSize, margin: 1 });
        return [person.id, dataUrl] as const;
      } catch {
        return [person.id, ''] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
