import { describe, expect, it, vi } from 'vitest'
import type { Dispatch, SetStateAction } from 'react'
import { GoogleGenAI } from '@google/genai'
import { defaultGstState, defaultServiceChargeState } from '../../../shared/constants'
import type { ChargeState, EditableItem, OcrResponse, Person } from '../../../shared/types'
import { analyzeReceiptWithGemini, applyOcrPayload } from './ocr'

vi.mock('@google/genai', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GoogleGenAI: vi.fn(function (this: any) {}),
}))

function createFile(): File {
  return new File(['receipt-bytes'], 'receipt.jpg', { type: 'image/jpeg' })
}

function setStateValue<T>(current: T, next: SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (prev: T) => T)(current) : next
}

function stubGenerateContent(text: string | null) {
  const generateContent = vi.fn().mockResolvedValue({ text })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(GoogleGenAI).mockImplementation(function (this: any) {
    this.models = { generateContent }
  })
  return generateContent
}

function stubGenerateContentError(message: string) {
  const generateContent = vi.fn().mockRejectedValue(new Error(message))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(GoogleGenAI).mockImplementation(function (this: any) {
    this.models = { generateContent }
  })
}

describe('analyzeReceiptWithGemini', () => {
  it('throws explicit errors when api key or model is missing', async () => {
    await expect(analyzeReceiptWithGemini(createFile(), '', 'gemini-2.5-flash', vi.fn())).rejects.toThrow(
      'Missing Gemini API key. Enter it above.',
    )

    await expect(analyzeReceiptWithGemini(createFile(), 'abc', ' ', vi.fn())).rejects.toThrow(
      'Missing Gemini model selection.',
    )
  })

  it('throws when Gemini response text is empty or non-JSON', async () => {
    stubGenerateContent('')
    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini response did not include extractable content.')

    stubGenerateContent('not-json')
    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Gemini output was not valid JSON.')
  })

  it('propagates Gemini API errors', async () => {
    stubGenerateContentError('Invalid API key')

    await expect(
      analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn()),
    ).rejects.toThrow('Invalid API key')
  })

  it('parses valid Gemini output into normalized OCR payload', async () => {
    const statuses: string[] = []
    stubGenerateContent(
      JSON.stringify({
        items: [
          { description: '  Chicken Rice  ', amount: 8.5 },
          { description: '', amount: 3.2 },
        ],
        subtotal: 8.5,
        total: 9.27,
        detected: {
          gst: { enabled: false, amount: null, percent: 9, confidence: 1.4, source: null },
          serviceCharge: { enabled: true, amount: null, percent: 10, confidence: 0.8, source: 'receipt' },
        },
        warnings: ['Low confidence'],
      }),
    )

    const result = await analyzeReceiptWithGemini(
      createFile(),
      'abc',
      'gemini-2.5-flash',
      (status) => statuses.push(status),
    )

    expect(statuses).toEqual(['Encoding receipt...', 'Calling Gemini...', 'Parsing Gemini output...'])
    expect(result.items).toEqual([{ description: 'Chicken Rice', amount: 8.5 }])
    expect(result.subtotal).toBe(8.5)
    expect(result.total).toBe(9.27)
    expect(result.detected.gst).toEqual({
      enabled: true,
      amount: null,
      percent: 9,
      confidence: 1,
      source: 'gemini',
    })
    expect(result.detected.serviceCharge).toEqual({
      enabled: true,
      amount: null,
      percent: 10,
      confidence: 0.8,
      source: 'receipt',
    })
    expect(result.warnings).toEqual(['Low confidence'])
  })

  it('adds fallback warning when no line items are returned', async () => {
    stubGenerateContent(
      JSON.stringify({
        items: [],
        subtotal: null,
        total: null,
        detected: {
          gst: { enabled: null, amount: null, percent: null, confidence: null, source: null },
          serviceCharge: { enabled: null, amount: null, percent: null, confidence: null, source: null },
        },
        warnings: [],
      }),
    )

    const result = await analyzeReceiptWithGemini(createFile(), 'abc', 'gemini-2.5-flash', vi.fn())
    expect(result.items).toEqual([])
    expect(result.warnings).toContain(
      'Gemini did not return line items confidently. Add/edit items manually.',
    )
  })
})

describe('applyOcrPayload', () => {
  it('updates items, charges, warnings, and receipt total', () => {
    const people: Person[] = [{ id: 'p1', name: 'Alice' }]
    const payload: OcrResponse = {
      items: [
        { description: 'Laksa', amount: 12 },
        { description: 'Tea', amount: 2.5 },
      ],
      subtotal: 14.5,
      total: 15.81,
      detected: {
        serviceCharge: {
          enabled: true,
          amount: null,
          percent: 10,
          confidence: 0.9,
          source: 'gemini',
        },
        gst: {
          enabled: true,
          amount: null,
          percent: 9,
          confidence: 0.9,
          source: 'gemini',
        },
      },
      warnings: ['Check subtotal'],
    }

    let items: EditableItem[] = [
      {
        id: 'old',
        name: 'Old',
        amountInput: '1.00',
        discountPercentInput: '',
        assignment: { mode: 'single', personId: 'p1', personIds: ['p1'] },
      },
    ]
    let serviceCharge: ChargeState = defaultServiceChargeState
    let gst: ChargeState = defaultGstState
    let scanWarnings: string[] = []
    let receiptTotalInput = ''

    const setItems: Dispatch<SetStateAction<EditableItem[]>> = (next) => {
      items = setStateValue(items, next)
    }
    const setServiceCharge: Dispatch<SetStateAction<ChargeState>> = (next) => {
      serviceCharge = setStateValue(serviceCharge, next)
    }
    const setGst: Dispatch<SetStateAction<ChargeState>> = (next) => {
      gst = setStateValue(gst, next)
    }
    const setScanWarnings: Dispatch<SetStateAction<string[]>> = (next) => {
      scanWarnings = setStateValue(scanWarnings, next)
    }
    const setReceiptTotalInput: Dispatch<SetStateAction<string>> = (next) => {
      receiptTotalInput = setStateValue(receiptTotalInput, next)
    }

    applyOcrPayload(
      payload,
      people,
      setItems,
      setServiceCharge,
      setGst,
      setScanWarnings,
      setReceiptTotalInput,
    )

    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('Laksa')
    expect(items[0].amountInput).toBe('12.00')
    expect(items[0].assignment.personId).toBe('p1')
    expect(serviceCharge.mode).toBe('percent')
    expect(serviceCharge.percentInput).toBe('10')
    expect(gst.mode).toBe('percent')
    expect(gst.percentInput).toBe('9')
    expect(scanWarnings).toEqual(['Check subtotal'])
    expect(receiptTotalInput).toBe('15.81')
  })
})
