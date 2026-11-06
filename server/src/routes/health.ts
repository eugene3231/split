import { Hono } from 'hono';
import type { HealthResponse } from '@shared/api/health';
import type { AppContext, Services } from '../app';

export function healthRoute({ env, db }: Services): Hono<AppContext> {
  const route = new Hono<AppContext>();
  route.get('/', (c) => {
    const row = db.prepare('SELECT COUNT(*) AS applied FROM schema_migrations').get() as {
      applied: number;
    };
    const body: HealthResponse = { ok: true, version: env.APP_VERSION, migrations: row.applied };
    return c.json(body);
  });
  return route;
}
