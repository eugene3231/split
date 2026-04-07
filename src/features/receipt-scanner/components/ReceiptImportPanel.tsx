import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@shared/stores/receiptStore';

const EMPTY_WARNINGS: string[] = [];
import { ReceiptScanSection } from '@features/receipt-scanner/components/ReceiptScanSection';

type ReceiptImportPanelProps = {
  onReceiptFileSelected: (file: File | null) => void;
  onScanReceipt: () => void;
  onLoadMockReceipt: () => void;
  hideModelInAdvancedSettings?: boolean;
  enableCameraCapture?: boolean;
  showLoadMockButton?: boolean;
};

export function ReceiptImportPanel({
  onReceiptFileSelected,
  onScanReceipt,
  onLoadMockReceipt,
  hideModelInAdvancedSettings = false,
  enableCameraCapture = false,
  showLoadMockButton = true,
}: ReceiptImportPanelProps) {
  const geminiApiKeyInput = useReceiptStore((state) => state.geminiApiKeyInput);
  const geminiModel = useReceiptStore((state) => state.geminiModel);
  const { receiptFile, isScanning, scanStatus, scanError, scanWarnings, loadingMessage } =
    useReceiptStore(
      useShallow((state) => {
        const active = state.receipts.find((r) => r.id === state.activeReceiptId);
        const scanState = state.scanStateByReceipt[state.activeReceiptId];
        return {
          receiptFile: active?.receiptFile ?? null,
          isScanning: scanState?.isScanning ?? false,
          scanStatus: scanState?.scanStatus ?? '',
          scanError: scanState?.scanError ?? null,
          scanWarnings: scanState?.scanWarnings ?? EMPTY_WARNINGS,
          loadingMessage: scanState?.loadingMessage ?? '',
        };
      }),
    );
  const setGeminiModel = useReceiptStore((state) => state.setGeminiModel);
  const setShowApiKeyModal = useReceiptStore((state) => state.setShowApiKeyModal);

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
  );
}
