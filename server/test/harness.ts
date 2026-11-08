import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/app';
import type { AppDeps } from '../src/app';
import { parseEnv } from '../src/env';
import { freshDb } from './testDb';
import { startStubGemini } from './stubGemini';
import type { StubGemini } from './stubGemini';

export const PASS_TOKEN = 'pass-token';
export const FAIL_TOKEN = 'fail-token';
export const DOWN_TOKEN = 'down-token';
export const FIXED_NOW = new Date('2026-10-31T04:00:00Z');

export const JPEG = readFileSync(new URL('./fixtures/receipt.jpg', import.meta.url));
export const PDF = readFileSync(new URL('./fixtures/receipt.pdf', import.meta.url));

const realFetch = globalThis.fetch;

const turnstileAwareFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('https://challenges.cloudflare.com/')) return realFetch(input, init);
  const response = new URLSearchParams(String(init?.body)).get('response');
  if (response === DOWN_TOKEN) return new Response('down', { status: 500 });
  return Response.json({ success: response === PASS_TOKEN });
};

export interface Harness {
  app: ReturnType<typeof createApp>;
  db: DatabaseSync;
  stub: StubGemini;
  logs: string[];
  mintToken: () => Promise<string>;
  scan: (
    token: string | null,
    body: string | Uint8Array,
    contentType?: string,
  ) => Promise<Response> | Response;
  close: () => void;
}

export async function startHarness(
  envOverrides: Record<string, string> = {},
  deps: Partial<AppDeps> = {},
): Promise<Harness> {
  const stub = await startStubGemini({ port: 0, delayMs: 0 });
  const db = freshDb();
  const logs: string[] = [];
  const app = createApp({
    env: parseEnv({
      GEMINI_API_KEY: 'test-gemini-key',
      TURNSTILE_SECRET: 'test-secret',
      GEMINI_BASE_URL: `http://127.0.0.1:${stub.port}`,
      ALLOWED_ORIGINS: 'http://localhost:5173',
      ...envOverrides,
    }),
    db,
    now: () => FIXED_NOW,
    fetchImpl: turnstileAwareFetch,
    writeLog: (line) => logs.push(line),
    ...deps,
  });

  return {
    app,
    db,
    stub,
    logs,
    async mintToken() {
      const response = await app.request('/api/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: PASS_TOKEN }),
      });
      return ((await response.json()) as { token: string }).token;
    },
    scan(token, body, contentType = 'image/jpeg') {
      const headers: Record<string, string> = { 'Content-Type': contentType };
      if (token) headers.Authorization = `Bearer ${token}`;
      return app.request('/api/v1/scan', { method: 'POST', headers, body });
    },
    close() {
      stub.server.closeAllConnections();
      stub.server.close();
      db.close();
    },
  };
}
