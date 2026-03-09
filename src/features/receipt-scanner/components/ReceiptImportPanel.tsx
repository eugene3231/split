import { useReceiptUiStore } from '../../../shared/stores/receiptUiStore'
import { ReceiptScanSection } from './ReceiptScanSection'

type ReceiptImportPanelProps = {
  onReceiptFileSelected: (file: File | null) => void
  onScanReceipt: () => void
  onLoadMockReceipt: () => void
  hideModelInAdvancedSettings?: boolean
  enableCameraCapture?: boolean
  showLoadMockButton?: boolean
}

export function ReceiptImportPanel({
  onReceiptFileSelected,
  onScanReceipt,
  onLoadMockReceipt,
  hideModelInAdvancedSettings = false,
  enableCameraCapture = false,
  showLoadMockButton = true,
}: ReceiptImportPanelProps) {
  const geminiApiKeyInput = useReceiptUiStore((state) => state.geminiApiKeyInput)
  const geminiModel = useReceiptUiStore((state) => state.geminiModel)
  const receiptFile = useReceiptUiStore((state) => state.receiptFile)
  const isScanning = useReceiptUiStore((state) => state.isScanning)
  const scanStatus = useReceiptUiStore((state) => state.scanStatus)
  const scanError = useReceiptUiStore((state) => state.scanError)
  const scanWarnings = useReceiptUiStore((state) => state.scanWarnings)
  const loadingMessage = useReceiptUiStore((state) => state.loadingMessage)
  const setGeminiModel = useReceiptUiStore((state) => state.setGeminiModel)
  const setShowApiKeyModal = useReceiptUiStore((state) => state.setShowApiKeyModal)

  return (
    <ReceiptScanSection
      hasApiKey={geminiApiKeyInput.trim().length > 0}
      onEditApiKey={() => setShowApiKeyModal(true)}
      geminiModel={geminiModel}
      onGeminiModelChange={setGeminiModel}
      receiptFile={receiptFile}
      onReceiptFileSelected={onReceiptFileSelected}
      isScanning={isScanning}
      loadingMessage={loadingMessage}
      scanStatus={scanStatus}
      scanError={scanError}
      scanWarnings={scanWarnings}
      onScanReceipt={onScanReceipt}
      onLoadMockReceipt={onLoadMockReceipt}
      hideModelInAdvancedSettings={hideModelInAdvancedSettings}
      enableCameraCapture={enableCameraCapture}
      showLoadMockButton={showLoadMockButton}
    />
  )
}
