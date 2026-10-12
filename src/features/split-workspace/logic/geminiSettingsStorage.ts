import { z } from 'zod';
import {
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '@features/split-workspace/constants';
import { jsonStorage } from './jsonStorage';

const ocrSettingsSchema = z.object({
  version: z.literal(1),
  geminiModel: z.string().catch(''),
  savedAt: z.string().catch(''),
});

export type PersistedOcrSettings = z.infer<typeof ocrSettingsSchema>;

const ocrSettingsStorage = jsonStorage(
  'localStorage',
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  ocrSettingsSchema,
);

export function savePersistedOcrSettings(settings: PersistedOcrSettings): void {
  ocrSettingsStorage.save(settings);
}

export function loadPersistedOcrSettings(): PersistedOcrSettings | null {
  return ocrSettingsStorage.load();
}

// The key is kept as plain text, not JSON, and only for the tab session.

export function saveSessionGeminiApiKey(apiKey: string): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_GEMINI_API_KEY, apiKey);
  } catch {
    // Storage is full or blocked.
  }
}

export function loadSessionGeminiApiKey(): string {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_GEMINI_API_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearSessionGeminiApiKey(): void {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_GEMINI_API_KEY);
  } catch {
    // Storage is blocked.
  }
}
