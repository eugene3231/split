import { createServer } from 'node:http';
import type { Server } from 'node:http';

export type StubMode = 'ok' | '400' | '401' | '429' | '503' | 'hang' | 'junk';

export const STUB_RECEIPT = {
  items: [
    { description: 'Chicken Rice', amount: 5.5 },
    { description: 'Iced Tea', amount: 2 },
    { description: 'Laksa', amount: 6.5 },
  ],
  subtotal: 14,
  total: 16.79,
  detected: {
    gst: { enabled: true, amount: 1.39, percent: 9, confidence: 0.9, source: 'GST 9%' },
    serviceCharge: {
      enabled: true,
      amount: 1.4,
      percent: 10,
      confidence: 0.9,
      source: 'Service 10%',
    },
  },
  warnings: [],
};

export interface StubGemini {
  server: Server;
  port: number;
  requests: () => number;
  lastRequest: () => { url: string; apiKey: string | undefined } | null;
  setMode: (mode: StubMode) => void;
}

interface StubOptions {
  port: number;
  delayMs?: number;
}

export function startStubGemini({ port, delayMs = 200 }: StubOptions): Promise<StubGemini> {
  let mode: StubMode = 'ok';
  let requests = 0;
  let last: { url: string; apiKey: string | undefined } | null = null;

  const server = createServer((req, res) => {
    const url = req.url ?? '';
    if (req.method === 'POST' && url === '/__mode') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        mode = (JSON.parse(body) as { mode: StubMode }).mode;
        res.end('{}');
      });
      return;
    }
    if (req.method === 'GET' && url === '/__stats') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ requests, mode }));
      return;
    }
    if (req.method !== 'POST' || !/^\/v1beta\/models\/[^/]+:generateContent$/.test(url)) {
      res.statusCode = 404;
      res.end('{}');
      return;
    }

    req.resume();
    req.on('end', () => {
      requests += 1;
      last = { url, apiKey: req.headers['x-goog-api-key'] as string | undefined };
      if (mode === 'hang') return;
      setTimeout(() => {
        res.setHeader('Content-Type', 'application/json');
        if (mode === '400' || mode === '401' || mode === '429' || mode === '503') {
          res.statusCode = Number(mode);
          res.end(JSON.stringify({ error: { message: 'stub secret upstream detail' } }));
          return;
        }
        const text = mode === 'junk' ? 'not json at all' : JSON.stringify(STUB_RECEIPT);
        res.end(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text }] } }],
            usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 150 },
          }),
        );
      }, delayMs);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const bound = typeof address === 'object' && address ? address.port : port;
      resolve({
        server,
        port: bound,
        requests: () => requests,
        lastRequest: () => last,
        setMode: (next) => {
          mode = next;
        },
      });
    });
  });
}

if (process.argv[1]?.endsWith('stubGemini.ts')) {
  const flag = process.argv.indexOf('--port');
  const port = flag === -1 ? 8090 : Number(process.argv[flag + 1]);
  const stub = await startStubGemini({ port });
  console.log(`stub gemini listening on ${stub.port}`);
}
