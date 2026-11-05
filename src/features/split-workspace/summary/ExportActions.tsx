import { useId, useRef } from 'react';
import { cn } from '@shared/utils/cn';
import type { SummaryExportState } from './useSummaryExport';

interface SaveImageButtonProps {
  exportState: SummaryExportState;
  onDownload: () => void;
}

/** The summary's primary action. It sits in the bottom bar, where other steps put Continue. */
export function SaveImageButton({ exportState, onDownload }: SaveImageButtonProps) {
  const busy = exportState.kind === 'busy' ? exportState.action : null;
  return (
    <button
      type="button"
      data-testid="export-save-image-btn"
      onClick={onDownload}
      disabled={busy !== null}
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-primary transition-all active:scale-95 disabled:opacity-60"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-lg">
        image
      </span>
      {busy === 'download' ? 'Generating…' : 'Save image'}
    </button>
  );
}

interface Props {
  exportState: SummaryExportState;
  text: string;
  nativeShareSupported: boolean;
  onShare: () => void;
  onPreview?: () => void;
  className?: string;
}

export function ExportActions({
  exportState,
  text,
  nativeShareSupported,
  onShare,
  onPreview,
  className,
}: Props) {
  const textId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const busy = exportState.kind === 'busy' ? exportState.action : null;
  const textSuccess = exportState.kind === 'text-success';
  const error =
    exportState.kind === 'error' || exportState.kind === 'manual-copy' ? exportState.message : null;
  const shareLabel = textSuccess
    ? exportState.method === 'native'
      ? 'Shared!'
      : 'Copied!'
    : busy === 'share'
      ? nativeShareSupported
        ? 'Sharing…'
        : 'Copying…'
      : nativeShareSupported
        ? 'Share'
        : 'Copy text';

  const secondaryClass =
    'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-outline hover:bg-surface-container-low disabled:opacity-60';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="export-copy-text-btn"
          onClick={onShare}
          disabled={busy !== null}
          aria-live="polite"
          className={secondaryClass}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-lg">
            {textSuccess ? 'check' : nativeShareSupported ? 'share' : 'content_copy'}
          </span>
          {shareLabel}
        </button>
        {import.meta.env.DEV && onPreview && (
          <button
            type="button"
            onClick={onPreview}
            disabled={busy !== null}
            className={secondaryClass}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-lg">
              preview
            </span>
            {busy === 'preview' ? 'Generating…' : 'Preview'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${textId}-error`} role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {exportState.kind === 'manual-copy' && (
        <div className="space-y-2 rounded-xl border border-outline-variant/30 p-3">
          <label htmlFor={textId} className="block text-sm font-semibold text-on-surface">
            Split text
          </label>
          <textarea
            id={textId}
            ref={textRef}
            value={text}
            readOnly
            rows={5}
            spellCheck={false}
            aria-describedby={`${textId}-error`}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => {
              textRef.current?.focus();
              textRef.current?.select();
            }}
            className="rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-highest"
          >
            Select text
          </button>
        </div>
      )}
    </div>
  );
}
