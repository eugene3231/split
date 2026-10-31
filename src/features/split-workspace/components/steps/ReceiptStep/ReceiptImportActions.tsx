import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useScanStore, getScanState } from '@features/receipt-scanner/stores/scanStore';
import { resolveScanTransport } from '@features/receipt-scanner/logic/scanTransport';
import { TurnstileCheck } from '@features/receipt-scanner/components/TurnstileCheck';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { Dialog } from 'radix-ui';
import { ScanKeyRow } from './ScanKeyRow';
import { cn } from '@shared/utils/cn';

interface Props {
  onReceiptFileSelected: (file: File | null) => void;
  onScanReceipt: () => void;
}

export function ReceiptImportActions({ onReceiptFileSelected, onScanReceipt }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const transport = useGeminiStore((s) => resolveScanTransport(s.geminiApiKeyInput).kind);
  const canScan = transport !== 'none';
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
        'space-y-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm',
        receiptFile && !canScan && 'ring-2 ring-error',
      )}
    >
      <h4 className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
        Scan Receipt
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined mb-2 text-primary">upload_file</span>
          <span className="text-xs font-bold text-primary">UPLOAD</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            data-testid="receipt-file-input"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined mb-2 text-primary">photo_camera</span>
          <span className="text-xs font-bold text-primary">CAPTURE</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
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
          <ScanKeyRow transport={transport} onEditKey={() => setShowApiKeyModal(true)} />
          <button
            type="button"
            data-testid="scan-receipt-btn"
            onClick={onScanReceipt}
            disabled={scan.isScanning || !canScan}
            className={cn(
              'relative flex w-full items-center justify-center overflow-hidden rounded-xl py-3 text-sm font-bold transition-all active:scale-95',
              scan.isScanning ? 'flex-col gap-2 px-4 py-4' : 'gap-2',
              scan.isScanning || !canScan
                ? 'cursor-not-allowed bg-surface-container-high text-on-surface-variant opacity-50'
                : 'bg-primary text-on-primary shadow-lg shadow-primary/20',
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
              {scan.isScanning ? scan.loadingMessage || 'Scanning…' : 'Scan Receipt'}
            </span>
          </button>
          <TurnstileCheck />
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
