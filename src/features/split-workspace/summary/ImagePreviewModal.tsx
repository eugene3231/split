import { Dialog } from 'radix-ui';

interface Props {
  url: string;
  onClose: () => void;
}

export function ImagePreviewModal({ url, onClose }: Props) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-on-surface/40 backdrop-blur-sm motion-safe:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[60] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-surface-container-highest bg-surface-container-lowest/90 shadow-[0_8px_24px_rgba(25,28,29,0.12)] backdrop-blur-[20px] motion-safe:animate-rise-in"
        >
          <div className="flex flex-shrink-0 items-center justify-between px-5 py-4">
            <Dialog.Title className="text-sm font-bold text-on-surface-variant">
              Image Preview (dev)
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-xl">
                close
              </span>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pb-5">
            <img src={url} alt="Split result preview" className="max-w-full rounded-xl" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
