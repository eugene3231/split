import { cn } from '@shared/utils/cn';
import { useState } from 'react';

type ExportBusy = 'downloading' | 'copying' | 'previewing' | null;

interface Props {
  busy: ExportBusy | false;
  copied: boolean;
  exportError: string | null;
  nativeShareSupported: boolean;
  onDownload: () => void;
  onShare: () => void;
  onPreview?: () => void;
}

export function ExportActions({
  busy,
  copied,
  exportError,
  nativeShareSupported,
  onDownload,
  onShare,
  onPreview,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const normalizedBusy = busy || null;
  const saveIsBusy = normalizedBusy === 'downloading';
  const shareIsBusy = normalizedBusy === 'copying';
  const previewIsBusy = normalizedBusy === 'previewing';
  const shareLabel = copied
    ? 'Copied'
    : shareIsBusy
      ? 'Sharing'
      : nativeShareSupported
        ? 'Share'
        : 'Copy text';
  const disabled = normalizedBusy !== null;

  return (
    <>
      <div className="hidden space-y-2 md:block">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
          <button
            type="button"
            data-testid="export-copy-text-btn"
            onClick={onShare}
            disabled={disabled}
            aria-busy={shareIsBusy}
            className={cn(
              'group flex min-h-14 items-center justify-center gap-2 rounded-[16px] bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-ink/15 transition-all',
              'hover:-translate-y-0.5 hover:opacity-95 hover:shadow-md',
              'focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:outline-none',
              'disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
              copied && 'bg-accent-green text-ink',
            )}
          >
            <span
              className={cn('material-symbols-outlined text-[20px]', shareIsBusy && 'animate-spin')}
            >
              {shareIsBusy
                ? 'progress_activity'
                : copied
                  ? 'check'
                  : nativeShareSupported
                    ? 'ios_share'
                    : 'content_copy'}
            </span>
            {shareLabel}
          </button>

          <button
            type="button"
            data-testid="export-save-image-btn"
            onClick={onDownload}
            disabled={disabled}
            aria-busy={saveIsBusy}
            className={cn(
              'group flex min-h-14 items-center justify-center gap-2 rounded-[16px] bg-cream px-4 py-3 text-sm font-semibold text-ink transition-all',
              'hover:-translate-y-0.5 hover:bg-cream-dim/70 hover:shadow-sm',
              'focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:outline-none',
              'disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
            )}
          >
            <span
              className={cn('material-symbols-outlined text-[20px]', saveIsBusy && 'animate-spin')}
            >
              {saveIsBusy ? 'progress_activity' : 'image'}
            </span>
            {saveIsBusy ? 'Generating' : 'Save image'}
          </button>
        </div>

        {import.meta.env.DEV && onPreview && (
          <button
            type="button"
            onClick={onPreview}
            disabled={disabled}
            aria-busy={previewIsBusy}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-cream-dim px-4 py-3 text-sm font-semibold text-ink2 transition-colors hover:bg-cream focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55"
          >
            <span
              className={cn('material-symbols-outlined text-base', previewIsBusy && 'animate-spin')}
            >
              {previewIsBusy ? 'progress_activity' : 'preview'}
            </span>
            {previewIsBusy ? 'Generating' : 'Preview image'}
          </button>
        )}
        {exportError && <p className="text-sm text-error">{exportError}</p>}
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-50 bg-bg/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
        <button
          type="button"
          data-testid="summary-share-sheet-trigger"
          onClick={() => setSheetOpen(true)}
          disabled={disabled}
          className={cn(
            'flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-ink px-5 py-4 text-sm font-semibold text-white shadow-sm shadow-ink/20 transition-all active:scale-[0.99]',
            'focus-visible:ring-2 focus-visible:ring-ink/20 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-55',
          )}
        >
          <span className="material-symbols-outlined text-[20px]">ios_share</span>
          Share split
        </button>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            aria-label="Close share options"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute right-0 bottom-0 left-0 rounded-t-[28px] bg-bg p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-2xl font-semibold text-ink">Share split</p>
                <p className="text-sm text-ink2">Choose what to send.</p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close share options"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-ink2 transition-colors hover:text-ink"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                data-testid="export-copy-text-btn"
                onClick={onShare}
                disabled={disabled}
                aria-busy={shareIsBusy}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[16px] bg-ink px-4 py-4 text-left text-white transition-all',
                  'disabled:cursor-not-allowed disabled:opacity-55',
                  copied && 'bg-accent-green text-ink',
                )}
              >
                <span
                  className={cn(
                    'material-symbols-outlined text-[22px]',
                    shareIsBusy && 'animate-spin',
                  )}
                >
                  {shareIsBusy
                    ? 'progress_activity'
                    : copied
                      ? 'check'
                      : nativeShareSupported
                        ? 'ios_share'
                        : 'content_copy'}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{shareLabel}</span>
                  <span className="block text-xs text-white/65">
                    {nativeShareSupported ? 'Open the native share sheet' : 'Copy recap text'}
                  </span>
                </span>
              </button>

              <button
                type="button"
                data-testid="export-save-image-btn"
                onClick={onDownload}
                disabled={disabled}
                aria-busy={saveIsBusy}
                className="flex w-full items-center gap-3 rounded-[16px] bg-cream px-4 py-4 text-left text-ink transition-colors hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span
                  className={cn(
                    'material-symbols-outlined text-[22px]',
                    saveIsBusy && 'animate-spin',
                  )}
                >
                  {saveIsBusy ? 'progress_activity' : 'image'}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {saveIsBusy ? 'Generating' : 'Save image'}
                  </span>
                  <span className="block text-xs text-ink2">Includes PayNow QRs</span>
                </span>
              </button>

              {import.meta.env.DEV && onPreview && (
                <button
                  type="button"
                  onClick={onPreview}
                  disabled={disabled}
                  aria-busy={previewIsBusy}
                  className="flex w-full items-center gap-3 rounded-[16px] border border-dashed border-cream-dim px-4 py-4 text-left text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span
                    className={cn(
                      'material-symbols-outlined text-[22px]',
                      previewIsBusy && 'animate-spin',
                    )}
                  >
                    {previewIsBusy ? 'progress_activity' : 'preview'}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {previewIsBusy ? 'Generating' : 'Preview image'}
                    </span>
                    <span className="block text-xs text-ink2">Development preview</span>
                  </span>
                </button>
              )}
            </div>

            {exportError && <p className="mt-3 text-sm text-error">{exportError}</p>}
          </div>
        </div>
      )}
    </>
  );
}
