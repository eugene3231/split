import { useId, useRef } from 'react';
import type { SummaryExportState } from './useSummaryExport';

interface Props {
  exportState: SummaryExportState;
  text: string;
  nativeShareSupported: boolean;
  onDownload: () => void;
  onShare: () => void;
  onPreview?: () => void;
}

export function ExportActions({
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

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="export-save-image-btn"
        onClick={onDownload}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-6 py-3 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-on-primary disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          image
        </span>
        {busy === 'download' ? 'Generating…' : 'Save Image'}
      </button>
      <button
        type="button"
        data-testid="export-copy-text-btn"
        onClick={onShare}
        disabled={busy !== null}
        aria-live="polite"
        className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-6 py-3 text-sm font-bold text-primary transition-all hover:border-primary disabled:opacity-60"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          {textSuccess ? 'check' : nativeShareSupported ? 'share' : 'content_copy'}
        </span>
        {shareLabel}
      </button>
      {import.meta.env.DEV && onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/50 px-6 py-3 text-sm font-bold text-on-surface-variant transition-all hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-base">
            preview
          </span>
          {busy === 'preview' ? 'Generating…' : 'Preview Image'}
        </button>
      )}
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
