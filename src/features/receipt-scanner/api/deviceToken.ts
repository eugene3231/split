import {
  DEVICES_PATH,
  deviceMintRequestSchema,
  deviceMintResponseSchema,
} from '@shared/api/devices';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import { readServerError } from '@features/receipt-scanner/api/serverError';

export const DEVICE_TOKEN_KEY = 'split.deviceToken';
const MINT_TIMEOUT_MS = 15_000;

export function loadDeviceToken(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function saveDeviceToken(token: string): void {
  try {
    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    // Storage is full or blocked; the next scan asks for a new pass.
  }
}

export function clearDeviceToken(): void {
  try {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    // Storage is blocked.
  }
}

export async function mintDeviceToken(apiUrl: string, turnstileToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${DEVICES_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceMintRequestSchema.parse({ turnstileToken })),
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    });
  } catch {
    throw new ScanError('unreachable');
  }
  if (!response.ok) throw await readServerError(response);

  const body = deviceMintResponseSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) throw new ScanError('unknown');
  saveDeviceToken(body.data.token);
  return body.data.token;
}
