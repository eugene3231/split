import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  LOCAL_STORAGE_UX_MODE_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '../constants'
import type {
  ChargeMode,
  ChargeState,
  EditableItem,
  ItemAssignment,
  PersistedFinalSplit,
  PersistedOcrSettings,
  Person,
  Receipt,
  SessionDraft,
} from '../types'
import { createEmptyItem } from '../logic/assignment/items'
import { toNullableNumber } from '../logic/core/money'
import { isRecord } from '../logic/core/guards'
import { createId } from '../logic/core/id'

export function loadPersistedUxMode(): 'simple' | 'advanced' {
  const storage = getBrowserStorage()
  if (!storage) {
    return 'simple'
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_UX_MODE_KEY)
    if (raw === 'advanced') {
      return 'advanced'
    }
  } catch {
    // Ignore storage read failures.
  }

  return 'simple'
}

export function savePersistedUxMode(mode: 'simple' | 'advanced'): void {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(LOCAL_STORAGE_UX_MODE_KEY, mode)
  } catch {
    // Ignore storage write failures.
  }
}

export function exportDraftToJson(state: {
  people: Person[]
  receipts: Receipt[]
  activeReceiptId: string
}): string {
  const draft: SessionDraft = {
    version: 2,
    people: state.people,
    receipts: state.receipts,
    activeReceiptId: state.activeReceiptId,
    savedAt: new Date().toISOString(),
  }
  return JSON.stringify(draft, null, 2)
}

export function importDraftFromJson(raw: string): SessionDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    if (parsed.version === 2) {
      return normalizeSessionDraft(parsed)
    }

    if (parsed.version === 1) {
      return migrateV1ToSessionDraft(parsed)
    }

    return null
  } catch {
    return null
  }
}

export function savePersistedDraft(draft: SessionDraft): void {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Ignore storage write failures.
  }
}

export function loadPersistedDraft(): SessionDraft | null {
  const storage = getBrowserStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_DRAFT_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    if (parsed.version === 2) {
      return normalizeSessionDraft(parsed)
    }

    if (parsed.version === 1) {
      return migrateV1ToSessionDraft(parsed)
    }

    return null
  } catch {
    return null
  }
}

export function clearPersistedDraft(): void {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(LOCAL_STORAGE_DRAFT_KEY)
  } catch {
    // Ignore storage remove failures.
  }
}

export function savePersistedOcrSettings(settings: PersistedOcrSettings): void {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(LOCAL_STORAGE_OCR_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage write failures.
  }
}

export function loadPersistedOcrSettings(): PersistedOcrSettings | null {
  const storage = getBrowserStorage()
  if (!storage) {
    return null
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null
    }

    return {
      version: 1,
      geminiModel: typeof parsed.geminiModel === 'string' ? parsed.geminiModel : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

export function saveSessionGeminiApiKey(apiKey: string): void {
  const storage = getBrowserSessionStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(SESSION_STORAGE_GEMINI_API_KEY, apiKey)
  } catch {
    // Ignore storage write failures.
  }
}

export function loadSessionGeminiApiKey(): string {
  const storage = getBrowserSessionStorage()
  if (!storage) {
    return ''
  }

  try {
    return storage.getItem(SESSION_STORAGE_GEMINI_API_KEY) ?? ''
  } catch {
    return ''
  }
}

export function clearSessionGeminiApiKey(): void {
  const storage = getBrowserSessionStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(SESSION_STORAGE_GEMINI_API_KEY)
  } catch {
    // Ignore storage remove failures.
  }
}

// ---------------------------------------------------------------------------
// Migration: v1 PersistedDraft → v2 SessionDraft
// ---------------------------------------------------------------------------

function migrateV1ToSessionDraft(parsed: Record<string, unknown>): SessionDraft | null {
  const people = normalizeDraftPeople(parsed.people)
  const items = normalizeDraftItems(parsed.items, people)
  const receiptId = createId()

  const receipt: Receipt = {
    id: receiptId,
    name: 'Receipt 1',
    items,
    discount: normalizeDraftChargeState(parsed.discount, defaultDiscountState),
    serviceCharge: normalizeDraftChargeState(parsed.serviceCharge, defaultServiceChargeState),
    gst: normalizeDraftChargeState(parsed.gst, defaultGstState),
    receiptTotalInput: typeof parsed.receiptTotalInput === 'string' ? parsed.receiptTotalInput : '',
  }

  return {
    version: 2,
    people,
    receipts: [receipt],
    activeReceiptId: receiptId,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Normalization: v2 SessionDraft
// ---------------------------------------------------------------------------

function normalizeSessionDraft(parsed: Record<string, unknown>): SessionDraft | null {
  const people = normalizeDraftPeople(parsed.people)
  const receipts = normalizeDraftReceipts(parsed.receipts, people)
  if (receipts.length === 0) return null

  const activeReceiptId =
    typeof parsed.activeReceiptId === 'string' && receipts.some((r) => r.id === parsed.activeReceiptId)
      ? parsed.activeReceiptId
      : receipts[0].id

  return {
    version: 2,
    people,
    receipts,
    activeReceiptId,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
  }
}

function normalizeDraftReceipts(value: unknown, people: Person[]): Receipt[] {
  if (!Array.isArray(value)) return []

  const receipts = value
    .map((r, index) => normalizeDraftReceipt(r, people, index + 1))
    .filter((r): r is Receipt => r !== null)

  return receipts
}

function normalizeDraftReceipt(value: unknown, people: Person[], fallbackIndex: number): Receipt | null {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' && value.id ? value.id : createId()
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : `Receipt ${fallbackIndex}`
  const items = normalizeDraftItems(value.items, people)

  return {
    id,
    name,
    items,
    discount: normalizeDraftChargeState(value.discount, defaultDiscountState),
    serviceCharge: normalizeDraftChargeState(value.serviceCharge, defaultServiceChargeState),
    gst: normalizeDraftChargeState(value.gst, defaultGstState),
    receiptTotalInput: typeof value.receiptTotalInput === 'string' ? value.receiptTotalInput : '',
  }
}

// ---------------------------------------------------------------------------
// Shared normalization helpers
// ---------------------------------------------------------------------------

function normalizeDraftPeople(value: unknown): Person[] {
  if (!Array.isArray(value)) {
    return []
  }

  const nextPeople: Person[] = []

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      continue
    }

    const id = typeof candidate.id === 'string' ? candidate.id : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''

    if (!id || !name) {
      continue
    }

    nextPeople.push({ id, name })
  }

  return nextPeople
}

function normalizeDraftItems(value: unknown, people: Person[]): EditableItem[] {
  if (!Array.isArray(value)) {
    return [createEmptyItem(people)]
  }

  const nextItems = value
    .map((item) => normalizeDraftItem(item, people))
    .filter((item): item is EditableItem => item !== null)

  return nextItems.length > 0 ? nextItems : [createEmptyItem(people)]
}

function normalizeDraftItem(value: unknown, people: Person[]): EditableItem | null {
  if (!isRecord(value)) {
    return null
  }

  const assignment = normalizeDraftAssignment(value.assignment)

  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    name: typeof value.name === 'string' ? value.name : '',
    amountInput: typeof value.amountInput === 'string' ? value.amountInput : '',
    discountPercentInput:
      typeof value.discountPercentInput === 'string' ? value.discountPercentInput : '',
    assignment:
      assignment ??
      {
        mode: 'single',
        personId: people[0]?.id ?? '',
        personIds: people.map((person) => person.id),
      },
  }
}

function normalizeDraftAssignment(value: unknown): ItemAssignment | null {
  if (!isRecord(value)) {
    return null
  }

  const mode = value.mode === 'equal' ? 'equal' : 'single'
  const personId = typeof value.personId === 'string' ? value.personId : ''
  const personIds = Array.isArray(value.personIds)
    ? value.personIds.filter((id): id is string => typeof id === 'string')
    : []
  const uniquePersonIds = Array.from(new Set(personIds))

  return {
    mode,
    personId,
    personIds: uniquePersonIds,
  }
}

function normalizeDraftChargeState(value: unknown, fallback: ChargeState): ChargeState {
  if (!isRecord(value)) {
    return { ...fallback }
  }

  const mode: ChargeMode = value.mode === 'amount' ? 'amount' : 'percent'
  const detectedConfidence = toNullableNumber(value.detectedConfidence)

  return {
    enabled: value.enabled === true,
    mode,
    amountInput: typeof value.amountInput === 'string' ? value.amountInput : '',
    percentInput: typeof value.percentInput === 'string' ? value.percentInput : fallback.percentInput,
    detectedConfidence,
    detectedSource: typeof value.detectedSource === 'string' ? value.detectedSource : null,
  }
}

// Keep for any remaining callers referencing this type (unused but exported to avoid breakage)
export function normalizePersistedFinalSplit(value: unknown): PersistedFinalSplit {
  if (!isRecord(value)) {
    return {
      subtotalCents: 0,
      serviceChargeCents: 0,
      gstCents: 0,
      grandTotalCents: 0,
      totalByPersonCents: {},
    }
  }

  const totalsRecord: Record<string, number> = {}
  if (isRecord(value.totalByPersonCents)) {
    for (const [personId, cents] of Object.entries(value.totalByPersonCents)) {
      const parsed = toNullableNumber(cents)
      if (parsed !== null) {
        totalsRecord[personId] = Math.round(parsed)
      }
    }
  }

  return {
    subtotalCents: Math.round(toNullableNumber(value.subtotalCents) ?? 0),
    serviceChargeCents: Math.round(toNullableNumber(value.serviceChargeCents) ?? 0),
    gstCents: Math.round(toNullableNumber(value.gstCents) ?? 0),
    grandTotalCents: Math.round(toNullableNumber(value.grandTotalCents) ?? 0),
    totalByPersonCents: totalsRecord,
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
