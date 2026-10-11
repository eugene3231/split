import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { GEMINI_MODELS } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';

export function GeminiApiKeyModal() {
  const isOpen = useGeminiStore((state) => state.showApiKeyModal);
  const geminiApiKeyInput = useGeminiStore((state) => state.geminiApiKeyInput);
  const geminiModel = useGeminiStore((state) => state.geminiModel);
  const setGeminiApiKeyInput = useGeminiStore((state) => state.setGeminiApiKeyInput);
  const setGeminiModel = useGeminiStore((state) => state.setGeminiModel);
  const setRememberGeminiApiKey = useGeminiStore((state) => state.setRememberGeminiApiKey);
  const setShowApiKeyModal = useGeminiStore((state) => state.setShowApiKeyModal);

  if (!isOpen) return null;

  return (
    <GeminiApiKeyModalContent
      initialKey={geminiApiKeyInput}
      initialModel={geminiModel}
      onSave={(key, model) => {
        setGeminiApiKeyInput(key);
        setGeminiModel(model);
        if (key) setRememberGeminiApiKey(true);
        setShowApiKeyModal(false);
      }}
      onClose={() => setShowApiKeyModal(false)}
    />
  );
}

interface GeminiApiKeyModalContentProps {
  initialKey: string;
  initialModel: string;
  onSave: (key: string, model: string) => void;
  onClose: () => void;
}

function GeminiApiKeyModalContent({
  initialKey,
  initialModel,
  onSave,
  onClose,
}: GeminiApiKeyModalContentProps) {
  const [localKey, setLocalKey] = useState(initialKey);
  const [localModel, setLocalModel] = useState(initialModel);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => onSave(localKey.trim(), localModel);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm motion-safe:animate-fade-in" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-surface-container-highest bg-surface-container-lowest/90 shadow-[0_8px_24px_rgba(25,28,29,0.12)] backdrop-blur-[20px] motion-safe:animate-rise-in"
        >
          {/* Header */}
          <div className="px-7 pt-7 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-headline text-xl font-extrabold tracking-tight text-primary">
                  Gemini API Key
                </Dialog.Title>
                <Dialog.Description className="mt-1 font-body text-sm text-on-surface-variant">
                  Required for AI-powered receipt scanning
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-xl">
                  close
                </span>
              </Dialog.Close>
            </div>
          </div>

          {/* Info block + input — unified px-7 section */}
          <div className="space-y-5 px-7 pb-7">
            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
              <p className="font-body text-xs leading-relaxed text-on-surface-variant">
                This app uses <span className="font-semibold text-on-surface">Google Gemini</span>{' '}
                to extract line items, prices, and charges from your receipt photo. Your key is
                stored in this browser session only and used solely to call the Gemini API.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="new-modal-gemini-api-key"
                className="block font-label text-xs font-extrabold tracking-widest text-on-surface-variant uppercase"
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
                className="w-full rounded-2xl border-2 border-transparent bg-surface-container-high px-5 py-2.5 font-body text-sm text-on-surface transition-all outline-none placeholder:text-outline focus:border-primary/20"
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

            <div className="space-y-2">
              <label
                htmlFor="new-modal-gemini-model"
                className="block font-label text-xs font-extrabold tracking-widest text-on-surface-variant uppercase"
              >
                Model
              </label>
              <select
                id="new-modal-gemini-model"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="w-full cursor-pointer rounded-2xl border-2 border-transparent bg-surface-container-high px-5 py-2.5 font-body text-sm text-on-surface transition-all outline-none focus:border-primary/20"
              >
                {GEMINI_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className="font-body text-xs text-outline">
                Choose which Gemini model to use for receipt extraction.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-label text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition-transform active:scale-[0.98]"
              >
                Save &amp; Continue
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-3 font-label text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Skip
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
