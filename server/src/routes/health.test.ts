import { afterEach, describe, expect, it } from 'vitest';
import { startHarness } from '../../test/harness';
import type { Harness } from '../../test/harness';

let harness: Harness;
afterEach(() => harness.close());

describe('GET /api/v1/health', () => {
  it('reports ok, the version and the migrations applied', async () => {
    harness = await startHarness({ APP_VERSION: 'abc123' });
    const response = await harness.app.request('/api/v1/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, version: 'abc123', migrations: 1 });
  });

  it('answers an unknown path with a JSON unknown error', async () => {
    harness = await startHarness();
    const response = await harness.app.request('/api/v1/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ kind: 'unknown' });
  });

  it('answers a crash with a JSON unknown error and logs only its name', async () => {
    harness = await startHarness();
    harness.db.exec('DROP TABLE schema_migrations');
    const response = await harness.app.request('/api/v1/health');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ kind: 'unknown' });
    expect(harness.logs[0]).toBe('{"msg":"error","name":"Error"}');
  });
});
