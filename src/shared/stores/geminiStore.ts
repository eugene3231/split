import { create } from 'zustand';
import {
  clearSessionGeminiApiKey,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from '@shared/api/storage';
import { normalizeGeminiModel } from '@shared/logic/core/geminiModel';

type GeminiStore = {
  geminiApiKeyInput: string;
  rememberGeminiApiKey: boolean;
  geminiModel: string;
  showApiKeyModal: boolean;
  setGeminiApiKeyInput: (next: string) => void;
  setRememberGeminiApiKey: (next: boolean) => void;
  setGeminiModel: (next: string) => void;
  setShowApiKeyModal: (show: boolean) => void;
};

function syncGeminiApiKeyPersistence(apiKey: string, rememberApiKey: boolean): void {
  if (rememberApiKey && apiKey.trim()) {
    saveSessionGeminiApiKey(apiKey);
    return;
  }
  clearSessionGeminiApiKey();
}

const initialGeminiApiKey = loadSessionGeminiApiKey();

function loadInitialGeminiModel(): string {
  const persistedSettings = loadPersistedOcrSettings();
  return normalizeGeminiModel(persistedSettings?.geminiModel ?? '');
}

export const useGeminiStore = create<GeminiStore>((set) => ({
  geminiApiKeyInput: initialGeminiApiKey,
  rememberGeminiApiKey: initialGeminiApiKey.trim().length > 0,
  geminiModel: loadInitialGeminiModel(),
  showApiKeyModal: false,

  setGeminiApiKeyInput: (next) =>
    set((state) => {
      syncGeminiApiKeyPersistence(next, state.rememberGeminiApiKey);
      return { geminiApiKeyInput: next };
    }),
  setRememberGeminiApiKey: (next) =>
    set((state) => {
      syncGeminiApiKeyPersistence(state.geminiApiKeyInput, next);
      return { rememberGeminiApiKey: next };
    }),
  setGeminiModel: (next) => {
    const normalizedModel = normalizeGeminiModel(next);
    savePersistedOcrSettings({
      version: 1,
      geminiModel: normalizedModel,
      savedAt: new Date().toISOString(),
    });
    set({ geminiModel: normalizedModel });
  },
  setShowApiKeyModal: (show) => set({ showApiKeyModal: show }),
}));
