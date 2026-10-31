import type { OcrResponse } from '@shared/types';
import { SCAN_PATH, scanResponseSchema } from '@shared/api/scan';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import {
  clearDeviceToken,
  loadDeviceToken,
  mintDeviceToken,
} from '@features/receipt-scanner/api/deviceToken';
import { readServerError } from '@features/receipt-scanner/api/serverError';
import { requestTurnstileToken } from '@features/receipt-scanner/stores/turnstileStore';

const SCAN_TIMEOUT_MS = 60_000;

export async function scanViaServer(file: File, apiUrl: string): Promise<OcrResponse> {
  const stored = loadDeviceToken();
  if (stored) {
    try {
      return await postScan(apiUrl, file, stored);
    } catch (error) {
      if (!isNeedsDevice(error)) throw error;
      clearDeviceToken();
    }
  }

  const fresh = await mintDeviceToken(apiUrl, await requestTurnstileToken());
  try {
    return await postScan(apiUrl, file, fresh);
  } catch (error) {
    throw isNeedsDevice(error) ? new ScanError('unknown') : error;
  }
}

function isNeedsDevice(error: unknown): boolean {
  return error instanceof ScanError && error.kind === 'needs-device';
}

async function postScan(apiUrl: string, file: File, token: string): Promise<OcrResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${SCAN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        Authorization: `Bearer ${token}`,
      },
      body: file,
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
  } catch {
    throw new ScanError('unreachable');
  }
  if (!response.ok) throw await readServerError(response);

  const body = scanResponseSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) throw new ScanError('unknown');
  return body.data.receipt;
}
