import type { Change } from '@features/group-ledger/domain/types';

// Numbers the server and the phone must agree on. The SQL migration states the first one too.

/** A change larger than this is rejected for good. `changeBytes` is how both sides measure it. */
export const MAX_CHANGE_BYTES = 65536;
/** Ops per pull. A full page means there may be more. */
export const PULL_PAGE_SIZE = 500;
/** Ops per push. */
export const PUSH_BATCH_SIZE = 50;

/**
 * The text a change travels as. The Supabase adapter sends exactly this text and the SQL counts
 * its bytes before reading it as JSON, so no server ever measures its own re-spaced copy.
 */
export function changeText(change: unknown): string | undefined {
  return JSON.stringify(change);
}

/** The size of a change as every server measures it: the UTF-8 bytes of its JSON text. */
export function changeBytes(change: unknown): number {
  return new TextEncoder().encode(changeText(change) ?? '').length;
}

/** Whether the server will take the change. Check before submitting: a change that does not fit is dropped. */
export function fitsOnServer(change: Change): boolean {
  return changeBytes(change) <= MAX_CHANGE_BYTES;
}
