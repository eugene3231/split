import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
  defaultGstState,
  defaultServiceChargeState,
} from '../../constants'
import type {
  ChargeMode,
  ChargeState,
  EditableItem,
  ItemAssignment,
  PersistedDraft,
  PersistedFinalSplit,
  PersistedOcrSettings,
  Person,
} from '../../types'
import { createEmptyItem } from '../item-assignment/items'
import { toNullableNumber } from '../core/money'
import { isRecord } from '../core/guards'
import { createId } from '../core/id'

export function savePersistedDraft(draft: PersistedDraft): void {
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

export function loadPersistedDraft(): PersistedDraft | null {
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
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null
    }

    const people = normalizeDraftPeople(parsed.people)
    const items = normalizeDraftItems(parsed.items, people)

    return {
      version: 1,
      people,
      items,
      serviceCharge: normalizeDraftChargeState(parsed.serviceCharge, defaultServiceChargeState),
      gst: normalizeDraftChargeState(parsed.gst, defaultGstState),
      receiptTotalInput: typeof parsed.receiptTotalInput === 'string' ? parsed.receiptTotalInput : '',
      finalSplit: normalizePersistedFinalSplit(parsed.finalSplit),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
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

function normalizePersistedFinalSplit(value: unknown): PersistedFinalSplit {
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
