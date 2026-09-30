import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { scanReceipt, useScanStore } from '@features/receipt-scanner';
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

type UseReceiptImportArgs = {
  activeReceiptId: string;
};

export function useReceiptImport({ activeReceiptId }: UseReceiptImportArgs) {
  const handleReceiptFileSelected = useReceiptStore((state) => state.handleReceiptFileSelected);
  const { geminiApiKeyInput, geminiModel } = useGeminiStore(
    useShallow((state) => ({
      geminiApiKeyInput: state.geminiApiKeyInput,
      geminiModel: state.geminiModel,
    })),
  );

  const handleReceiptFileChange = (file: File | null) => {
    handleReceiptFileSelected(file);
    useScanStore.getState().clearScanFeedback(activeReceiptId);
  };

  const handleScanReceipt = async () => {
    const { receipts, people } = useReceiptStore.getState();
    const receipt = receipts.find((candidate) => candidate.id === activeReceiptId);
    if (!receipt) return;

    const payload = await scanReceipt({
      receiptId: activeReceiptId,
      receiptFile: receipt.receiptFile ?? null,
      apiKeyInput: geminiApiKeyInput,
      model: geminiModel,
    });

    if (!payload) {
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

  const mockReceipts = useMemo(
    () =>
      MOCK_RECEIPT_FIXTURES.map((fixture) => ({
        label: fixture.label,
        onLoad: () => {
          const {
            activeReceiptId: targetReceiptId,
            people: currentPeople,
            receipts: currentReceipts,
            applyReceiptScan,
          } = useReceiptStore.getState();
          const receipt = currentReceipts.find((candidate) => candidate.id === targetReceiptId);
          if (!receipt) {
            return;
          }

          const payload = fixture.buildResponse();
          useScanStore.getState().clearScanFeedback(targetReceiptId);
          useScanStore.getState().setScanWarnings(targetReceiptId, payload.warnings);
          applyReceiptScan({ receipt, people: currentPeople, payload });
        },
      })),
    [],
  );

  return {
    handleReceiptFileChange,
    handleScanReceipt,
    mockReceipts,
  };
}
