import { MAX_SCAN_BYTES, asksForKey, type LimitScope, type ScanErrorKind } from '@shared/api/scan';

export class ScanError extends Error {
  readonly kind: ScanErrorKind;
  readonly scope?: LimitScope;

  constructor(kind: ScanErrorKind, scope?: LimitScope) {
    super(`Scan failed: ${kind}`);
    this.name = 'ScanError';
    this.kind = kind;
    this.scope = scope;
  }
}

const ADD_KEY = 'Add your own Gemini key to keep scanning.';

function describeOverLimit(scope: LimitScope | undefined): string {
  switch (scope) {
    case 'device':
      return `You've used today's free scans. ${ADD_KEY}`;
    case 'mint':
      return `Too many devices have joined from this network today. ${ADD_KEY}`;
    default:
      return `Split's shared scanner has reached today's limit. ${ADD_KEY}`;
  }
}

export function describeScanError(error: ScanError): { message: string; asksForKey: boolean } {
  return { message: messageFor(error), asksForKey: asksForKey(error.kind) };
}

function messageFor({ kind, scope }: ScanError): string {
  switch (kind) {
    case 'bad-image':
      return `This file can't be scanned. Use a JPEG, PNG, WebP or HEIC photo, or a PDF, under ${MAX_SCAN_BYTES / (1024 * 1024)} MB.`;
    case 'over-limit':
      return describeOverLimit(scope);
    case 'bot-check-failed':
      return `Split couldn't check this device. ${ADD_KEY}`;
    case 'model-failed':
      return `Split's shared scanner couldn't read this receipt. Add your own Gemini key to try again.`;
    case 'unreachable':
    case 'no-server':
      return `Split's shared scanner isn't available right now. ${ADD_KEY}`;
    default:
      return `Split's shared scanner isn't working right now. ${ADD_KEY}`;
  }
}
