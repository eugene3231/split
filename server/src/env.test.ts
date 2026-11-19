import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const MINIMAL = { GEMINI_API_KEY: 'key', TURNSTILE_SECRET: 'secret' };

describe('reading the environment', () => {
  it('applies the documented defaults', () => {
    expect(parseEnv(MINIMAL)).toEqual({
      GEMINI_API_KEY: 'key',
      TURNSTILE_SECRET: 'secret',
      SCAN_MODEL: 'gemini-3.1-flash-lite',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com',
      ALLOWED_ORIGINS: [],
      TRUST_CF_CONNECTING_IP: false,
      APP_VERSION: 'dev',
      DATA_DIR: '/data',
      PORT: 8080,
      SCAN_LIMIT_PER_DEVICE: 20,
      SCAN_LIMIT_GLOBAL: 200,
      DEVICE_MINT_LIMIT_PER_IP: 10,
    });
  });

  it('treats an empty value as unset', () => {
    expect(parseEnv({ ...MINIMAL, PORT: '' }).PORT).toBe(8080);
  });

  it.each([
    [{ GEMINI_API_KEY: undefined }, 'GEMINI_API_KEY'],
    [{ TURNSTILE_SECRET: '' }, 'TURNSTILE_SECRET'],
    [{ SCAN_MODEL: 'gpt-4' }, 'SCAN_MODEL'],
    [{ PORT: '70000' }, 'PORT'],
    [{ SCAN_LIMIT_PER_DEVICE: '0' }, 'SCAN_LIMIT_PER_DEVICE'],
    [{ TRUST_CF_CONNECTING_IP: 'yes' }, 'TRUST_CF_CONNECTING_IP'],
    [{ ALLOWED_ORIGINS: 'not a url' }, 'ALLOWED_ORIGINS'],
    [{ ALLOWED_ORIGIN_PATTERN: '(' }, 'ALLOWED_ORIGIN_PATTERN'],
  ])('refuses %j', (override, name) => {
    expect(() => parseEnv({ ...MINIMAL, ...override })).toThrow(name);
  });

  it('reads a list of origins and the trust flag', () => {
    const env = parseEnv({
      ...MINIMAL,
      ALLOWED_ORIGINS: 'http://localhost:5173, https://split-receipt.netlify.app',
      TRUST_CF_CONNECTING_IP: '1',
    });
    expect(env.ALLOWED_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://split-receipt.netlify.app',
    ]);
    expect(env.TRUST_CF_CONNECTING_IP).toBe(true);
  });

  it('anchors the origin pattern so a longer host cannot slip in', () => {
    const pattern = parseEnv({
      ...MINIMAL,
      ALLOWED_ORIGIN_PATTERN: 'https://deploy-preview-\\d+--split-receipt\\.netlify\\.app',
    }).ALLOWED_ORIGIN_PATTERN;
    expect(pattern?.test('https://deploy-preview-12--split-receipt.netlify.app')).toBe(true);
    expect(pattern?.test('https://deploy-preview-12--split-receipt.netlify.app.evil.example')).toBe(
      false,
    );
  });
});
