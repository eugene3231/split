import { useEffect } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  url: string;
  onClose: () => void;
}

export function ImagePreviewModal({ url, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[90vh] max-w-5xl flex-col rounded-3xl border border-surface-container-highest bg-surface-container-lowest/90 shadow-[0_8px_24px_rgba(25,28,29,0.12)] backdrop-blur-[20px]">
        <div className="flex flex-shrink-0 items-center justify-between px-5 py-4">
          <span className="text-sm font-bold text-on-surface-variant">Image Preview (dev)</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">
          <img src={url} alt="Split result preview" className="max-w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
