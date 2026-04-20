import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';

type ScanReceiptArgs = {
  receiptId: string;
  receiptFile: File | null;
  apiKeyInput: string;
  model: string;
};

export async function scanReceipt({
  receiptId,
  receiptFile,
  apiKeyInput,
  model,
}: ScanReceiptArgs): Promise<OcrResponse | null> {
  if (!receiptFile) {
    return null;
  }

  if (!apiKeyInput.trim()) {
    useScanStore.getState().setScanError(receiptId, 'Missing Gemini API key. Enter it above.');
    return null;
  }

  useScanStore.getState().startScan(receiptId);

  const setScanStatusForReceipt = (status: string) =>
    useScanStore.getState().setScanStatus(receiptId, status);

  try {
    const payload = await analyzeReceiptWithGemini(
      receiptFile,
      apiKeyInput,
      model,
      setScanStatusForReceipt,
    );
    useScanStore.getState().setScanWarnings(receiptId, payload.warnings);
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to scan receipt';
    useScanStore.getState().setScanError(receiptId, message);
    return null;
  } finally {
    useScanStore.getState().finishScan(receiptId);
  }
}
