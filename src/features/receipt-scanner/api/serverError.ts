import { apiErrorBodySchema, fallbackKindFromStatus } from '@shared/api/scan';
import { ScanError } from '@features/receipt-scanner/logic/scanError';

export async function readServerError(response: Response): Promise<ScanError> {
  const body = apiErrorBodySchema.safeParse(await response.json().catch(() => null));
  if (body.success) return new ScanError(body.data.kind, body.data.scope);
  return new ScanError(fallbackKindFromStatus(response.status));
}
