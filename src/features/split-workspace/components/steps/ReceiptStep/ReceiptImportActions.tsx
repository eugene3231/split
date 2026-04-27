import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useScanStore, getScanState } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { cn } from '@shared/utils/cn';

interface Props {
  onReceiptFileSelected: (file: File | null) => void;
  onScanReceipt: () => void;
  mockReceipts: Array<{ label: string; onLoad: () => void }>;
}

export function ReceiptImportActions({
  onReceiptFileSelected,
  onScanReceipt,
  mockReceipts,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasApiKey = useGeminiStore((s) => s.geminiApiKeyInput.trim().length > 0);
  const receiptFile = useReceiptStore(
    useShallow((s) => s.receipts.find((r) => r.id === s.activeReceiptId)?.receiptFile ?? null),
  );
  const activeReceiptId = useReceiptStore((s) => s.activeReceiptId);
  const scan = useScanStore(
    useShallow((s) => {
      const ss = getScanState(s.scanStateByReceipt, activeReceiptId);
      return {
        isScanning: ss.isScanning,
        scanStatus: ss.scanStatus,
        scanError: ss.scanError,
        loadingMessage: ss.loadingMessage,
      };
    }),
  );
  const setShowApiKeyModal = useGeminiStore((s) => s.setShowApiKeyModal);

  const previewUrl = useMemo(
    () => (receiptFile?.type.startsWith('image/') ? URL.createObjectURL(receiptFile) : null),
    [receiptFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsFullscreen(false);
    onReceiptFileSelected(e.target.files?.[0] ?? null);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  return (
    <div
      className={cn(
        'space-y-4 rounded-[20px] bg-cream p-5',
        receiptFile && !hasApiKey && 'ring-2 ring-error',
      )}
    >
      <h4 className="text-[10px] font-semibold tracking-widest text-ink2 uppercase">
        Scan Receipt
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] bg-ink p-4 text-white transition-opacity hover:opacity-90">
          <span className="material-symbols-outlined">upload_file</span>
          <span className="text-xs font-semibold">Upload</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            data-testid="receipt-file-input"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] bg-cream-dim p-4 text-ink transition-colors hover:bg-cream-dim/80">
          <span className="material-symbols-outlined">photo_camera</span>
          <span className="text-xs font-semibold">Capture</span>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {receiptFile && (
        <div className="space-y-3 border-t border-cream-dim pt-3">
          <div className="flex items-center gap-2 text-xs text-ink2">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-cream-dim transition-all hover:ring-2 hover:ring-ink"
              >
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <span className="material-symbols-outlined text-sm text-secondary">description</span>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label={`Open fullscreen preview of ${receiptFile.name}`}
              className="flex-1 cursor-pointer truncate text-left transition-colors hover:text-ink"
            >
              {receiptFile.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFullscreen(false);
                onReceiptFileSelected(null);
              }}
              aria-label="Remove upload"
              className="flex-shrink-0 cursor-pointer text-on-surface-variant transition-colors hover:text-error"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'material-symbols-outlined text-sm',
                hasApiKey ? 'text-accent-green' : 'text-error',
              )}
            >
              {hasApiKey ? 'key' : 'key_off'}
            </span>
            <p className={cn('text-xs font-medium', hasApiKey ? 'text-ink2' : 'text-error')}>
              {hasApiKey ? 'Gemini API key set' : 'Gemini API key required.'}
            </p>
            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className={cn(
                'cursor-pointer text-xs font-semibold underline',
                hasApiKey ? 'text-ink2 hover:text-ink' : 'text-error',
              )}
            >
              {hasApiKey ? 'Edit' : 'Add Key'}
            </button>
          </div>
          <button
            type="button"
            data-testid="scan-receipt-btn"
            onClick={onScanReceipt}
            disabled={scan.isScanning || !hasApiKey}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all active:scale-95',
              scan.isScanning || !hasApiKey
                ? 'cursor-not-allowed bg-cream-dim text-ink2 opacity-50'
                : 'bg-ink text-white shadow-sm',
            )}
          >
            <span className="material-symbols-outlined text-sm">
              {scan.isScanning ? 'sync' : 'document_scanner'}
            </span>
            {scan.isScanning ? scan.loadingMessage || 'Scanning…' : 'Scan Receipt'}
          </button>
          {scan.scanStatus && !scan.isScanning && (
            <p className="text-xs font-medium text-accent-green">{scan.scanStatus}</p>
          )}
          {scan.scanError && <p className="text-xs font-medium text-error">{scan.scanError}</p>}
        </div>
      )}

      {mockReceipts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-cream-dim pt-3">
          {mockReceipts.map(({ onLoad }, i) => (
            <button
              key={i}
              type="button"
              data-testid={`load-mock-receipt-btn-${i}`}
              onClick={onLoad}
              className="rounded-full bg-cream-dim px-3 py-1 text-[10px] font-semibold tracking-wide text-ink2 uppercase transition-colors hover:bg-ink hover:text-white"
            >
              Load Mock Receipt {i + 1}
            </button>
          ))}
        </div>
      )}

      {isFullscreen && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Receipt image preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            type="button"
            autoFocus
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
            aria-label="Close preview"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={previewUrl}
            alt="Receipt fullscreen"
            className="max-h-screen max-w-screen object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
