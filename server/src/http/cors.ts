import { cors } from 'hono/cors';
import type { Env } from '../env';

export function corsFor(env: Pick<Env, 'ALLOWED_ORIGINS' | 'ALLOWED_ORIGIN_PATTERN'>) {
  const allowed = new Set(env.ALLOWED_ORIGINS);
  return cors({
    origin: (origin) =>
      allowed.has(origin) || env.ALLOWED_ORIGIN_PATTERN?.test(origin) ? origin : null,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
  });
}
