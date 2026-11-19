import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deviceMintRequestSchema } from '@shared/api/devices';
import type { DeviceMintResponse } from '@shared/api/devices';
import type { AppContext, Services } from '../app';
import { resolveClientIp } from '../http/clientIp';
import { verifyTurnstile } from '../turnstile/verifyTurnstile';
import { failWith } from './errors';

const MAX_MINT_BODY_BYTES = 8 * 1024;

export function devicesRoute({ env, counters, devices, fetchImpl }: Services): Hono<AppContext> {
  const route = new Hono<AppContext>();
  const capBody = bodyLimit({
    maxSize: MAX_MINT_BODY_BYTES,
    onError: (c) => failWith(c, 413, 'unknown'),
  });
  route.post('/', capBody, async (c) => {
    const client = resolveClientIp({
      trustCfConnectingIp: env.TRUST_CF_CONNECTING_IP,
      cfConnectingIp: c.req.header('CF-Connecting-IP') ?? null,
      socketAddress: c.env?.incoming?.socket.remoteAddress,
    });
    if (!client.ok) return failWith(c, 400, 'misconfigured');

    const body = deviceMintRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return failWith(c, 400, 'unknown');

    const verdict = await verifyTurnstile({
      secret: env.TURNSTILE_SECRET,
      token: body.data.turnstileToken,
      ip: env.TRUST_CF_CONNECTING_IP ? client.ip : null,
      fetchImpl,
    });
    if (verdict === 'fail') return failWith(c, 403, 'bot-check-failed');
    if (verdict === 'unavailable') return failWith(c, 503, 'unreachable');

    const minted = counters.reserveMint(client.ip, env.DEVICE_MINT_LIMIT_PER_IP);
    if (!minted.ok) {
      return failWith(c, 429, 'over-limit', {
        scope: 'mint',
        retryAfterSeconds: minted.retryAfterSeconds,
      });
    }
    const response: DeviceMintResponse = { token: devices.mint() };
    return c.json(response);
  });
  return route;
}
