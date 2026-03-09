import { useReceiptStore } from '../../../shared/stores/receiptStore'
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
  const geminiApiKeyInput = useReceiptStore((state) => state.geminiApiKeyInput)
  const geminiModel = useReceiptStore((state) => state.geminiModel)
  const receiptFile = useReceiptStore((state) => state.receiptFile)
  const isScanning = useReceiptStore((state) => state.isScanning)
  const scanStatus = useReceiptStore((state) => state.scanStatus)
  const scanError = useReceiptStore((state) => state.scanError)
  const scanWarnings = useReceiptStore((state) => state.scanWarnings)
  const loadingMessage = useReceiptStore((state) => state.loadingMessage)
  const setGeminiModel = useReceiptStore((state) => state.setGeminiModel)
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal)

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
