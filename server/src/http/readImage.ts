import { MAX_SCAN_BYTES, SCAN_MIME_TYPES } from '@shared/api/scan';
import type { ScanErrorKind } from '@shared/api/scan';

export type ImageRead =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false; status: 408 | 413 | 415; kind: ScanErrorKind };

const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function matchesMagic(mimeType: string, bytes: Uint8Array): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return ascii(bytes, 1, 4) === 'PNG' && bytes[0] === 0x89;
    case 'image/webp':
      return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
    case 'application/pdf':
      return ascii(bytes, 0, 5) === '%PDF-';
    case 'image/heic':
    case 'image/heif':
      return ascii(bytes, 4, 8) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 12));
    default:
      return false;
  }
}

function isScanMimeType(value: string): value is (typeof SCAN_MIME_TYPES)[number] {
  return (SCAN_MIME_TYPES as readonly string[]).includes(value);
}

interface ReadImageOptions {
  contentType: string | null;
  contentLength: string | null;
  body: ReadableStream<Uint8Array> | null;
  timeoutMs: number;
}

export async function readImage(options: ReadImageOptions): Promise<ImageRead> {
  const mimeType = options.contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!isScanMimeType(mimeType)) return { ok: false, status: 415, kind: 'bad-image' };

  const declared = Number(options.contentLength);
  if (options.contentLength !== null && declared > MAX_SCAN_BYTES) {
    return { ok: false, status: 413, kind: 'bad-image' };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = options.body?.getReader();
  const timedOut = Symbol('timed out');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof timedOut>((resolve) => {
    timer = setTimeout(() => resolve(timedOut), options.timeoutMs);
  });

  try {
    while (reader) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next === timedOut) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 408, kind: 'unreachable' };
      }
      if (next.done) break;
      received += next.value.byteLength;
      if (received > MAX_SCAN_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 413, kind: 'bad-image' };
      }
      chunks.push(next.value);
    }
  } catch {
    return { ok: false, status: 408, kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!matchesMagic(mimeType, bytes)) return { ok: false, status: 415, kind: 'bad-image' };
  return { ok: true, bytes, mimeType };
}
