import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ChargeState, EditableItem, Person, SplitResult } from '../types'
import { loadPersistedDraft, savePersistedDraft } from '../api/storage'
import { createEmptyItem } from '../logic/assignment/items'

type UseDraftPersistenceArgs = {
  people: Person[]
  setPeople: Dispatch<SetStateAction<Person[]>>
  items: EditableItem[]
  setItems: Dispatch<SetStateAction<EditableItem[]>>
  serviceCharge: ChargeState
  setServiceCharge: Dispatch<SetStateAction<ChargeState>>
  gst: ChargeState
  setGst: Dispatch<SetStateAction<ChargeState>>
  receiptTotalInput: string
  setReceiptTotalInput: Dispatch<SetStateAction<string>>
  split: SplitResult
}

export function useDraftPersistence({
  people,
  setPeople,
  items,
  setItems,
  serviceCharge,
  setServiceCharge,
  gst,
  setGst,
  receiptTotalInput,
  setReceiptTotalInput,
  split,
}: UseDraftPersistenceArgs): void {
  const hasHydratedDraftRef = useRef(false)

  useEffect(() => {
    const draft = loadPersistedDraft()
    if (draft) {
      setPeople(draft.people)
      setItems(draft.items.length > 0 ? draft.items : [createEmptyItem(draft.people)])
      setServiceCharge(draft.serviceCharge)
      setGst(draft.gst)
      setReceiptTotalInput(draft.receiptTotalInput)
    }

    hasHydratedDraftRef.current = true
  }, [setGst, setItems, setPeople, setReceiptTotalInput, setServiceCharge])

  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      return
    }

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
  }, [gst, items, people, receiptTotalInput, serviceCharge, split])
}
