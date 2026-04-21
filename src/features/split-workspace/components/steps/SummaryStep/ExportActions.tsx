type ExportBusy = 'downloading' | 'copying' | 'previewing' | null;

interface Props {
  busy: ExportBusy;
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
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="export-save-image-btn"
        onClick={onDownload}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-highest px-6 py-3 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-on-primary disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-base">image</span>
        {busy === 'downloading' ? 'Generating…' : 'Save Image'}
      </button>
      <button
        type="button"
        data-testid="export-copy-text-btn"
        onClick={onShare}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 px-6 py-3 text-sm font-bold text-primary transition-all hover:border-primary disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-base">
          {copied ? 'check' : nativeShareSupported ? 'share' : 'content_copy'}
        </span>
        {copied
          ? 'Copied!'
          : busy === 'copying'
            ? 'Sharing…'
            : nativeShareSupported
              ? 'Share'
              : 'Copy Text'}
      </button>
      {import.meta.env.DEV && onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/50 px-6 py-3 text-sm font-bold text-on-surface-variant transition-all hover:border-primary hover:text-primary disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-base">preview</span>
          {busy === 'previewing' ? 'Generating…' : 'Preview Image'}
        </button>
      )}
      {exportError && <p className="text-sm text-error">{exportError}</p>}
    </div>
  );
}
