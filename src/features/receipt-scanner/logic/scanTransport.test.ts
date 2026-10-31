import { describe, expect, it } from 'vitest';
import { resolveScanTransport } from './scanTransport';

describe('resolveScanTransport', () => {
  it('goes direct when a key is typed, even with a server configured', () => {
    expect(resolveScanTransport('AIza-key', 'https://api.example.com')).toEqual({
      kind: 'direct',
    });
  });

  it('goes through the server when no key is typed and an API URL is set', () => {
    expect(resolveScanTransport('   ', 'https://api.example.com')).toEqual({
      kind: 'server',
      apiUrl: 'https://api.example.com',
    });
  });

  it('has no way to scan with neither a key nor an API URL', () => {
    expect(resolveScanTransport('', '')).toEqual({ kind: 'none' });
  });
});
