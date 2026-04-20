import { useEffect } from 'react';
import type { Person, Receipt } from '@shared/types';
import { savePersistedDraft } from '@features/workspace/logic/draftStorage';

type UseDraftPersistenceArgs = {
  initialized: boolean;
  people: Person[];
  receipts: Receipt[];
  activeReceiptId: string;
  payerMobile: string;
};

export function useDraftPersistence({
  initialized,
  people,
  receipts,
  activeReceiptId,
  payerMobile,
}: UseDraftPersistenceArgs): void {
  useEffect(() => {
    if (!initialized) return;
    savePersistedDraft({
      version: 2,
      people,
      receipts,
      activeReceiptId,
      payerMobile,
      savedAt: new Date().toISOString(),
    });
  }, [initialized, people, receipts, activeReceiptId, payerMobile]);
}
