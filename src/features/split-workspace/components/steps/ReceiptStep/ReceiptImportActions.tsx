import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useScanStore, getScanState } from '@features/receipt-scanner/stores/scanStore';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { Dialog } from 'radix-ui';
import { cn } from '@shared/utils/cn';

interface Props {
  onReceiptFileSelected: (file: File | null) => void;
  onScanReceipt: () => void;
}

export function ReceiptImportActions({ onReceiptFileSelected, onScanReceipt }: Props) {
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
    const input = e.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = '';
    setIsFullscreen(false);
    onReceiptFileSelected(file);
  };

  return (
    <div
      className={cn(
        'space-y-4 surface-card p-4 md:p-5',
        receiptFile && !hasApiKey && 'ring-2 ring-error',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 className="font-headline text-lg leading-tight font-bold text-on-surface">
            Scan a receipt
          </h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Gemini reads the items and charges for you.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 hover:bg-primary-container">
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              upload_file
            </span>
            Upload
            <input
              type="file"
              accept="image/*,application/pdf"
              data-testid="receipt-file-input"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface transition-colors focus-within:ring-2 focus-within:ring-primary/30 hover:bg-surface-container-low">
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              photo_camera
            </span>
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>

      {receiptFile && (
        <div className="space-y-3 border-t border-surface-container-high pt-3">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="h-8 w-8 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-outline-variant/30 transition-all hover:ring-2 hover:ring-primary"
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
              className="flex-1 cursor-pointer truncate text-left transition-colors hover:text-primary"
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
                'cursor-pointer text-xs font-semibold underline underline-offset-2',
                hasApiKey ? 'text-on-surface-variant hover:text-primary' : 'text-error',
              )}
            >
              {hasApiKey ? 'Edit' : 'Add key'}
            </button>
          </div>
          <button
            type="button"
            data-testid="scan-receipt-btn"
            onClick={onScanReceipt}
            disabled={scan.isScanning || !hasApiKey}
            className={cn(
              'relative flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]',
              scan.isScanning ? 'flex-col gap-2 px-4 py-4' : 'gap-2',
              scan.isScanning || !hasApiKey
                ? 'cursor-not-allowed bg-surface-container-high text-on-surface-variant opacity-50'
                : 'bg-primary text-on-primary hover:bg-primary-container',
            )}
          >
            {scan.isScanning && (
              <span
                aria-hidden
                data-testid="scan-shimmer"
                className="absolute inset-0 hidden bg-linear-to-r from-transparent via-white/60 to-transparent motion-safe:block motion-safe:animate-scan-sweep"
              />
            )}
            <span
              className={cn('material-symbols-outlined text-sm', scan.isScanning && 'animate-spin')}
            >
              {scan.isScanning ? 'progress_activity' : 'document_scanner'}
            </span>
            <span className={cn(scan.isScanning && 'text-center text-xs')}>
              {scan.isScanning ? scan.loadingMessage || 'Scanning…' : 'Scan receipt'}
            </span>
          </button>
          <p className="text-xs text-on-surface-variant">
            Existing items and charges are replaced only after a successful scan.
          </p>
          {scan.scanError && <p className="text-xs font-medium text-error">{scan.scanError}</p>}
        </div>
      )}

      {previewUrl && (
        <Dialog.Root open={isFullscreen} onOpenChange={setIsFullscreen}>
          <Dialog.Portal>
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
              onClick={() => setIsFullscreen(false)}
            >
              <Dialog.Title className="sr-only">Receipt image preview</Dialog.Title>
              <Dialog.Close
                onClick={(e) => e.stopPropagation()}
                className="absolute top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                aria-label="Close preview"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  close
                </span>
              </Dialog.Close>
              <img
                src={previewUrl}
                alt="Receipt fullscreen"
                className="max-h-screen max-w-screen object-contain p-4"
                onClick={(e) => e.stopPropagation()}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
