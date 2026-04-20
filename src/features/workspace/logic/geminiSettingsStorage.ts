import {
  LOCAL_STORAGE_OCR_SETTINGS_KEY,
  SESSION_STORAGE_GEMINI_API_KEY,
} from '@features/workspace/constants';
import type { PersistedOcrSettings } from '@shared/types';
import { isRecord } from '@shared/logic/core/guards';
function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getBrowserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePersistedOcrSettings(settings: PersistedOcrSettings): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LOCAL_STORAGE_OCR_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures.
  }
}

export function loadPersistedOcrSettings(): PersistedOcrSettings | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_OCR_SETTINGS_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    return {
      version: 1,
      geminiModel: typeof parsed.geminiModel === 'string' ? parsed.geminiModel : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

export function saveSessionGeminiApiKey(apiKey: string): void {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(SESSION_STORAGE_GEMINI_API_KEY, apiKey);
  } catch {
    // Ignore storage write failures.
  }
}

export function loadSessionGeminiApiKey(): string {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem(SESSION_STORAGE_GEMINI_API_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearSessionGeminiApiKey(): void {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SESSION_STORAGE_GEMINI_API_KEY);
  } catch {
    // Ignore storage remove failures.
  }
}
