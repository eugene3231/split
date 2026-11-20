import type { OpId } from '@features/group-ledger/domain/types';
import { idSchemas } from '@features/group-ledger/logic/codec';
import { discardReceiptDraft } from '@features/split-workspace';
import { jsonStorage } from '@shared/logic/jsonStorage';

const baseStorage = (draftKey: string) =>
  jsonStorage('localStorage', `${draftKey}:base`, idSchemas.opId);

function draftKept(draftKey: string): boolean {
  try {
    return window.localStorage.getItem(draftKey) !== null;
  } catch {
    return false;
  }
}

/**
 * The revision a receipt draft was started from. A draft left and reopened after another phone
 * saved the receipt is saved against the version it began on, so the newer one is flagged as
 * replaced, with a way to restore it, rather than overwritten unseen.
 */
export function receiptDraftBase(draftKey: string, latest: OpId): OpId {
  const storage = baseStorage(draftKey);
  const kept = draftKept(draftKey) ? storage.load() : null;
  if (kept !== null) return kept;
  storage.save(latest);
  return latest;
}

export function discardGroupReceiptDraft(draftKey: string): void {
  discardReceiptDraft(draftKey);
  try {
    window.localStorage.removeItem(`${draftKey}:base`);
  } catch {
    // Storage is blocked, so nothing was kept.
  }
}
