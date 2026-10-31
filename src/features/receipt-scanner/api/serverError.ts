import { apiErrorBodySchema, fallbackKindFromStatus } from '@shared/api/scan';
import { ScanError } from '@features/receipt-scanner/logic/scanError';

/** The body's kind wins; the status decides only when the body does not parse. */
export async function readServerError(response: Response): Promise<ScanError> {
  const body = apiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (body.success) return new ScanError(body.data.kind, body.data.scope);
  return new ScanError(fallbackKindFromStatus(response.status));
}
