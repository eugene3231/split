import { describe, expect, it } from 'vitest';
import { resolveClientIp } from './clientIp';

describe('finding the client address', () => {
  it('uses CF-Connecting-IP when it is trusted', () => {
    expect(
      resolveClientIp({
        trustCfConnectingIp: true,
        cfConnectingIp: '203.0.113.7',
        socketAddress: '172.18.0.2',
      }),
    ).toEqual({ ok: true, ip: '203.0.113.7' });
  });

  it('accepts an IPv6 address', () => {
    expect(
      resolveClientIp({
        trustCfConnectingIp: true,
        cfConnectingIp: '2001:db8::1',
        socketAddress: undefined,
      }),
    ).toEqual({ ok: true, ip: '2001:db8::1' });
  });

  it('ignores the header when it is not trusted', () => {
    expect(
      resolveClientIp({
        trustCfConnectingIp: false,
        cfConnectingIp: '203.0.113.7',
        socketAddress: '192.0.2.1',
      }),
    ).toEqual({ ok: true, ip: '192.0.2.1' });
  });

  it('falls back to a placeholder when there is no socket address', () => {
    expect(
      resolveClientIp({
        trustCfConnectingIp: false,
        cfConnectingIp: null,
        socketAddress: undefined,
      }),
    ).toEqual({ ok: true, ip: 'unknown' });
  });

  it('refuses a missing header when trusted, and never uses the socket address', () => {
    expect(
      resolveClientIp({
        trustCfConnectingIp: true,
        cfConnectingIp: null,
        socketAddress: '172.18.0.2',
      }),
    ).toEqual({ ok: false });
  });

  it.each(['not-an-ip', '', '203.0.113.7, 198.51.100.1', '999.1.1.1'])(
    'refuses the invalid header %j when trusted',
    (header) => {
      expect(
        resolveClientIp({
          trustCfConnectingIp: true,
          cfConnectingIp: header,
          socketAddress: '172.18.0.2',
        }),
      ).toEqual({ ok: false });
    },
  );
});
