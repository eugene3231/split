import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_STORAGE_DRAFT_KEY,
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@shared/constants';
import {
  clearPersistedDraft,
  clearSessionGeminiApiKey,
  exportDraftToJson,
  importDraftFromJson,
  loadPersistedDraft,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedDraft,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from '@shared/api/storage';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('draft storage', () => {
  it('returns null for malformed draft JSON', () => {
    window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, '{broken');
    expect(loadPersistedDraft()).toBeNull();
  });

  it('returns null for unsupported draft version', () => {
    window.localStorage.setItem(LOCAL_STORAGE_DRAFT_KEY, JSON.stringify({ version: 3 }));
    expect(loadPersistedDraft()).toBeNull();
  });

  it('migrates v1 draft to v2 with a single receipt', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        people: [
          { id: 'p1', name: ' Alice ' },
          { id: '', name: 'Ignored' },
        ],
        items: 'invalid-items',
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft).not.toBeNull();
    expect(draft?.version).toBe(2);
    expect(draft?.people).toEqual([{ id: 'p1', name: 'Alice' }]);
    expect(draft?.receipts).toHaveLength(1);
    const receipt = draft?.receipts[0];
    expect(receipt?.items).toHaveLength(1);
    expect(receipt?.items[0].assignment.personId).toBe('p1');
    expect(receipt?.serviceCharge).toEqual(defaultServiceChargeState);
    expect(receipt?.gst).toEqual(defaultGstState);
    expect(receipt?.receiptTotalInput).toBe('');
  });

  it('loads a valid v2 draft', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        people: [{ id: 'p1', name: 'Alice' }],
        receipts: [
          {
            id: 'r1',
            name: 'Receipt 1',
            items: [
              {
                id: 'i1',
                name: 'Item',
                amountInput: '1.00',
                discountPercentInput: '',
                assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
              },
            ],
            discount: defaultDiscountState,
            serviceCharge: defaultServiceChargeState,
            gst: defaultGstState,
            receiptTotalInput: '1.00',
          },
        ],
        activeReceiptId: 'r1',
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft?.version).toBe(2);
    expect(draft?.people).toEqual([{ id: 'p1', name: 'Alice' }]);
    expect(draft?.receipts).toHaveLength(1);
    expect(draft?.receipts[0].name).toBe('Receipt 1');
    expect(draft?.activeReceiptId).toBe('r1');
  });

  it('falls back to first receipt id when activeReceiptId is invalid', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        people: [],
        receipts: [
          {
            id: 'r1',
            name: 'Receipt 1',
            items: [],
            discount: defaultDiscountState,
            serviceCharge: defaultServiceChargeState,
            gst: defaultGstState,
            receiptTotalInput: '',
          },
        ],
        activeReceiptId: 'does-not-exist',
        savedAt: '',
      }),
    );
    const draft = loadPersistedDraft();
    expect(draft?.activeReceiptId).toBe('r1');
  });

  it('defaults currency to SGD when loading a v2 receipt without a currency field', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        people: [{ id: 'p1', name: 'Alice' }],
        receipts: [
          {
            id: 'r1',
            name: 'Receipt 1',
            items: [],
            discount: defaultDiscountState,
            serviceCharge: defaultServiceChargeState,
            gst: defaultGstState,
            receiptTotalInput: '',
            // no `currency` or `exchangeRateOverride` fields
          },
        ],
        activeReceiptId: 'r1',
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft?.receipts[0].currency).toBe('SGD');
    expect(draft?.receipts[0].exchangeRateOverride).toBeNull();
  });

  it('preserves currency and exchangeRateOverride when loading a v2 receipt that has them', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        people: [{ id: 'p1', name: 'Alice' }],
        receipts: [
          {
            id: 'r1',
            name: 'Thailand Trip',
            items: [],
            discount: defaultDiscountState,
            serviceCharge: defaultServiceChargeState,
            gst: defaultGstState,
            receiptTotalInput: '',
            currency: 'THB',
            exchangeRateOverride: 0.038,
          },
        ],
        activeReceiptId: 'r1',
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft?.receipts[0].currency).toBe('THB');
    expect(draft?.receipts[0].exchangeRateOverride).toBe(0.038);
  });

  it('defaults currency to SGD when migrating a v1 draft', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        people: [{ id: 'p1', name: 'Alice' }],
        items: [],
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft?.receipts[0].currency).toBe('SGD');
    expect(draft?.receipts[0].exchangeRateOverride).toBeNull();
  });

  it('ignores invalid exchangeRateOverride values (0 or negative)', () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_DRAFT_KEY,
      JSON.stringify({
        version: 2,
        people: [],
        receipts: [
          {
            id: 'r1',
            name: 'Receipt 1',
            items: [],
            discount: defaultDiscountState,
            serviceCharge: defaultServiceChargeState,
            gst: defaultGstState,
            receiptTotalInput: '',
            currency: 'USD',
            exchangeRateOverride: 0, // invalid — should be null
          },
        ],
        activeReceiptId: 'r1',
        savedAt: '',
      }),
    );

    const draft = loadPersistedDraft();
    expect(draft?.receipts[0].exchangeRateOverride).toBeNull();
  });
});

describe('ocr settings storage', () => {
  it('saves and loads persisted ocr settings', () => {
    savePersistedOcrSettings({
      version: 1,
      geminiModel: 'gemini-2.5-flash',
      savedAt: '2026-02-09T00:00:00.000Z',
    });

    expect(loadPersistedOcrSettings()).toEqual({
      version: 1,
      geminiModel: 'gemini-2.5-flash',
      savedAt: '2026-02-09T00:00:00.000Z',
    });
  });

  it('returns null when no ocr settings have been saved', () => {
    expect(loadPersistedOcrSettings()).toBeNull();
  });

  it('returns null for unsupported ocr settings version', () => {
    window.localStorage.setItem(LOCAL_STORAGE_OCR_SETTINGS_KEY, JSON.stringify({ version: 2 }));
    expect(loadPersistedOcrSettings()).toBeNull();
  });
});

describe('session gemini API key storage', () => {
  it('supports save/load/clear lifecycle', () => {
    expect(loadSessionGeminiApiKey()).toBe('');

    saveSessionGeminiApiKey('api-key');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY)).toBe('api-key');
    expect(loadSessionGeminiApiKey()).toBe('api-key');

    clearSessionGeminiApiKey();
    expect(loadSessionGeminiApiKey()).toBe('');
  });

  it('returns empty string when sessionStorage getItem throws', () => {
    const faultyStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
      removeItem: () => {},
    } as unknown as Storage;
    const spy = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValueOnce(faultyStorage);
    expect(loadSessionGeminiApiKey()).toBe('');
    spy.mockRestore();
  });
});

const receipt1 = {
  id: 'r1',
  name: 'Dinner',
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
  currency: 'SGD',
  exchangeRateOverride: null,
};

const minimalDraftState = {
  people: [{ id: 'p1', name: 'Alice' }],
  receipts: [receipt1],
  activeReceiptId: 'r1',
};

describe('exportDraftToJson', () => {
  it('produces valid JSON with all required fields', () => {
    const json = exportDraftToJson(minimalDraftState);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.people).toEqual(minimalDraftState.people);
    expect(parsed.receipts).toHaveLength(1);
    expect(parsed.receipts[0].name).toBe('Dinner');
    expect(parsed.activeReceiptId).toBe('r1');
    expect(parsed.savedAt).toBeTruthy();
  });
});

describe('importDraftFromJson', () => {
  it('returns null for malformed JSON', () => {
    expect(importDraftFromJson('{broken')).toBeNull();
  });

  it('returns null for wrong version', () => {
    expect(importDraftFromJson(JSON.stringify({ version: 3 }))).toBeNull();
  });

  it('round-trips a valid v2 draft', () => {
    const json = exportDraftToJson(minimalDraftState);
    const imported = importDraftFromJson(json);
    expect(imported).not.toBeNull();
    expect(imported?.version).toBe(2);
    expect(imported?.people).toEqual([{ id: 'p1', name: 'Alice' }]);
    expect(imported?.receipts[0].items[0].name).toBe('Noodles');
    expect(imported?.receipts[0].receiptTotalInput).toBe('8.00');
  });

  it('migrates v1 JSON to v2 with a single receipt', () => {
    const v1Json = JSON.stringify({
      version: 1,
      people: [{ id: 'p1', name: 'Alice' }],
      items: [
        {
          id: 'i1',
          name: 'Noodles',
          amountInput: '8.00',
          discountPercentInput: '',
          assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
        },
      ],
      discount: defaultDiscountState,
      serviceCharge: defaultServiceChargeState,
      gst: defaultGstState,
      receiptTotalInput: '8.00',
      finalSplit: {
        subtotalCents: 0,
        serviceChargeCents: 0,
        gstCents: 0,
        grandTotalCents: 0,
        totalByPersonCents: {},
      },
      savedAt: '',
    });
    const imported = importDraftFromJson(v1Json);
    expect(imported?.version).toBe(2);
    expect(imported?.receipts).toHaveLength(1);
    expect(imported?.receipts[0].items[0].name).toBe('Noodles');
    expect(imported?.receipts[0].receiptTotalInput).toBe('8.00');
  });

  it('normalizes non-array people to empty list', () => {
    const json = JSON.stringify({
      version: 2,
      people: 'not-an-array',
      receipts: [
        {
          id: 'r1',
          name: 'R1',
          items: [],
          discount: defaultDiscountState,
          serviceCharge: defaultServiceChargeState,
          gst: defaultGstState,
          receiptTotalInput: '',
        },
      ],
      activeReceiptId: 'r1',
      savedAt: '',
    });
    const imported = importDraftFromJson(json);
    expect(imported?.people).toEqual([]);
  });

  it('skips non-record entries in the people array', () => {
    const json = JSON.stringify({
      version: 2,
      people: [null, 42, { id: 'p1', name: 'Alice' }],
      receipts: [
        {
          id: 'r1',
          name: 'R1',
          items: [],
          discount: defaultDiscountState,
          serviceCharge: defaultServiceChargeState,
          gst: defaultGstState,
          receiptTotalInput: '',
        },
      ],
      activeReceiptId: 'r1',
      savedAt: '',
    });
    const imported = importDraftFromJson(json);
    expect(imported?.people).toEqual([{ id: 'p1', name: 'Alice' }]);
  });

  it('falls back to an empty item when all items in a receipt are invalid', () => {
    const json = JSON.stringify({
      version: 2,
      people: [{ id: 'p1', name: 'Alice' }],
      receipts: [
        {
          id: 'r1',
          name: 'R1',
          items: ['bad', null, 123],
          discount: defaultDiscountState,
          serviceCharge: defaultServiceChargeState,
          gst: defaultGstState,
          receiptTotalInput: '',
        },
      ],
      activeReceiptId: 'r1',
      savedAt: '',
    });
    const imported = importDraftFromJson(json);
    expect(imported?.receipts[0].items).toHaveLength(1);
    expect(imported?.receipts[0].items[0].name).toBe('');
  });

  it('deduplicates personIds in assignment', () => {
    const json = JSON.stringify({
      version: 2,
      people: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
      receipts: [
        {
          id: 'r1',
          name: 'R1',
          items: [
            {
              id: 'i1',
              name: 'Shared',
              amountInput: '10.00',
              discountPercentInput: '',
              assignment: { mode: 'equal', personId: '', personIds: ['p1', 'p1', 'p2'] },
            },
          ],
          discount: defaultDiscountState,
          serviceCharge: defaultServiceChargeState,
          gst: defaultGstState,
          receiptTotalInput: '',
        },
      ],
      activeReceiptId: 'r1',
      savedAt: '',
    });
    const imported = importDraftFromJson(json);
    expect(imported?.receipts[0].items[0].assignment.personIds).toEqual(['p1', 'p2']);
  });
});

describe('storage availability failures', () => {
  it('handles localStorage access errors gracefully', () => {
    const localStorageGetter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(loadPersistedDraft()).toBeNull();
    expect(loadPersistedOcrSettings()).toBeNull();
    expect(() =>
      savePersistedDraft({
        version: 2,
        people: [],
        receipts: [],
        activeReceiptId: '',
        savedAt: '',
      }),
    ).not.toThrow();
    expect(() =>
      savePersistedOcrSettings({ version: 1, geminiModel: '', savedAt: '' }),
    ).not.toThrow();
    expect(() => clearPersistedDraft()).not.toThrow();

    localStorageGetter.mockRestore();
  });

  it('handles sessionStorage access errors gracefully', () => {
    const sessionStorageGetter = vi
      .spyOn(window, 'sessionStorage', 'get')
      .mockImplementation(() => {
        throw new Error('denied');
      });

    expect(loadSessionGeminiApiKey()).toBe('');
    expect(() => saveSessionGeminiApiKey('api-key')).not.toThrow();
    expect(() => clearSessionGeminiApiKey()).not.toThrow();

    sessionStorageGetter.mockRestore();
  });
});
