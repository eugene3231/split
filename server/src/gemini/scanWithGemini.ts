import { z } from 'zod';
import type { OcrResponse } from '@shared/types';
import { GEMINI_RECEIPT_RESPONSE_SCHEMA } from '@features/receipt-scanner/logic/gemini-schema';
import { parseGeminiReceiptResponse } from '@features/receipt-scanner/logic/receiptParser';
import { RECEIPT_SCAN_PROMPT } from '@features/receipt-scanner/logic/scanPrompt';

export interface TokenUsage {
  promptTokens: number | null;
  outputTokens: number | null;
}

export type GeminiScan =
  | { outcome: 'scanned'; receipt: OcrResponse; usage: TokenUsage }
  | { outcome: 'unreadable'; usage: TokenUsage }
  | { outcome: 'unavailable'; reason: 'timeout' | 'network' | 'rejected' };

interface ScanWithGeminiOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  bytes: Uint8Array;
  mimeType: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

const generateContentResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

const NO_USAGE: TokenUsage = { promptTokens: null, outputTokens: null };

export async function scanWithGemini(options: ScanWithGeminiOptions): Promise<GeminiScan> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/v1beta/models/${options.model}:generateContent`;
  let response: Response;
  let rawBody: string;
  try {
    response = await options.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: RECEIPT_SCAN_PROMPT },
              {
                inlineData: {
                  mimeType: options.mimeType,
                  data: Buffer.from(options.bytes).toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RECEIPT_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    rawBody = await response.text();
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return { outcome: 'unavailable', reason: timedOut ? 'timeout' : 'network' };
  }

  if (!response.ok) return { outcome: 'unavailable', reason: 'rejected' };

  let payload: z.infer<typeof generateContentResponse>;
  try {
    payload = generateContentResponse.parse(JSON.parse(rawBody));
  } catch {
    return { outcome: 'unreadable', usage: NO_USAGE };
  }
  const usage: TokenUsage = {
    promptTokens: payload.usageMetadata?.promptTokenCount ?? null,
    outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { outcome: 'unreadable', usage };
  try {
    return { outcome: 'scanned', receipt: parseGeminiReceiptResponse(text), usage };
  } catch {
    return { outcome: 'unreadable', usage };
  }
}
