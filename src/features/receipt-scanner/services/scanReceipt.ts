import type { OcrResponse } from '@shared/types';
import { analyzeReceiptWithGemini } from '@features/receipt-scanner/api/geminiApi';
import { scanViaServer } from '@features/receipt-scanner/api/scanViaServer';
import { ScanError, describeScanError } from '@features/receipt-scanner/logic/scanError';
import { resolveScanTransport } from '@features/receipt-scanner/logic/scanTransport';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';

interface ScanReceiptArgs {
  receiptId: string;
  receiptFile: File | null;
  apiKeyInput: string;
  model: string;
  isCurrent?: () => boolean;
  onNeedsKey?: (reason: string) => void;
}

export async function scanReceipt({
  receiptId,
  receiptFile,
  apiKeyInput,
  model,
  isCurrent = () => true,
  onNeedsKey,
}: ScanReceiptArgs): Promise<OcrResponse | null> {
  if (!receiptFile) {
    return null;
  }

  const transport = resolveScanTransport(apiKeyInput);
  if (transport.kind === 'none') {
    useScanStore.getState().setScanError(receiptId, 'Missing Gemini API key. Enter it above.');
    return null;
  }

  useScanStore.getState().startScan(receiptId);

  try {
    const payload =
      transport.kind === 'server'
        ? await scanViaServer(receiptFile, transport.apiUrl)
        : await analyzeReceiptWithGemini(receiptFile, apiKeyInput, model);
    if (!isCurrent()) return null;
    useScanStore.getState().setScanWarnings(receiptId, payload.warnings);
    return payload;
  } catch (error) {
    if (!isCurrent()) return null;
    if (error instanceof ScanError) {
      const { message, asksForKey } = describeScanError(error);
      useScanStore.getState().setScanError(receiptId, message);
      if (asksForKey) onNeedsKey?.(message);
      return null;
    }
    const message = error instanceof Error ? error.message : 'Unable to scan receipt';
    useScanStore.getState().setScanError(receiptId, message);
    return null;
  } finally {
    useScanStore.getState().finishScan(receiptId);
  }
}
