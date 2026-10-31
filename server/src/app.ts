import type { IncomingMessage } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { ScanErrorKind } from '@shared/api/scan';
import { createDeviceTokens } from './devices/deviceTokens';
import type { Env } from './env';
import { corsFor } from './http/cors';
import { createDailyCounters } from './limits/dailyCounters';
import { devicesRoute } from './routes/devices';
import { healthRoute } from './routes/health';
import { scanRoute } from './routes/scan';

export interface RequestLog {
  kind?: ScanErrorKind;
  bytes?: number;
  promptTokens?: number | null;
  outputTokens?: number | null;
}

export interface AppContext {
  Bindings: { incoming?: IncomingMessage };
  Variables: { requestLog: RequestLog };
}

export interface AppDeps {
  env: Env;
  db: DatabaseSync;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  writeLog?: (line: string) => void;
  bodyTimeoutMs?: number;
  geminiTimeoutMs?: number;
}

export interface Services {
  env: Env;
  db: DatabaseSync;
  counters: ReturnType<typeof createDailyCounters>;
  devices: ReturnType<typeof createDeviceTokens>;
  fetchImpl: typeof fetch;
  bodyTimeoutMs: number;
  geminiTimeoutMs: number;
}

export function createApp(deps: AppDeps): Hono<AppContext> {
  const now = deps.now ?? (() => new Date());
  const writeLog = deps.writeLog ?? ((line: string) => console.log(line));
  const services: Services = {
    env: deps.env,
    db: deps.db,
    counters: createDailyCounters(deps.db, now),
    devices: createDeviceTokens(deps.db, now),
    fetchImpl: deps.fetchImpl ?? fetch,
    bodyTimeoutMs: deps.bodyTimeoutMs ?? 30_000,
    geminiTimeoutMs: deps.geminiTimeoutMs ?? 45_000,
  };

  const app = new Hono<AppContext>();
  app.use(corsFor(deps.env));
  app.use(async (c, next) => {
    const started = performance.now();
    c.set('requestLog', {});
    await next();
    const { requestLog } = c.var;
    writeLog(
      JSON.stringify({
        msg: 'request',
        route: c.req.path,
        status: c.res.status,
        kind: requestLog.kind ?? null,
        bytes: requestLog.bytes ?? null,
        ms: Math.round(performance.now() - started),
        promptTokens: requestLog.promptTokens ?? null,
        outputTokens: requestLog.outputTokens ?? null,
      }),
    );
  });

  app.route('/api/v1/health', healthRoute(services));
  app.route('/api/v1/devices', devicesRoute(services));
  app.route('/api/v1/scan', scanRoute(services));

  app.notFound((c) => {
    c.var.requestLog.kind = 'unknown';
    return c.json({ kind: 'unknown' }, 404);
  });
  app.onError((error, c) => {
    writeLog(JSON.stringify({ msg: 'error', name: error.name }));
    c.var.requestLog.kind = 'unknown';
    return c.json({ kind: 'unknown' }, 500);
  });
  return app;
}
