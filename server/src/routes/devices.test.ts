import { afterEach, describe, expect, it } from 'vitest';
import { DOWN_TOKEN, FAIL_TOKEN, PASS_TOKEN, startHarness } from '../../test/harness';
import type { Harness } from '../../test/harness';

let harness: Harness;
afterEach(() => harness.close());

function mint(h: Harness, token: string, headers: Record<string, string> = {}) {
  return h.app.request('/api/v1/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ turnstileToken: token }),
  });
}

describe('minting a device pass', () => {
  it('hands out a token after Turnstile passes', async () => {
    harness = await startHarness();
    const response = await mint(harness, PASS_TOKEN);
    expect(response.status).toBe(200);
    const { token } = (await response.json()) as { token: string };
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('refuses with bot-check-failed when Turnstile fails', async () => {
    harness = await startHarness();
    const response = await mint(harness, FAIL_TOKEN);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ kind: 'bot-check-failed' });
    expect(harness.db.prepare('SELECT COUNT(*) AS n FROM devices').get()).toEqual({ n: 0 });
  });

  it('says unreachable when Turnstile itself is down', async () => {
    harness = await startHarness();
    const response = await mint(harness, DOWN_TOKEN);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ kind: 'unreachable' });
  });

  it('refuses the 11th mint from one address and still serves another address', async () => {
    harness = await startHarness({ TRUST_CF_CONNECTING_IP: '1' });
    const from = (ip: string) => mint(harness, PASS_TOKEN, { 'CF-Connecting-IP': ip });
    for (let i = 0; i < 10; i++) expect((await from('203.0.113.7')).status).toBe(200);
    const refused = await from('203.0.113.7');
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ kind: 'over-limit', scope: 'mint' });
    expect(refused.headers.get('Retry-After')).toBe('43200');
    expect((await from('203.0.113.8')).status).toBe(200);
  });

  it('answers misconfigured before it asks Turnstile when the header is missing and trusted', async () => {
    harness = await startHarness({ TRUST_CF_CONNECTING_IP: '1' });
    const response = await mint(harness, DOWN_TOKEN);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ kind: 'misconfigured' });
  });

  it('rejects a body without a Turnstile token', async () => {
    harness = await startHarness();
    const response = await harness.app.request('/api/v1/devices', { method: 'POST', body: '{}' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ kind: 'unknown' });
  });
});
