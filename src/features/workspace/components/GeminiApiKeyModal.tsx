import { useState, useRef, type KeyboardEvent } from 'react';
import { useGeminiStore } from '@features/workspace/stores/geminiStore';

export function GeminiApiKeyModal() {
  const isOpen = useGeminiStore((state) => state.showApiKeyModal);
  const geminiApiKeyInput = useGeminiStore((state) => state.geminiApiKeyInput);
  const setGeminiApiKeyInput = useGeminiStore((state) => state.setGeminiApiKeyInput);
  const setRememberGeminiApiKey = useGeminiStore((state) => state.setRememberGeminiApiKey);
  const setShowApiKeyModal = useGeminiStore((state) => state.setShowApiKeyModal);

  if (!isOpen) return null;

  return (
    <GeminiApiKeyModalContent
      initialKey={geminiApiKeyInput}
      onSave={(key) => {
        setGeminiApiKeyInput(key);
        if (key) setRememberGeminiApiKey(true);
        setShowApiKeyModal(false);
      }}
      onClose={() => setShowApiKeyModal(false)}
    />
  );
}

interface GeminiApiKeyModalContentProps {
  initialKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

function GeminiApiKeyModalContent({ initialKey, onSave, onClose }: GeminiApiKeyModalContentProps) {
  const [localKey, setLocalKey] = useState(initialKey);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => onSave(localKey.trim());

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card — glassmorphic */}
      <div className="relative w-full max-w-md rounded-3xl border border-surface-container-highest bg-surface-container-lowest/90 shadow-[0_8px_24px_rgba(25,28,29,0.12)] backdrop-blur-[20px]">
        {/* Header */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline text-xl font-extrabold tracking-tight text-primary">
                Gemini API Key
              </h2>
              <p className="font-body mt-1 text-sm text-on-surface-variant">
                Required for AI-powered receipt scanning
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Info block + input — unified px-7 section */}
        <div className="space-y-5 px-7 pb-7">
          <div className="rounded-2xl bg-surface-container-low px-5 py-4">
            <p className="font-body text-xs leading-relaxed text-on-surface-variant">
              This app uses <span className="font-semibold text-on-surface">Google Gemini</span> to
              extract line items, prices, and charges from your receipt photo. Your key is stored in
              this browser session only and used solely to call the Gemini API.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="new-modal-gemini-api-key"
              className="font-label block text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase"
            >
              API Key
            </label>
            <input
              ref={inputRef}
              id="new-modal-gemini-api-key"
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="AIza…"
              className="font-body w-full rounded-2xl border-2 border-transparent bg-surface-container-high px-5 py-2.5 text-sm text-on-surface transition-all outline-none placeholder:text-outline focus:border-primary/20"
            />
            <p className="font-body text-xs text-outline">
              Get your free key at{' '}
              <a
                href="https://aistudio.google.com/app/api-keys"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                Google AI Studio ↗
              </a>
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="font-label flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition-transform active:scale-[0.98]"
            >
              Save &amp; Continue
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-label rounded-xl px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
