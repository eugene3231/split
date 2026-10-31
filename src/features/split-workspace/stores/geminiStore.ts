import { create } from 'zustand';
import {
  clearSessionGeminiApiKey,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from '@features/split-workspace/logic/geminiSettingsStorage';
import { normalizeGeminiModel } from '@features/receipt-scanner/logic/geminiModel';

type GeminiStore = {
  geminiApiKeyInput: string;
  geminiModel: string;
  showApiKeyModal: boolean;
  apiKeyModalReason: string | null;
  setGeminiApiKeyInput: (next: string) => void;
  setGeminiModel: (next: string) => void;
  setShowApiKeyModal: (show: boolean) => void;
  openApiKeyModalFor: (reason: string) => void;
};

function loadInitialGeminiModel(): string {
  const persistedSettings = loadPersistedOcrSettings();
  return normalizeGeminiModel(persistedSettings?.geminiModel ?? '');
}

export const useGeminiStore = create<GeminiStore>((set) => ({
  geminiApiKeyInput: loadSessionGeminiApiKey(),
  geminiModel: loadInitialGeminiModel(),
  showApiKeyModal: false,
  apiKeyModalReason: null,

  // The key lives for the tab session only; an empty key forgets it.
  setGeminiApiKeyInput: (next) => {
    if (next.trim()) saveSessionGeminiApiKey(next);
    else clearSessionGeminiApiKey();
    set({ geminiApiKeyInput: next });
  },
  setGeminiModel: (next) => {
    const normalizedModel = normalizeGeminiModel(next);
    savePersistedOcrSettings({
      version: 1,
      geminiModel: normalizedModel,
      savedAt: new Date().toISOString(),
    });
    set({ geminiModel: normalizedModel });
  },
  setShowApiKeyModal: (show) => set({ showApiKeyModal: show, apiKeyModalReason: null }),
  openApiKeyModalFor: (reason) => set({ showApiKeyModal: true, apiKeyModalReason: reason }),
}));
