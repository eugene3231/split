import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  LOCAL_STORAGE_UX_MODE_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '../constants'
import {
  clearPersistedDraft,
  clearSessionGeminiApiKey,
  exportDraftToJson,
  importDraftFromJson,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadPersistedUxMode,
  loadSessionGeminiApiKey,
  savePersistedDraft,
  savePersistedOcrSettings,
  savePersistedUxMode,
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

  it('returns null when no ocr settings have been saved', () => {
    expect(loadPersistedOcrSettings()).toBeNull()
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

  it('returns empty string when sessionStorage getItem throws', () => {
    const faultyStorage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => {},
      removeItem: () => {},
    } as unknown as Storage
    const spy = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValueOnce(faultyStorage)
    expect(loadSessionGeminiApiKey()).toBe('')
    spy.mockRestore()
  })
})

describe('ux mode storage', () => {
  it('returns simple by default when nothing is stored', () => {
    expect(loadPersistedUxMode()).toBe('simple')
  })

  it('returns advanced when advanced is stored', () => {
    window.localStorage.setItem(LOCAL_STORAGE_UX_MODE_KEY, 'advanced')
    expect(loadPersistedUxMode()).toBe('advanced')
  })

  it('ignores unknown mode values and returns simple', () => {
    window.localStorage.setItem(LOCAL_STORAGE_UX_MODE_KEY, 'wizard')
    expect(loadPersistedUxMode()).toBe('simple')
  })

  it('saves and reloads ux mode', () => {
    savePersistedUxMode('advanced')
    expect(window.localStorage.getItem(LOCAL_STORAGE_UX_MODE_KEY)).toBe('advanced')
    expect(loadPersistedUxMode()).toBe('advanced')
  })

  it('handles localStorage read errors gracefully', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(loadPersistedUxMode()).toBe('simple')
    spy.mockRestore()
  })

  it('handles localStorage write errors gracefully', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(() => savePersistedUxMode('advanced')).not.toThrow()
    spy.mockRestore()
  })
})

const minimalDraftState = {
  people: [{ id: 'p1', name: 'Alice' }],
  items: [
    {
      id: 'i1',
      name: 'Noodles',
      amountInput: '8.00',
      discountPercentInput: '',
      assignment: { mode: 'single' as const, personId: 'p1', personIds: ['p1'] },
    },
  ],
  discount: defaultDiscountState,
  serviceCharge: defaultServiceChargeState,
  gst: defaultGstState,
  receiptTotalInput: '8.00',
}

describe('exportDraftToJson', () => {
  it('produces valid JSON with all required fields', () => {
    const json = exportDraftToJson(minimalDraftState)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.people).toEqual(minimalDraftState.people)
    expect(parsed.items).toEqual(minimalDraftState.items)
    expect(parsed.receiptTotalInput).toBe('8.00')
    expect(parsed.savedAt).toBeTruthy()
    expect(parsed.finalSplit).toBeDefined()
  })
})

describe('importDraftFromJson', () => {
  it('returns null for malformed JSON', () => {
    expect(importDraftFromJson('{broken')).toBeNull()
  })

  it('returns null for wrong version', () => {
    expect(importDraftFromJson(JSON.stringify({ version: 2 }))).toBeNull()
  })

  it('round-trips a valid draft', () => {
    const json = exportDraftToJson(minimalDraftState)
    const imported = importDraftFromJson(json)
    expect(imported).not.toBeNull()
    expect(imported?.people).toEqual([{ id: 'p1', name: 'Alice' }])
    expect(imported?.items[0].name).toBe('Noodles')
    expect(imported?.receiptTotalInput).toBe('8.00')
  })

  it('normalizes non-array people to empty list', () => {
    const json = JSON.stringify({ version: 1, people: 'not-an-array' })
    const imported = importDraftFromJson(json)
    expect(imported?.people).toEqual([])
  })

  it('skips non-record entries in the people array', () => {
    const json = JSON.stringify({
      version: 1,
      people: [null, 42, { id: 'p1', name: 'Alice' }],
    })
    const imported = importDraftFromJson(json)
    expect(imported?.people).toEqual([{ id: 'p1', name: 'Alice' }])
  })

  it('falls back to an empty item when all items are invalid', () => {
    const json = JSON.stringify({
      version: 1,
      people: [{ id: 'p1', name: 'Alice' }],
      items: ['bad', null, 123],
    })
    const imported = importDraftFromJson(json)
    expect(imported?.items).toHaveLength(1)
    expect(imported?.items[0].name).toBe('')
  })

  it('generates a new id when item id is missing', () => {
    const json = JSON.stringify({
      version: 1,
      people: [{ id: 'p1', name: 'Alice' }],
      items: [
        {
          name: 'Burger',
          amountInput: '5.00',
          discountPercentInput: '',
          assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
        },
      ],
    })
    const imported = importDraftFromJson(json)
    expect(imported?.items[0].id).toBeTruthy()
    expect(imported?.items[0].name).toBe('Burger')
  })

  it('uses fallback assignment when assignment is not a record', () => {
    const json = JSON.stringify({
      version: 1,
      people: [{ id: 'p1', name: 'Alice' }],
      items: [
        {
          id: 'i1',
          name: 'Pizza',
          amountInput: '12.00',
          discountPercentInput: '',
          assignment: null,
        },
      ],
    })
    const imported = importDraftFromJson(json)
    expect(imported?.items[0].assignment.mode).toBe('single')
    expect(imported?.items[0].assignment.personId).toBe('p1')
  })

  it('deduplicates personIds in assignment', () => {
    const json = JSON.stringify({
      version: 1,
      people: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
      items: [
        {
          id: 'i1',
          name: 'Shared',
          amountInput: '10.00',
          discountPercentInput: '',
          assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p1', 'p2'] },
        },
      ],
    })
    const imported = importDraftFromJson(json)
    expect(imported?.items[0].assignment.personIds).toEqual(['p1', 'p2'])
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
        discount: defaultDiscountState,
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
