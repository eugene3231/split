import { useEffect, useRef } from 'react'
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '../../../shared/constants'
import {
  clearSessionGeminiApiKey,
  loadPersistedOcrSettings,
  loadSessionGeminiApiKey,
  savePersistedOcrSettings,
  saveSessionGeminiApiKey,
} from '../../../shared/api/storage'
import { useReceiptUiStore } from '../../../shared/stores/receiptUiStore'

export function useGeminiSettings() {
  const hasHydratedSettingsRef = useRef(false)
  const geminiApiKeyInput = useReceiptUiStore((state) => state.geminiApiKeyInput)
  const rememberGeminiApiKey = useReceiptUiStore((state) => state.rememberGeminiApiKey)
  const geminiModel = useReceiptUiStore((state) => state.geminiModel)
  const setGeminiApiKeyInput = useReceiptUiStore((state) => state.setGeminiApiKeyInput)
  const setRememberGeminiApiKey = useReceiptUiStore((state) => state.setRememberGeminiApiKey)
  const setGeminiModel = useReceiptUiStore((state) => state.setGeminiModel)

  useEffect(() => {
    const ocrSettings = loadPersistedOcrSettings()
    if (ocrSettings) {
      setGeminiModel(
        GEMINI_MODELS.includes(ocrSettings.geminiModel as (typeof GEMINI_MODELS)[number])
          ? ocrSettings.geminiModel
          : DEFAULT_GEMINI_MODEL,
      )
    }

    const sessionGeminiApiKey = loadSessionGeminiApiKey()
    if (sessionGeminiApiKey) {
      setGeminiApiKeyInput(sessionGeminiApiKey)
      setRememberGeminiApiKey(true)
    }

    hasHydratedSettingsRef.current = true
  }, [setGeminiApiKeyInput, setGeminiModel, setRememberGeminiApiKey])

  useEffect(() => {
    if (!hasHydratedSettingsRef.current) {
      return
    }

    savePersistedOcrSettings({
      version: 1,
      geminiModel,
      savedAt: new Date().toISOString(),
    })
  }, [geminiModel])

  useEffect(() => {
    if (!hasHydratedSettingsRef.current) {
      return
    }

    if (rememberGeminiApiKey && geminiApiKeyInput.trim()) {
      saveSessionGeminiApiKey(geminiApiKeyInput)
      return
    }

    clearSessionGeminiApiKey()
  }, [geminiApiKeyInput, rememberGeminiApiKey])
}
