type ExportBusy = 'downloading' | 'copying' | null;

interface Props {
  busy: ExportBusy;
  copied: boolean;
  exportError: string | null;
  nativeShareSupported: boolean;
  onDownload: () => void;
  onCopy: () => void;
}

export function ExportActions({
  busy,
  copied,
  exportError,
  nativeShareSupported,
  onDownload,
  onCopy,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="export-save-image-btn"
        onClick={onDownload}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-base">
          {nativeShareSupported ? 'share' : 'image'}
        </span>
        {busy === 'downloading'
          ? 'Generating…'
          : nativeShareSupported
            ? 'Share'
            : 'Save Image'}
      </button>
      <button
        type="button"
        data-testid="export-copy-text-btn"
        onClick={onCopy}
        disabled={busy !== null}
        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-outline-variant/30 text-primary font-bold text-sm hover:border-primary transition-all disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-base">
          {copied ? 'check' : 'content_copy'}
        </span>
        {copied ? 'Copied!' : busy === 'copying' ? 'Copying…' : 'Copy Text'}
      </button>
      {exportError && <p className="text-sm text-error">{exportError}</p>}
    </div>
  );
}
