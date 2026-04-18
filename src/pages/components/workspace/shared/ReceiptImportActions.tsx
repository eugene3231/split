import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@shared/stores/receiptStore';
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

  const { hasApiKey, receiptFile, isScanning, scanStatus, scanError, loadingMessage } =
    useReceiptStore(
      useShallow((state) => {
        const active = state.receipts.find((r) => r.id === state.activeReceiptId);
        const scanState = state.scanStateByReceipt[state.activeReceiptId];
        return {
          hasApiKey: state.geminiApiKeyInput.trim().length > 0,
          receiptFile: active?.receiptFile ?? null,
          isScanning: scanState?.isScanning ?? false,
          scanStatus: scanState?.scanStatus ?? '',
          scanError: scanState?.scanError ?? null,
          loadingMessage: scanState?.loadingMessage ?? '',
        };
      }),
    );
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal);

  const previewUrl = useMemo(
    () => (receiptFile?.type.startsWith('image/') ? URL.createObjectURL(receiptFile) : null),
    [receiptFile],
  );

  // Revoke the object URL when it changes (file swapped) or on unmount.
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
        'p-6 bg-surface-container-lowest rounded-2xl shadow-sm space-y-4 border border-outline-variant/20',
        receiptFile && !hasApiKey && 'ring-2 ring-error',
      )}
    >
      <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
        Scan Receipt
      </h4>

      {/* Upload + Capture tiles */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-primary mb-2">upload_file</span>
          <span className="text-[10px] font-bold text-primary">UPLOAD</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            data-testid="receipt-file-input"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
        <label className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-primary mb-2">photo_camera</span>
          <span className="text-[10px] font-bold text-primary">CAPTURE</span>
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

      {/* Ready to scan row — shown once a file is selected */}
      {receiptFile && (
        <div className="pt-3 border-t border-surface-container-high space-y-3">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer ring-1 ring-outline-variant/30 hover:ring-primary hover:ring-2 transition-all"
              >
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <span className="material-symbols-outlined text-sm text-secondary">description</span>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label={`Open fullscreen preview of ${receiptFile.name}`}
              className="truncate flex-1 text-left cursor-pointer hover:text-primary transition-colors"
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
              className="flex-shrink-0 text-on-surface-variant hover:text-error transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'material-symbols-outlined text-sm',
                hasApiKey ? 'text-secondary' : 'text-error',
              )}
            >
              {hasApiKey ? 'key' : 'key_off'}
            </span>
            <p
              className={cn(
                'text-xs font-medium',
                hasApiKey ? 'text-on-surface-variant' : 'text-error',
              )}
            >
              {hasApiKey ? 'Gemini API key set' : 'Gemini API key required.'}
            </p>
            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className={cn(
                'text-xs font-bold underline cursor-pointer',
                hasApiKey ? 'text-on-surface-variant hover:text-primary' : 'text-error',
              )}
            >
              {hasApiKey ? 'Edit' : 'Add Key'}
            </button>
          </div>
          <button
            type="button"
            data-testid="scan-receipt-btn"
            onClick={onScanReceipt}
            disabled={isScanning || !hasApiKey}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95',
              isScanning || !hasApiKey
                ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-50'
                : 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/20',
            )}
          >
            <span className="material-symbols-outlined text-sm">
              {isScanning ? 'sync' : 'document_scanner'}
            </span>
            {isScanning ? loadingMessage || 'Scanning…' : 'Scan Receipt'}
          </button>
          {scanStatus && !isScanning && (
            <p className="text-xs text-secondary font-medium">{scanStatus}</p>
          )}
          {scanError && <p className="text-xs text-error font-medium">{scanError}</p>}
        </div>
      )}

      {/* Mock receipts */}
      {mockReceipts.length > 0 && (
        <div className="pt-3 border-t border-surface-container-high flex items-center gap-2 flex-wrap">
          {mockReceipts.map(({ onLoad }, i) => (
            <button
              key={i}
              type="button"
              data-testid={`load-mock-receipt-btn-${i}`}
              onClick={onLoad}
              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors uppercase tracking-wide"
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
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            type="button"
            autoFocus
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
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
