import type { SessionDraft } from '@features/split-workspace/types';
import type { Person, Receipt } from '@shared/types';
import { importDraftFromJson } from '@features/split-workspace/logic/draftStorage';

export function buildWorkspaceFileName(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `split-${yyyy}-${mm}-${dd}.json`;
}

export function downloadWorkspaceFile(json: string, date = new Date()): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildWorkspaceFileName(date);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readWorkspaceFile(file: File): Promise<SessionDraft | null> {
  try {
    return importDraftFromJson(await file.text());
  } catch {
    return null;
  }
}

/** Whether replacing the workspace would throw away anything the user entered. */
export function hasWorkspaceContent(people: Person[], receipts: Receipt[]): boolean {
  return (
    people.length > 0 ||
    receipts.length > 1 ||
    receipts.some((receipt) =>
      receipt.items.some((item) => item.name.trim() || item.amountInput.trim()),
    )
  );
}
