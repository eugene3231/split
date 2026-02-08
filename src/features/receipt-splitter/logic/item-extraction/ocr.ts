import type { Dispatch, SetStateAction } from 'react'
import type {
  ChargeDetection,
  ChargeState,
  EditableItem,
  GeminiGenerateContentResponse,
  OcrResponse,
  Person,
} from '../../types'
import { applyChargeDetection } from '../item-computation/charges'
import { createItemFromOcr } from './item-mapper'
import { toNullableNumber, roundMoney } from '../core/money'
import { isRecord } from '../core/guards'

export async function analyzeReceiptWithGemini(
  file: File,
  apiKeyInput: string,
  model: string,
  onStatus: (status: string) => void,
): Promise<OcrResponse> {
  const apiKey = apiKeyInput.trim()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Enter it in the OCR section.')
  }

  const selectedModel = model.trim()
  if (!selectedModel) {
    throw new Error('Missing Gemini model selection.')
  }

  onStatus('Encoding receipt...')
  const contentBase64 = await fileToBase64(file)
  const mimeType = file.type || 'image/jpeg'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(apiKey)}`

  const instruction = [
    'Extract structured receipt data from the attached file.',
    'Return valid JSON only, no markdown, no explanation.',
    'Use exactly this schema:',
    '{"items":[{"description":"string","amount":number}],"subtotal":number|null,"total":number|null,"detected":{"gst":{"enabled":boolean,"amount":number|null,"percent":number|null,"confidence":number|null,"source":"string"},"serviceCharge":{"enabled":boolean,"amount":number|null,"percent":number|null,"confidence":number|null,"source":"string"}},"warnings":["string"]}',
    'If unsure, set nullable fields to null and add a warning.',
    'Amounts must be numbers, not strings.',
  ].join('\n')

  onStatus('Calling Gemini...')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: instruction },
            {
              inline_data: {
                mime_type: mimeType,
                data: contentBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  })

  const rawBody = await response.text()
  if (!rawBody.trim()) {
    throw new Error('Gemini returned an empty response.')
  }

  let geminiPayload: GeminiGenerateContentResponse
  try {
    geminiPayload = JSON.parse(rawBody) as GeminiGenerateContentResponse
  } catch {
    throw new Error('Gemini returned non-JSON response.')
  }

  if (!response.ok || geminiPayload.error) {
    const errorMessage =
      geminiPayload.error?.message ?? `Gemini request failed (${response.status}).`
    throw new Error(errorMessage)
  }

  const modelText = extractGeminiText(geminiPayload)
  if (!modelText) {
    throw new Error('Gemini response did not include extractable content.')
  }

  onStatus('Parsing Gemini output...')
  return parseGeminiReceiptResponse(modelText)
}

export function applyOcrPayload(
  payload: OcrResponse,
  people: Person[],
  setItems: Dispatch<SetStateAction<EditableItem[]>>,
  setServiceCharge: Dispatch<SetStateAction<ChargeState>>,
  setGst: Dispatch<SetStateAction<ChargeState>>,
  setScanWarnings: Dispatch<SetStateAction<string[]>>,
  setReceiptTotalInput: Dispatch<SetStateAction<string>>,
) {
  if (payload.items.length > 0) {
    setItems(payload.items.map((item) => createItemFromOcr(item, people)))
  }

  setServiceCharge((current) => applyChargeDetection(current, payload.detected.serviceCharge))
  setGst((current) => applyChargeDetection(current, payload.detected.gst))
  setScanWarnings(payload.warnings)

  if (payload.total !== null) {
    setReceiptTotalInput(payload.total.toFixed(2))
  }
}

export function buildLocalMockOcrResponse(warningMessage: string): OcrResponse {
  return {
    items: [
      { description: 'Chicken Rice', amount: 8.5 },
      { description: 'Iced Lemon Tea', amount: 3.2 },
      { description: 'Pasta Alfredo', amount: 15.9 },
      { description: 'Truffle Fries', amount: 12.0 },
    ],
    subtotal: 39.6,
    total: 47.48,
    detected: {
      gst: {
        enabled: true,
        amount: null,
        percent: 9,
        confidence: 0.99,
        source: 'mock',
      },
      serviceCharge: {
        enabled: true,
        amount: null,
        percent: 10,
        confidence: 0.99,
        source: 'mock',
      },
    },
    warnings: [warningMessage],
  }
}

function extractGeminiText(payload: GeminiGenerateContentResponse): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []

  for (const candidate of candidates) {
    const parts = candidate.content?.parts
    if (!Array.isArray(parts)) {
      continue
    }

    const text = parts
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim()

    if (text) {
      return text
    }
  }

  return ''
}

function parseGeminiReceiptResponse(modelText: string): OcrResponse {
  const jsonBody = extractJsonObject(modelText)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBody)
  } catch {
    throw new Error('Gemini output was not valid JSON.')
  }

  if (!isRecord(parsed)) {
    throw new Error('Gemini JSON payload must be an object.')
  }

  const itemsRaw = Array.isArray(parsed.items) ? parsed.items : []
  const items = itemsRaw
    .map((item) => normalizeGeminiItem(item))
    .filter((item): item is { description: string; amount: number } => item !== null)

  const detected = isRecord(parsed.detected) ? parsed.detected : {}
  const subtotal = toNullableNumber(parsed.subtotal)
  const total = toNullableNumber(parsed.total)
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []

  if (items.length === 0) {
    warnings.push('Gemini did not return line items confidently. Add/edit items manually.')
  }

  return {
    items,
    subtotal,
    total,
    detected: {
      gst: normalizeGeminiChargeDetection(detected.gst),
      serviceCharge: normalizeGeminiChargeDetection(detected.serviceCharge),
    },
    warnings,
  }
}

function normalizeGeminiItem(value: unknown): { description: string; amount: number } | null {
  if (!isRecord(value)) {
    return null
  }

  const description =
    typeof value.description === 'string' ? value.description.replace(/\s+/g, ' ').trim() : ''
  const amount = toNullableNumber(value.amount)

  if (!description || amount === null || amount <= 0) {
    return null
  }

  return {
    description,
    amount: roundMoney(amount),
  }
}

function normalizeGeminiChargeDetection(value: unknown): ChargeDetection {
  if (!isRecord(value)) {
    return {
      enabled: false,
      amount: null,
      percent: null,
      confidence: null,
      source: 'none',
    }
  }

  const amount = toNullableNumber(value.amount)
  const percent = toNullableNumber(value.percent)
  const confidenceRaw = toNullableNumber(value.confidence)
  const confidence = confidenceRaw === null ? null : Math.max(0, Math.min(1, confidenceRaw))
  const enabled =
    value.enabled === true ||
    (amount !== null && amount !== 0) ||
    (percent !== null && percent !== 0)
  const source =
    typeof value.source === 'string' && value.source.trim()
      ? value.source.trim()
      : enabled
        ? 'gemini'
        : 'none'

  return {
    enabled,
    amount: amount === null ? null : roundMoney(amount),
    percent: percent === null ? null : roundMoney(percent),
    confidence,
    source,
  }
}

function extractJsonObject(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Gemini output was empty.')
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const objectStart = candidate.indexOf('{')
  const objectEnd = candidate.lastIndexOf('}')

  if (objectStart < 0 || objectEnd <= objectStart) {
    throw new Error('Gemini output did not include a JSON object.')
  }

  return candidate.slice(objectStart, objectEnd + 1)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read file content'))
        return
      }

      const parts = reader.result.split(',')
      resolve(parts.length > 1 ? parts[1] : parts[0])
    }

    reader.onerror = () => {
      reject(new Error('Failed to read receipt file'))
    }

    reader.readAsDataURL(file)
  })
}
