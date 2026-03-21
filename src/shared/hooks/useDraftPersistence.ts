import { useEffect } from 'react'
import type { Person, Receipt } from '@shared/types'
import { savePersistedDraft } from '@shared/api/storage'

type UseDraftPersistenceArgs = {
  initialized: boolean
  people: Person[]
  receipts: Receipt[]
  activeReceiptId: string
}

export function useDraftPersistence({
  initialized,
  people,
  receipts,
  activeReceiptId,
}: UseDraftPersistenceArgs): void {
  useEffect(() => {
    if (!initialized) return
    savePersistedDraft({
      version: 2,
      people,
      receipts,
      activeReceiptId,
      savedAt: new Date().toISOString(),
    })
  }, [initialized, people, receipts, activeReceiptId])
}
