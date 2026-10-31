import { Hono } from 'hono';
import type { ScanResponse } from '@shared/api/scan';
import type { AppContext, Services } from '../app';
import { scanWithGemini } from '../gemini/scanWithGemini';
import { readImage } from '../http/readImage';
import { failWith } from './errors';

const BUSY_RETRY_SECONDS = 5;
const BEARER = /^Bearer (.+)$/;

export function scanRoute({
  env,
  counters,
  devices,
  inFlight,
  fetchImpl,
  bodyTimeoutMs,
  geminiTimeoutMs,
}: Services): Hono<AppContext> {
  const route = new Hono<AppContext>();
  route.post('/', async (c) => {
    const token = BEARER.exec(c.req.header('Authorization') ?? '')?.[1];
    const deviceKey = token ? devices.authenticate(token) : null;
    if (!deviceKey) return failWith(c, 401, 'needs-device');

    const limits = { perDevice: env.SCAN_LIMIT_PER_DEVICE, global: env.SCAN_LIMIT_GLOBAL };
    const allowed = counters.check(deviceKey, limits);
    if (!allowed.ok) {
      return failWith(c, 429, 'over-limit', {
        scope: allowed.scope,
        retryAfterSeconds: allowed.retryAfterSeconds,
      });
    }

    const slot = inFlight.tryAcquire(deviceKey);
    if (!slot) return failWith(c, 503, 'unreachable', { retryAfterSeconds: BUSY_RETRY_SECONDS });
    try {
      const image = await readImage({
        contentType: c.req.header('Content-Type') ?? null,
        contentLength: c.req.header('Content-Length') ?? null,
        body: c.req.raw.body,
        timeoutMs: bodyTimeoutMs,
      });
      if (!image.ok) return failWith(c, image.status, image.kind);
      c.var.requestLog.bytes = image.bytes.byteLength;

      const reserved = counters.reserve(deviceKey, limits);
      if (!reserved.ok) {
        return failWith(c, 429, 'over-limit', {
          scope: reserved.scope,
          retryAfterSeconds: reserved.retryAfterSeconds,
        });
      }

      const scan = await scanWithGemini({
        apiKey: env.GEMINI_API_KEY,
        model: env.SCAN_MODEL,
        baseUrl: env.GEMINI_BASE_URL,
        bytes: image.bytes,
        mimeType: image.mimeType,
        fetchImpl,
        timeoutMs: geminiTimeoutMs,
      });

      if (scan.outcome === 'bad-image') return failWith(c, 422, 'bad-image');
      if (scan.outcome === 'unavailable') {
        counters.refund(reserved.reservation);
        return failWith(c, scan.reason === 'timeout' ? 504 : 503, 'unreachable');
      }
      c.var.requestLog.promptTokens = scan.usage.promptTokens;
      c.var.requestLog.outputTokens = scan.usage.outputTokens;
      if (scan.outcome === 'unreadable') return failWith(c, 502, 'model-failed');

      const body: ScanResponse = { receipt: scan.receipt };
      return c.json(body);
    } finally {
      slot();
    }
  });
  return route;
}
