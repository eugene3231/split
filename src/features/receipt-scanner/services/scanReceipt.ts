import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';

interface ScanReceiptArgs {
  receiptId: string;
  receiptFile: File | null;
  apiKeyInput: string;
  model: string;
  isCurrent?: () => boolean;
}

export async function scanReceipt({
  receiptId,
  receiptFile,
  apiKeyInput,
  model,
  isCurrent = () => true,
}: ScanReceiptArgs): Promise<OcrResponse | null> {
  if (!receiptFile) {
    return null;
  }

  if (!apiKeyInput.trim()) {
    useScanStore.getState().setScanError(receiptId, 'Missing Gemini API key. Enter it above.');
    return null;
  }

  useScanStore.getState().startScan(receiptId);

  try {
    const payload = await analyzeReceiptWithGemini(receiptFile, apiKeyInput, model);
    if (!isCurrent()) return null;
    useScanStore.getState().setScanWarnings(receiptId, payload.warnings);
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to scan receipt';
    if (isCurrent()) useScanStore.getState().setScanError(receiptId, message);
    return null;
  } finally {
    useScanStore.getState().finishScan(receiptId);
  }
}
