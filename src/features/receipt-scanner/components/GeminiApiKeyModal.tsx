import { useState, useRef, type KeyboardEvent } from 'react'
import { useReceiptStore } from '../../../shared/stores/receiptStore'

export function GeminiApiKeyModal() {
  const isOpen = useReceiptStore((state) => state.showApiKeyModal)
  const geminiApiKeyInput = useReceiptStore((state) => state.geminiApiKeyInput)
  const setGeminiApiKeyInput = useReceiptStore((state) => state.setGeminiApiKeyInput)
  const setRememberGeminiApiKey = useReceiptStore((state) => state.setRememberGeminiApiKey)
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal)

  if (!isOpen) return null

  return (
    <GeminiApiKeyModalContent
      initialKey={geminiApiKeyInput}
      onSave={(key) => {
        setGeminiApiKeyInput(key)
        if (key) setRememberGeminiApiKey(true)
        setShowApiKeyModal(false)
      }}
      onClose={() => setShowApiKeyModal(false)}
    />
  )
}

interface GeminiApiKeyModalContentProps {
  initialKey: string
  onSave: (key: string) => void
  onClose: () => void
}

function GeminiApiKeyModalContent({ initialKey, onSave, onClose }: GeminiApiKeyModalContentProps) {
  const [localKey, setLocalKey] = useState(initialKey)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => onSave(localKey.trim())

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-slate-100">Add Gemini API key</h2>
            <p className="mt-0.5 text-xs text-slate-400">Required for AI receipt scanning</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/8 hover:text-slate-200"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <ul className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-xs leading-relaxed text-slate-300">
            <li>This app uses{' '}
            <span className="font-semibold text-slate-100">Google Gemini</span> to extract line items,
            prices, and charges from your receipt photo.</li>
            <li> Your key is stored only in this browser
            session and is used to interact with the Gemini API only.</li>
          </ul>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300" htmlFor="modal-gemini-api-key">
              API Key
            </label>
            <input
              ref={inputRef}
              id="modal-gemini-api-key"
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              placeholder="AIza..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
            />
            <p className="text-xs text-slate-500">
              Get your free key at{' '}
              <a
                href="https://aistudio.google.com/app/api-keys"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-400 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-300"
              >
                Google AI Studio ↗
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-white/8 px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.98]"
          >
            Save and Continue
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
