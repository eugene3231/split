import { useEffect } from 'react'
import type { ChargeState, EditableItem, Person, SplitResult } from '../types'
import { savePersistedDraft } from '../api/storage'

type UseDraftPersistenceArgs = {
  initialized: boolean
  people: Person[]
  items: EditableItem[]
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  split: SplitResult
}

export function useDraftPersistence({
  initialized,
  people,
  items,
  serviceCharge,
  gst,
  receiptTotalInput,
  split,
}: UseDraftPersistenceArgs): void {
  useEffect(() => {
    if (!initialized) return
    savePersistedDraft({
      version: 1,
      people,
      items,
      serviceCharge,
      gst,
      receiptTotalInput,
      finalSplit: {
        subtotalCents: split.subtotalCents,
        serviceChargeCents: split.serviceChargeCents,
        gstCents: split.gstCents,
        grandTotalCents: split.grandTotalCents,
        totalByPersonCents: split.totalByPersonCents,
      },
      savedAt: new Date().toISOString(),
    })
  }, [initialized, gst, items, people, receiptTotalInput, serviceCharge, split])
}
