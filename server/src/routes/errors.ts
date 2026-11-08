import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody, ScanErrorKind } from '@shared/api/scan';
import type { AppContext } from '../app';

export function failWith(
  c: Context<AppContext>,
  status: ContentfulStatusCode,
  kind: ScanErrorKind,
  extra: Omit<ApiErrorBody, 'kind'> & { retryAfterSeconds?: number } = {},
): Response {
  c.var.requestLog.kind = kind;
  if (extra.retryAfterSeconds !== undefined) {
    c.header('Retry-After', String(extra.retryAfterSeconds));
  }
  const body: ApiErrorBody = extra.scope ? { kind, scope: extra.scope } : { kind };
  return c.json(body, status);
}
