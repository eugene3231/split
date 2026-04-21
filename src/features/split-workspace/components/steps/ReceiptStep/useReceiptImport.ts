import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { scanReceipt, useScanStore } from '@features/receipt-scanner';
import { MOCK_RECEIPT_FIXTURES } from '@features/receipt-scanner/logic/ocrFixtures';
import { buildReceiptOcrPatch } from '@features/split-workspace/logic/applyOcrResultToReceipt';
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
    const receipt = useReceiptStore
      .getState()
      .receipts.find((candidate) => candidate.id === activeReceiptId);

    const payload = await scanReceipt({
      receiptId: activeReceiptId,
      receiptFile: receipt?.receiptFile ?? null,
      apiKeyInput: geminiApiKeyInput,
      model: geminiModel,
    });

    if (!payload) {
      return;
    }

    const {
      people: currentPeople,
      receipts: currentReceipts,
      patchReceipt,
    } = useReceiptStore.getState();
    const currentReceipt = currentReceipts.find((candidate) => candidate.id === activeReceiptId);
    if (!currentReceipt) {
      return;
    }

    patchReceipt(activeReceiptId, buildReceiptOcrPatch(currentReceipt, payload, currentPeople));
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
            patchReceipt,
          } = useReceiptStore.getState();
          const receipt = currentReceipts.find((candidate) => candidate.id === targetReceiptId);
          if (!receipt) {
            return;
          }

          const payload = fixture.buildResponse();
          useScanStore.getState().clearScanFeedback(targetReceiptId);
          useScanStore.getState().setScanWarnings(targetReceiptId, payload.warnings);
          patchReceipt(targetReceiptId, buildReceiptOcrPatch(receipt, payload, currentPeople));
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
