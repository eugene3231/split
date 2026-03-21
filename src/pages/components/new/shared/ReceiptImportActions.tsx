import { useRef, type ChangeEvent } from 'react'
import { useShallow } from 'zustand/shallow'
import { useReceiptStore } from '@shared/stores/receiptStore'
import { cn } from '@shared/utils/cn'

interface Props {
  onReceiptFileSelected: (file: File | null) => void
  onScanReceipt: () => void
  mockReceipts: Array<{ label: string; onLoad: () => void }>
}

export function ReceiptImportActions({ onReceiptFileSelected, onScanReceipt, mockReceipts }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const { hasApiKey, receiptFile, isScanning, scanStatus, scanError, loadingMessage } = useReceiptStore(
    useShallow((state) => {
      const active = state.receipts.find((r) => r.id === state.activeReceiptId)
      const scanState = state.scanStateByReceipt[state.activeReceiptId]
      return {
        hasApiKey: state.geminiApiKeyInput.trim().length > 0,
        receiptFile: active?.receiptFile ?? null,
        isScanning: scanState?.isScanning ?? false,
        scanStatus: scanState?.scanStatus ?? '',
        scanError: scanState?.scanError ?? null,
        loadingMessage: scanState?.loadingMessage ?? '',
      }
    }),
  )
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onReceiptFileSelected(e.target.files?.[0] ?? null)
  }

  return (
    <div className="p-6 bg-surface-container-lowest rounded-2xl shadow-sm space-y-4 border border-outline-variant/20">
      <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
        Scan Receipt
      </h4>

      {/* Upload + Capture tiles */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-primary mb-2">upload_file</span>
          <span className="text-[10px] font-bold text-primary">UPLOAD</span>
          <input ref={fileInputRef} type="file" accept="image/*" data-testid="receipt-file-input" className="sr-only" onChange={handleFileChange} />
        </label>
        <label className="flex flex-col items-center justify-center p-4 bg-surface-container-low rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
          <span className="material-symbols-outlined text-primary mb-2">photo_camera</span>
          <span className="text-[10px] font-bold text-primary">CAPTURE</span>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />
        </label>
      </div>

      {/* Ready to scan row — shown once a file is selected */}
      {receiptFile && (
        <div className="pt-3 border-t border-surface-container-high space-y-3">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm text-secondary">description</span>
            <span className="truncate flex-1">{receiptFile.name}</span>
            <button
              type="button"
              onClick={() => onReceiptFileSelected(null)}
              aria-label="Remove upload"
              className="flex-shrink-0 text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('material-symbols-outlined text-sm', hasApiKey ? 'text-secondary' : 'text-error')}>
              {hasApiKey ? 'key' : 'key_off'}
            </span>
            <p className={cn('text-xs font-medium', hasApiKey ? 'text-on-surface-variant' : 'text-error')}>
              {hasApiKey ? 'Gemini API key set' : 'Gemini API key required.'}
            </p>
            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className={cn('text-xs font-bold underline', hasApiKey ? 'text-on-surface-variant hover:text-primary' : 'text-error')}
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
            <span className="material-symbols-outlined text-sm">{isScanning ? 'sync' : 'document_scanner'}</span>
            {isScanning ? (loadingMessage || 'Scanning…') : 'Scan Receipt'}
          </button>
          {scanStatus && !isScanning && (
            <p className="text-xs text-secondary font-medium">{scanStatus}</p>
          )}
          {scanError && (
            <p className="text-xs text-error font-medium">{scanError}</p>
          )}
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
    </div>
  )
}
