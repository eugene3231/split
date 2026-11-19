import type { OcrResponse, ChargeDetection } from '@shared/types';
import { toNullableNumber, roundMoney } from '@shared/logic/core/money';
import { geminiReceiptSchema } from '@features/receipt-scanner/logic/gemini-schema';
import type { GeminiChargePayload } from '@features/receipt-scanner/logic/gemini-schema';

export function parseGeminiReceiptResponse(text: string): OcrResponse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Gemini output was not valid JSON.');
  }

  const result = geminiReceiptSchema.safeParse(raw);
  if (!result.success) {
    throw new Error('Gemini response did not match expected schema.');
  }
  const parsed = result.data;

  const items = parsed.items
    .map(normalizeGeminiItem)
    .filter((item): item is { description: string; amount: number } => item !== null);

  const warnings = [...parsed.warnings];

  if (items.length === 0) {
    warnings.push('Gemini did not return line items confidently. Add/edit items manually.');
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
  };
}

function normalizeGeminiItem(value: {
  description: string | null;
  amount: number | null;
}): { description: string; amount: number } | null {
  const description =
    typeof value.description === 'string' ? value.description.replace(/\s+/g, ' ').trim() : '';
  const amount = toNullableNumber(value.amount);

  if (!description || amount === null || amount <= 0) {
    return null;
  }

  return {
    description,
    amount: roundMoney(amount),
  };
}

function normalizeGeminiChargeDetection(value: GeminiChargePayload): ChargeDetection {
  const amount = toNullableNumber(value.amount);
  const percent = toNullableNumber(value.percent);
  const confidenceRaw = toNullableNumber(value.confidence);
  const confidence = confidenceRaw === null ? null : Math.max(0, Math.min(1, confidenceRaw));
  const enabled =
    value.enabled === true ||
    (amount !== null && amount !== 0) ||
    (percent !== null && percent !== 0);
  const source =
    typeof value.source === 'string' && value.source.trim()
      ? value.source.trim()
      : enabled
        ? 'gemini'
        : 'none';

  return {
    enabled,
    amount: amount === null ? null : roundMoney(amount),
    percent: percent === null ? null : roundMoney(percent),
    confidence,
    source,
  };
}
