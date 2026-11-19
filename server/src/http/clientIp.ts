import { isIP } from 'node:net';

export type ClientIp = { ok: true; ip: string } | { ok: false };

interface ClientIpSource {
  trustCfConnectingIp: boolean;
  cfConnectingIp: string | null;
  socketAddress: string | undefined;
}

export function resolveClientIp(source: ClientIpSource): ClientIp {
  if (source.trustCfConnectingIp) {
    const header = source.cfConnectingIp?.trim();
    return header && isIP(header) !== 0 ? { ok: true, ip: header } : { ok: false };
  }
  return { ok: true, ip: source.socketAddress ?? 'unknown' };
}
