import { describe, expect, it } from 'vitest';
import { startHarness } from '../../test/harness';

const PATTERN = 'https://deploy-preview-\\d+--split-receipt\\.netlify\\.app';

async function preflight(origin: string, env: Record<string, string> = {}) {
  const harness = await startHarness({ ALLOWED_ORIGIN_PATTERN: PATTERN, ...env });
  try {
    return await harness.app.request('/api/v1/scan', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
  } finally {
    harness.close();
  }
}

describe('CORS', () => {
  it('echoes a listed origin', async () => {
    const response = await preflight('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization,Content-Type');
  });

  it('echoes a Netlify preview that matches the pattern', async () => {
    const origin = 'https://deploy-preview-12--split-receipt.netlify.app';
    expect((await preflight(origin)).headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  it.each([
    'https://evil.example',
    'https://deploy-preview-12--split-receipt.netlify.app.evil.example',
    'https://xdeploy-preview-12--split-receipt.netlify.app',
  ])('gives %s nothing', async (origin) => {
    expect((await preflight(origin)).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('gives a pattern origin nothing when no pattern is set', async () => {
    const harness = await startHarness();
    const response = await harness.app.request('/api/v1/health', {
      headers: { Origin: 'https://deploy-preview-12--split-receipt.netlify.app' },
    });
    harness.close();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
