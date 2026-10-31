import { z } from 'zod';
import type { OcrResponse } from '@shared/types';

export const SCAN_PATH = '/api/v1/scan';
export const MAX_SCAN_BYTES = 10 * 1024 * 1024;
export const SCAN_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const SCAN_ERROR_KINDS = [
  'needs-device',
  'bot-check-failed',
  'over-limit',
  'bad-image',
  'model-failed',
  'unreachable',
  'no-server',
  'unknown',
  'misconfigured',
] as const;

export type ScanErrorKind = (typeof SCAN_ERROR_KINDS)[number];

const KINDS_THAT_DO_NOT_ASK_FOR_KEY: ReadonlySet<ScanErrorKind> = new Set([
  'bad-image',
  'needs-device',
]);

export function asksForKey(kind: ScanErrorKind): boolean {
  return !KINDS_THAT_DO_NOT_ASK_FOR_KEY.has(kind);
}

export const LIMIT_SCOPES = ['device', 'global', 'mint'] as const;
export type LimitScope = (typeof LIMIT_SCOPES)[number];

export const apiErrorBodySchema = z.object({
  kind: z.enum(SCAN_ERROR_KINDS),
  scope: z.enum(LIMIT_SCOPES).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

const chargeDetectionSchema = z.object({
  enabled: z.boolean(),
  amount: z.number().nullable(),
  percent: z.number().nullable(),
  confidence: z.number().nullable(),
  source: z.string(),
});

const ocrResponseSchema = z.object({
  items: z.array(z.object({ description: z.string(), amount: z.number() })),
  subtotal: z.number().nullable(),
  total: z.number().nullable(),
  detected: z.object({
    gst: chargeDetectionSchema,
    serviceCharge: chargeDetectionSchema,
  }),
  warnings: z.array(z.string()),
}) satisfies z.ZodType<OcrResponse>;

export const scanResponseSchema = z.object({ receipt: ocrResponseSchema });
export type ScanResponse = z.infer<typeof scanResponseSchema>;

export function fallbackKindFromStatus(status: number): ScanErrorKind {
  switch (status) {
    case 401:
      return 'needs-device';
    case 403:
      return 'bot-check-failed';
    case 413:
    case 415:
      return 'bad-image';
    case 429:
      return 'over-limit';
    case 408:
    case 502:
    case 503:
    case 504:
      return 'unreachable';
    default:
      return status >= 520 && status <= 530 ? 'unreachable' : 'unknown';
  }
}
