import { z } from 'zod';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const siteverifyResponse = z.object({ success: z.boolean() });

export type TurnstileResult = 'pass' | 'fail' | 'unavailable';

interface VerifyTurnstileOptions {
  secret: string;
  token: string;
  ip: string | null;
  fetchImpl: typeof fetch;
}

export async function verifyTurnstile(options: VerifyTurnstileOptions): Promise<TurnstileResult> {
  const form = new URLSearchParams({ secret: options.secret, response: options.token });
  if (options.ip) form.set('remoteip', options.ip);
  try {
    const response = await options.fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return 'unavailable';
    const parsed = siteverifyResponse.safeParse(await response.json());
    if (!parsed.success) return 'unavailable';
    return parsed.data.success ? 'pass' : 'fail';
  } catch {
    return 'unavailable';
  }
}
