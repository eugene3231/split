import { readFileSync } from 'node:fs';

const base = process.env.API_URL ?? 'http://localhost:8080';
const turnstileToken = process.env.TURNSTILE_TOKEN ?? 'XXXX.DUMMY.TOKEN.XXXX';
const runs = Number(process.env.RUNS ?? 50);
const stubDelayMs = Number(process.env.STUB_DELAY_MS ?? 200);
const target = 3 * 1024 * 1024;

const jpeg = readFileSync(new URL('./fixtures/receipt.jpg', import.meta.url));
const payload = Buffer.concat([jpeg, Buffer.alloc(target - jpeg.length)]);

const minted = await fetch(`${base}/api/v1/devices`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ turnstileToken }),
});
if (!minted.ok) throw new Error(`mint failed with ${minted.status}`);
const { token } = (await minted.json()) as { token: string };

const added: number[] = [];
for (let i = 0; i < runs; i++) {
  const started = performance.now();
  const response = await fetch(`${base}/api/v1/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
    body: payload,
  });
  const elapsed = performance.now() - started;
  if (!response.ok) throw new Error(`scan ${i + 1} failed with ${response.status}`);
  await response.arrayBuffer();
  added.push(elapsed - stubDelayMs);
}

added.sort((a, b) => a - b);
const at = (fraction: number) =>
  added[Math.min(added.length - 1, Math.floor(added.length * fraction))];
console.log(
  JSON.stringify({
    runs,
    bytes: payload.length,
    addedMs: { p50: Math.round(at(0.5)), p95: Math.round(at(0.95)) },
  }),
);
