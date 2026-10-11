import { useId, useRef } from 'react';
import { cn } from '@shared/utils/cn';
import type { SummaryExportState } from './useSummaryExport';

interface Props {
  appearance?: 'buttons' | 'icons';
  exportState: SummaryExportState;
  text: string;
  nativeShareSupported: boolean;
  onDownload: () => void;
  onShare: () => void;
  onPreview?: () => void;
}

export function ExportActions({
  appearance = 'buttons',
  exportState,
  text,
  nativeShareSupported,
  onDownload,
  onShare,
  onPreview,
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
        : 'Copy Text';

  const icons = appearance === 'icons';
  const downloadLabel = busy === 'download' ? 'Generating…' : 'Save Image';
  return (
    <div className={cn('flex gap-2', icons ? 'flex-wrap justify-end' : 'flex-col')}>
      <button
        type="button"
        data-testid="export-save-image-btn"
        aria-label={downloadLabel}
        title={downloadLabel}
        onClick={onDownload}
        disabled={busy !== null}
        className={cn(
          'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-on-primary transition-all hover:bg-primary-container disabled:opacity-60',
          icons ? 'p-2.5' : 'px-6 py-3',
        )}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          {icons ? 'download' : 'image'}
        </span>
        <span className={icons ? 'sr-only' : undefined}>{downloadLabel}</span>
      </button>
      <button
        type="button"
        data-testid="export-copy-text-btn"
        aria-label={shareLabel}
        title={shareLabel}
        onClick={onShare}
        disabled={busy !== null}
        aria-live="polite"
        className={cn(
          'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest text-sm font-bold text-primary transition-all hover:border-primary disabled:opacity-60',
          icons ? 'p-2.5' : 'px-6 py-3',
        )}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          {textSuccess ? 'check' : nativeShareSupported ? 'share' : 'content_copy'}
        </span>
        <span className={icons ? 'sr-only' : undefined}>{shareLabel}</span>
      </button>
      {!icons && import.meta.env.DEV && onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/50 px-6 py-3 text-sm font-bold text-on-surface-variant transition-all hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            preview
          </span>
          {busy === 'preview' ? 'Generating…' : 'Preview Image'}
        </button>
      )}
      {error && (
        <p id={`${textId}-error`} role="alert" className="w-full text-sm text-error">
          {error}
        </p>
      )}
      {exportState.kind === 'manual-copy' && (
        <div className="w-full space-y-2 rounded-xl border border-outline-variant/30 p-3">
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
