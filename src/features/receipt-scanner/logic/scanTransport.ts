export type ScanTransport =
  { kind: 'direct' } | { kind: 'server'; apiUrl: string } | { kind: 'none' };

export function readApiUrl(): string {
  return (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
}

export function resolveScanTransport(apiKeyInput: string, apiUrl = readApiUrl()): ScanTransport {
  if (apiKeyInput.trim()) return { kind: 'direct' };
  if (apiUrl) return { kind: 'server', apiUrl };
  return { kind: 'none' };
}
