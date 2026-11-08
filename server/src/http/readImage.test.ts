import { describe, expect, it } from 'vitest';
import { readImage } from './readImage';

function bodyOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function bytesFrom(prefix: number[] | string, total = 32): Uint8Array {
  const out = new Uint8Array(total);
  const head = typeof prefix === 'string' ? [...prefix].map((c) => c.charCodeAt(0)) : prefix;
  out.set(head);
  return out;
}

const WEBP = new Uint8Array(32);
WEBP.set(
  [...'RIFF'].map((c) => c.charCodeAt(0)),
  0,
);
WEBP.set(
  [...'WEBP'].map((c) => c.charCodeAt(0)),
  8,
);

const HEIC = new Uint8Array(32);
HEIC.set(
  [...'ftypheic'].map((c) => c.charCodeAt(0)),
  4,
);

const MP4 = new Uint8Array(32);
MP4.set(
  [...'ftypmp42'].map((c) => c.charCodeAt(0)),
  4,
);

async function read(contentType: string | null, bytes: Uint8Array) {
  return readImage({ contentType, contentLength: null, body: bodyOf(bytes), timeoutMs: 1000 });
}

describe('accepting an upload by its first bytes', () => {
  it.each([
    ['image/jpeg', bytesFrom([0xff, 0xd8, 0xff, 0xe0])],
    ['image/png', bytesFrom([0x89, 0x50, 0x4e, 0x47])],
    ['image/webp', WEBP],
    ['image/heic', HEIC],
    ['image/heif', HEIC],
    ['application/pdf', bytesFrom('%PDF-1.4')],
  ])('accepts a real %s', async (type, bytes) => {
    const result = await read(type, bytes);
    expect(result).toMatchObject({ ok: true, mimeType: type });
  });

  it('ignores case and parameters on the Content-Type', async () => {
    const result = await read('Image/JPEG; charset=binary', bytesFrom([0xff, 0xd8, 0xff]));
    expect(result).toMatchObject({ ok: true, mimeType: 'image/jpeg' });
  });

  it.each([
    ['image/jpeg', bytesFrom('GIF89a')],
    ['image/webp', bytesFrom('RIFF')],
    ['image/heic', MP4],
    ['application/pdf', bytesFrom('PK')],
    ['image/jpeg', new Uint8Array(0)],
  ])('refuses %s when the bytes say otherwise', async (type, bytes) => {
    expect(await read(type, bytes)).toEqual({ ok: false, status: 415, kind: 'bad-image' });
  });

  it.each(['text/plain', 'image/gif', null])('refuses the type %s', async (type) => {
    expect(await read(type, bytesFrom([0xff, 0xd8, 0xff]))).toEqual({
      ok: false,
      status: 415,
      kind: 'bad-image',
    });
  });

  it('joins a photo that arrives in several chunks', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([0xff, 0xd8]));
        controller.enqueue(Uint8Array.from([0xff, 0xe0, 1, 2]));
        controller.close();
      },
    });
    const result = await readImage({
      contentType: 'image/jpeg',
      contentLength: null,
      body,
      timeoutMs: 1000,
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect([...result.bytes]).toEqual([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  });

  it('refuses a request with no body', async () => {
    const result = await readImage({
      contentType: 'image/jpeg',
      contentLength: null,
      body: null,
      timeoutMs: 1000,
    });
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it('answers unreachable when the stream errors', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('socket hang up'));
      },
    });
    const result = await readImage({
      contentType: 'image/jpeg',
      contentLength: null,
      body,
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: false, status: 408, kind: 'unreachable' });
  });
});
