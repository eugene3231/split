import { useShallow } from 'zustand/shallow';
import { scanReceipt, useScanStore } from '@features/receipt-scanner';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

interface UseReceiptImportArgs {
  activeReceiptId: string;
}

export function useReceiptImport({ activeReceiptId }: UseReceiptImportArgs) {
  const patchReceipt = useReceiptStore((state) => state.patchReceipt);
  const openApiKeyModalFor = useGeminiStore((state) => state.openApiKeyModalFor);
  const { geminiApiKeyInput, geminiModel } = useGeminiStore(
    useShallow((state) => ({
      geminiApiKeyInput: state.geminiApiKeyInput,
      geminiModel: state.geminiModel,
    })),
  );

  const handleReceiptFileChange = (file: File | null) => {
    patchReceipt(activeReceiptId, { receiptFile: file });
    useScanStore.getState().clearScanFeedback(activeReceiptId);
  };

  const handleScanReceipt = async () => {
    const { receipts, people } = useReceiptStore.getState();
    const receipt = receipts.find((candidate) => candidate.id === activeReceiptId);
    if (!receipt) return;
    const scannedFile = receipt.receiptFile ?? null;

    const payload = await scanReceipt({
      receiptId: activeReceiptId,
      receiptFile: scannedFile,
      apiKeyInput: geminiApiKeyInput,
      model: geminiModel,
      onNeedsKey: openApiKeyModalFor,
      isCurrent: () =>
        useReceiptStore.getState().receipts.find((candidate) => candidate.id === activeReceiptId)
          ?.receiptFile === scannedFile,
    });

    if (!payload) {
      return;
    }

    const currentReceipt = useReceiptStore
      .getState()
      .receipts.find((candidate) => candidate.id === activeReceiptId);
    if (currentReceipt && (currentReceipt.receiptFile ?? null) !== scannedFile) {
      return;
    }

    const result = useReceiptStore.getState().applyReceiptScan({ receipt, people, payload });
    if (result.kind === 'removed') {
      useScanStore.getState().clearScanFeedback(receipt.id);
      return;
    }
    if (result.kind === 'changed') {
      useScanStore.getState().clearScanFeedback(receipt.id);
      useScanStore
        .getState()
        .setScanError(
          receipt.id,
          'The receipt changed during scanning. Your edits were kept. Scan again to replace items and charges.',
        );
      return;
    }
    if (result.kind === 'empty') {
      useScanStore
        .getState()
        .setScanError(
          receipt.id,
          'No items were found. Your receipt was kept. Try a clearer photo or enter items manually.',
        );
    }
  };

  return {
    handleReceiptFileChange,
    handleScanReceipt,
  };
}
