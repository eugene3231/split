import type { OcrResponse } from '@shared/types';
import { GEMINI_RECEIPT_RESPONSE_SCHEMA } from '@features/receipt-scanner/logic/gemini-schema';
import { RECEIPT_SCAN_PROMPT } from '@features/receipt-scanner/logic/scanPrompt';
import { parseGeminiReceiptResponse } from '@features/receipt-scanner/logic/receiptParser';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function analyzeReceiptWithGemini(
  file: File,
  apiKeyInput: string,
  model: string,
): Promise<OcrResponse> {
  const apiKey = apiKeyInput.trim();
  if (!apiKey) {
    throw new Error('Missing Gemini API key. Enter it above.');
  }

  const selectedModel = model.trim();
  if (!selectedModel) {
    throw new Error('Missing Gemini model selection.');
  }

  const contentBase64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: RECEIPT_SCAN_PROMPT }, { inlineData: { mimeType, data: contentBase64 } }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RECEIPT_RESPONSE_SCHEMA,
      },
    }),
  });

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    throw new Error('Gemini returned an empty response.');
  }

  let geminiPayload: GeminiGenerateContentResponse;
  try {
    geminiPayload = JSON.parse(rawBody) as GeminiGenerateContentResponse;
  } catch {
    throw new Error('Gemini returned non-JSON response.');
  }

  if (!response.ok || geminiPayload.error) {
    const errorMessage =
      geminiPayload.error?.message ?? `Gemini request failed (${response.status}).`;
    throw new Error(errorMessage);
  }

  const modelText = extractGeminiText(geminiPayload);
  if (!modelText) {
    throw new Error('Gemini response did not include extractable content.');
  }

  return parseGeminiReceiptResponse(modelText);
}

function extractGeminiText(payload: GeminiGenerateContentResponse): string | null {
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read file content'));
        return;
      }

      const parts = reader.result.split(',');
      resolve(parts.length > 1 ? parts[1] : parts[0]);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read receipt file'));
    };

    reader.readAsDataURL(file);
  });
}
