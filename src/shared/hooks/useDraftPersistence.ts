import { useEffect } from 'react'
import type { ChargeState, EditableItem, Person, SplitResult } from '../types'
import { savePersistedDraft } from '../api/storage'

type UseDraftPersistenceArgs = {
  initialized: boolean
  people: Person[]
  items: EditableItem[]
  discount: ChargeState
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  split: SplitResult
}

export function useDraftPersistence({
  initialized,
  people,
  items,
  discount,
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
      discount,
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
  }, [initialized, discount, gst, items, people, receiptTotalInput, serviceCharge, split])
}
