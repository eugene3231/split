import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
  defaultGstState,
  defaultServiceChargeState,
} from '../constants'
import {
  clearPersistedDraft,
  clearSessionGeminiApiKey,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedDraft,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from './storage'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('draft storage', () => {
  it('returns null for malformed draft JSON', () => {
    window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, '{broken')
    expect(loadPersistedDraft()).toBeNull()
  })

  it('returns null for unsupported draft version', () => {
    window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify({ version: 2 }))
    expect(loadPersistedDraft()).toBeNull()
  })

  it('normalizes missing draft fields to safe defaults', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        people: [{ id: 'p1', name: ' Alice ' }, { id: '', name: 'Ignored' }],
        items: 'invalid-items',
      }),
    )

    const draft = loadPersistedDraft()
    expect(draft).not.toBeNull()
    expect(draft?.people).toEqual([{ id: 'p1', name: 'Alice' }])
    expect(draft?.items).toHaveLength(1)
    expect(draft?.items[0].assignment.personId).toBe('p1')
    expect(draft?.serviceCharge).toEqual(defaultServiceChargeState)
    expect(draft?.gst).toEqual(defaultGstState)
    expect(draft?.receiptTotalInput).toBe('')
    expect(draft?.finalSplit).toEqual({
      subtotalCents: 0,
      serviceChargeCents: 0,
      gstCents: 0,
      grandTotalCents: 0,
      totalByPersonCents: {},
    })
  })

  it('rounds final split numeric fields and filters invalid totals', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        people: [{ id: 'p1', name: 'Alice' }],
        items: [
          {
            id: 'i1',
            name: 'Item',
            amountInput: '1.00',
            discountPercentInput: '',
            assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
          },
        ],
        serviceCharge: defaultServiceChargeState,
        gst: defaultGstState,
        receiptTotalInput: '1.00',
        finalSplit: {
          subtotalCents: 100.6,
          serviceChargeCents: '10.4',
          gstCents: 9.5,
          grandTotalCents: '120.2',
          totalByPersonCents: {
            p1: '120.7',
            p2: 10.2,
            invalid: 'not-a-number',
          },
        },
      }),
    )

    const draft = loadPersistedDraft()
    expect(draft?.finalSplit).toEqual({
      subtotalCents: 101,
      serviceChargeCents: 10,
      gstCents: 10,
      grandTotalCents: 120,
      totalByPersonCents: {
        p1: 121,
        p2: 10,
      },
    })
  })
})

describe('ocr settings storage', () => {
  it('saves and loads persisted ocr settings', () => {
    savePersistedOcrSettings({
      version: 1,
      geminiModel: 'gemini-2.5-flash',
      savedAt: '2026-02-09T00:00:00.000Z',
    })

    expect(loadPersistedOcrSettings()).toEqual({
      version: 1,
      geminiModel: 'gemini-2.5-flash',
      savedAt: '2026-02-09T00:00:00.000Z',
    })
  })

  it('returns null for unsupported ocr settings version', () => {
    window.localStorage.setItem(LOCAL_STORAGE_OCR_SETTINGS_KEY, JSON.stringify({ version: 2 }))
    expect(loadPersistedOcrSettings()).toBeNull()
  })
})

describe('session gemini API key storage', () => {
  it('supports save/load/clear lifecycle', () => {
    expect(loadSessionGeminiApiKey()).toBe('')

    saveSessionGeminiApiKey('api-key')
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBe('api-key')
    expect(loadSessionGeminiApiKey()).toBe('api-key')

    clearSessionGeminiApiKey()
    expect(loadSessionGeminiApiKey()).toBe('')
  })
})

describe('storage availability failures', () => {
  it('handles localStorage access errors gracefully', () => {
    const localStorageGetter = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('denied')
      })

    expect(loadPersistedDraft()).toBeNull()
    expect(loadPersistedOcrSettings()).toBeNull()
    expect(() =>
      savePersistedDraft({
        version: 1,
        people: [],
        items: [],
        serviceCharge: defaultServiceChargeState,
        gst: defaultGstState,
        receiptTotalInput: '',
        finalSplit: {
          subtotalCents: 0,
          serviceChargeCents: 0,
          gstCents: 0,
          grandTotalCents: 0,
          totalByPersonCents: {},
        },
        savedAt: '',
      }),
    ).not.toThrow()
    expect(() =>
      savePersistedOcrSettings({ version: 1, geminiModel: '', savedAt: '' }),
    ).not.toThrow()
    expect(() => clearPersistedDraft()).not.toThrow()

    localStorageGetter.mockRestore()
  })

  it('handles sessionStorage access errors gracefully', () => {
    const sessionStorageGetter = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockImplementation(() => {
        throw new Error('denied')
      })

    expect(loadSessionGeminiApiKey()).toBe('')
    expect(() => saveSessionGeminiApiKey('api-key')).not.toThrow()
    expect(() => clearSessionGeminiApiKey()).not.toThrow()

    sessionStorageGetter.mockRestore()
  })
})
