import type { Dispatch, SetStateAction } from 'react'
import type {
  ChargeDetection,
  ChargeState,
  EditableItem,
  OcrResponse,
  Person,
} from '../../../shared/types'
import { applyChargeDetection } from '../../../shared/logic/computation/charges'
import { createItemFromOcr } from './itemMapper'
import { toNullableNumber, roundMoney } from '../../../shared/logic/core/money'
export { buildLocalMockOcrResponse, buildSimpleModeMockOcrResponse } from './ocrFixtures'
import {
  geminiReceiptSchema,
  GEMINI_RECEIPT_RESPONSE_SCHEMA,
} from './gemini-schema'
import type { GeminiChargePayload } from './gemini-schema'
interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

export async function analyzeReceiptWithGemini(
  file: File,
  apiKeyInput: string,
  model: string,
  onStatus: (status: string) => void,
): Promise<OcrResponse> {
  const apiKey = apiKeyInput.trim()
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Enter it above.')
  }

  const selectedModel = model.trim()
  if (!selectedModel) {
    throw new Error('Missing Gemini model selection.')
  }

  onStatus('Encoding receipt...')
  const contentBase64 = await fileToBase64(file)
  const mimeType = file.type || 'image/jpeg'

  const prompt = [
    'Extract structured receipt data from the attached file.',
    'If unsure, set nullable fields to null and add a warning.',
    'Amounts must be numbers, not strings.',
  ].join('\n')

  onStatus('Calling Gemini...')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: contentBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RECEIPT_RESPONSE_SCHEMA,
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

function extractGeminiText(payload: GeminiGenerateContentResponse): string | null {
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? null
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


function parseGeminiReceiptResponse(text: string): OcrResponse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Gemini output was not valid JSON.')
  }

  const result = geminiReceiptSchema.safeParse(raw)
  if (!result.success) {
    throw new Error('Gemini response did not match expected schema.')
  }
  const parsed = result.data

  const items = parsed.items
    .map(normalizeGeminiItem)
    .filter((item): item is { description: string; amount: number } => item !== null)

  const warnings = [...parsed.warnings]

  if (items.length === 0) {
    warnings.push('Gemini did not return line items confidently. Add/edit items manually.')
  }

  return {
    items,
    subtotal: toNullableNumber(parsed.subtotal),
    total: toNullableNumber(parsed.total),
    detected: {
      gst: normalizeGeminiChargeDetection(parsed.detected.gst),
      serviceCharge: normalizeGeminiChargeDetection(parsed.detected.serviceCharge),
    },
    warnings,
  }
}

function normalizeGeminiItem(value: {
  description: string | null
  amount: number | null
}): { description: string; amount: number } | null {
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

function normalizeGeminiChargeDetection(value: GeminiChargePayload): ChargeDetection {
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
