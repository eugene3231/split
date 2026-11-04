import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { cn } from '@shared/utils/cn';

export function GeminiApiKeyModal() {
  const isOpen = useGeminiStore((state) => state.showApiKeyModal);
  const geminiApiKeyInput = useGeminiStore((state) => state.geminiApiKeyInput);
  const geminiModel = useGeminiStore((state) => state.geminiModel);
  const setGeminiApiKeyInput = useGeminiStore((state) => state.setGeminiApiKeyInput);
  const setGeminiModel = useGeminiStore((state) => state.setGeminiModel);
  const setShowApiKeyModal = useGeminiStore((state) => state.setShowApiKeyModal);

  if (!isOpen) return null;

  return (
    <GeminiApiKeyModalContent
      initialKey={geminiApiKeyInput}
      initialModel={geminiModel}
      onSave={(key, model) => {
        setGeminiApiKeyInput(key);
        setGeminiModel(model);
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
  const [isKeyVisible, setIsKeyVisible] = useState(false);
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
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-surface-container-highest bg-surface-container-lowest shadow-[0_24px_48px_-12px_rgba(23,28,39,0.25)] motion-safe:animate-rise-in"
        >
          <div className="px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="font-headline text-xl font-bold text-on-surface">
                Gemini API key
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-xl">
                  close
                </span>
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 font-body text-sm text-on-surface-variant">
              Gemini reads the items, prices and charges from your receipt photo. Skip this to add
              items yourself.
            </Dialog.Description>
          </div>

          <div className="space-y-5 px-6 pb-6 sm:px-7 sm:pb-7">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="new-modal-gemini-api-key" className="block section-label">
                  API key
                </label>
                <a
                  href="https://aistudio.google.com/app/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md text-sm font-medium text-on-surface-variant underline-offset-2 transition-colors hover:text-on-surface hover:underline',
                    !initialKey && 'motion-safe:animate-nudge motion-safe:[animation-delay:400ms]',
                  )}
                >
                  Get a free key
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-sm! leading-none!"
                  >
                    open_in_new
                  </span>
                  <span className="sr-only">(opens Google AI Studio in a new tab)</span>
                </a>
              </div>
              <div className="relative">
                <input
                  ref={inputRef}
                  id="new-modal-gemini-api-key"
                  type={isKeyVisible ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  placeholder="AIza…"
                  className="h-11 w-full field py-2.5 pr-12 pl-4 font-body text-sm text-on-surface outline-none placeholder:text-outline"
                />
                <button
                  type="button"
                  aria-label={isKeyVisible ? 'Hide key' : 'Show key'}
                  aria-pressed={isKeyVisible}
                  onClick={() => setIsKeyVisible((visible) => !visible)}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-xl!">
                    {isKeyVisible ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <p className="flex items-start gap-1 font-body text-xs text-pretty text-on-surface-variant">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined mt-px -ml-px text-sm! leading-none!"
                >
                  lock
                </span>
                Your key stays in this tab and goes only to Google.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="new-modal-gemini-model" className="block section-label">
                Model
              </label>
              <div className="relative flex items-center field">
                <select
                  id="new-modal-gemini-model"
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  className="h-11 w-full cursor-pointer appearance-none bg-transparent pr-10 pl-4 font-body text-sm text-on-surface outline-none"
                >
                  {GEMINI_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model === DEFAULT_GEMINI_MODEL ? `${model} (default)` : model}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined pointer-events-none absolute right-3 text-xl text-on-surface-variant"
                >
                  expand_more
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container active:scale-[0.98]"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
