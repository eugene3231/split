import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { ScanError } from '@features/receipt-scanner/logic/scanError';
import { scanReceipt } from './scanReceipt';

const { analyzeReceiptWithGemini: analyzeReceiptWithGeminiMock } = vi.hoisted(() => ({
  analyzeReceiptWithGemini: vi.fn(),
}));

vi.mock('@features/receipt-scanner/api/geminiApi', async (importActual) => {
  const actual = await importActual<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: analyzeReceiptWithGeminiMock };
});

const { scanViaServer: scanViaServerMock } = vi.hoisted(() => ({ scanViaServer: vi.fn() }));

vi.mock('@features/receipt-scanner/api/scanViaServer', () => ({
  scanViaServer: scanViaServerMock,
}));

beforeEach(() => {
  vi.unstubAllEnvs();
  useScanStore.setState({ scanStateByReceipt: {} });
  vi.restoreAllMocks();
});

describe('scanReceipt', () => {
  it('returns null when no receipt file is provided', async () => {
    const result = await scanReceipt({
      receiptId: 'r1',
      receiptFile: null,
      apiKeyInput: 'test-key',
      model: 'gemini-2.5-flash',
    });

    expect(result).toBeNull();
    expect(useScanStore.getState().scanStateByReceipt.r1).toBeUndefined();
  });

  it('sets a scan error when API key is missing', async () => {
    const result = await scanReceipt({
      receiptId: 'r1',
      receiptFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      apiKeyInput: '',
      model: 'gemini-2.5-flash',
    });

    expect(result).toBeNull();
    expect(useScanStore.getState().scanStateByReceipt.r1?.scanError).toBe(
      'Missing Gemini API key. Enter it above.',
    );
  });

  it('returns payload, forwards warnings, and clears scanning state on success', async () => {
    analyzeReceiptWithGeminiMock.mockResolvedValue({
      items: [{ description: 'Laksa', amount: 12 }],
      subtotal: 12,
      total: 13.08,
      detected: {
        gst: { enabled: true, amount: null, percent: 9, confidence: 0.9, source: 'mock' },
        serviceCharge: {
          enabled: false,
          amount: null,
          percent: null,
          confidence: null,
          source: '',
        },
      },
      warnings: ['Check the total'],
    });

    const result = await scanReceipt({
      receiptId: 'r1',
      receiptFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      apiKeyInput: 'test-key',
      model: 'gemini-2.5-flash',
    });

    expect(result?.items).toHaveLength(1);
    const scanState = useScanStore.getState().scanStateByReceipt.r1;
    expect(scanState.isScanning).toBe(false);
    expect(scanState.scanWarnings).toEqual(['Check the total']);
    expect(scanState.scanError).toBeNull();
  });

  it('sets a fallback error message for non-Error throws and always finishes the scan', async () => {
    analyzeReceiptWithGeminiMock.mockRejectedValue('string error');

    const result = await scanReceipt({
      receiptId: 'r1',
      receiptFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      apiKeyInput: 'test-key',
      model: 'gemini-2.5-flash',
    });

    expect(result).toBeNull();
    const scanState = useScanStore.getState().scanStateByReceipt.r1;
    expect(scanState.scanError).toBe('Unable to scan receipt');
    expect(scanState.isScanning).toBe(false);
  });

  it('stores the original Error message when Gemini analysis throws an Error', async () => {
    analyzeReceiptWithGeminiMock.mockRejectedValue(new Error('rate limited'));

    const result = await scanReceipt({
      receiptId: 'r1',
      receiptFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      apiKeyInput: 'test-key',
      model: 'gemini-2.5-flash',
    });

    expect(result).toBeNull();
    const scanState = useScanStore.getState().scanStateByReceipt.r1;
    expect(scanState.scanError).toBe('rate limited');
    expect(scanState.isScanning).toBe(false);
  });

  describe('with no key and a configured server', () => {
    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
    const scan = (onNeedsKey = vi.fn()) =>
      scanReceipt({
        receiptId: 'r1',
        receiptFile: file,
        apiKeyInput: '',
        model: 'gemini-2.5-flash',
        onNeedsKey,
      });

    beforeEach(() => {
      vi.stubEnv('VITE_API_URL', 'https://api.test/');
      scanViaServerMock.mockReset();
      analyzeReceiptWithGeminiMock.mockReset();
    });

    it('scans through the server and never calls Gemini', async () => {
      scanViaServerMock.mockResolvedValue({ items: [], warnings: ['Blurry'] });

      const result = await scan();

      expect(result?.warnings).toEqual(['Blurry']);
      expect(scanViaServerMock).toHaveBeenCalledWith(file, 'https://api.test');
      expect(analyzeReceiptWithGeminiMock).not.toHaveBeenCalled();
      expect(useScanStore.getState().scanStateByReceipt.r1.scanWarnings).toEqual(['Blurry']);
    });

    it('goes direct instead when a key is typed', async () => {
      analyzeReceiptWithGeminiMock.mockResolvedValue({ items: [], warnings: [] });

      await scanReceipt({
        receiptId: 'r1',
        receiptFile: file,
        apiKeyInput: 'typed',
        model: 'gemini-2.5-flash',
      });

      expect(scanViaServerMock).not.toHaveBeenCalled();
    });

    it('asks for a key with the reason when the shared scanner is over its limit', async () => {
      scanViaServerMock.mockRejectedValue(new ScanError('over-limit', 'global'));
      const onNeedsKey = vi.fn();

      expect(await scan(onNeedsKey)).toBeNull();

      const reason =
        "Split's shared scanner has reached today's limit. Add your own Gemini key to keep scanning.";
      expect(onNeedsKey).toHaveBeenCalledWith(reason);
      expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toBe(reason);
    });

    it('asks for a key when the server cannot be reached', async () => {
      scanViaServerMock.mockRejectedValue(new ScanError('unreachable'));
      const onNeedsKey = vi.fn();

      await scan(onNeedsKey);

      expect(onNeedsKey).toHaveBeenCalledOnce();
    });

    it('shows a bad photo without asking for a key', async () => {
      scanViaServerMock.mockRejectedValue(new ScanError('bad-image'));
      const onNeedsKey = vi.fn();

      await scan(onNeedsKey);

      expect(onNeedsKey).not.toHaveBeenCalled();
      expect(useScanStore.getState().scanStateByReceipt.r1.scanError).toContain(
        "This file can't be scanned",
      );
    });

    it('stays quiet when the receipt changed during the scan', async () => {
      scanViaServerMock.mockRejectedValue(new ScanError('unreachable'));
      const onNeedsKey = vi.fn();

      await scanReceipt({
        receiptId: 'r1',
        receiptFile: file,
        apiKeyInput: '',
        model: 'gemini-2.5-flash',
        isCurrent: () => false,
        onNeedsKey,
      });

      expect(onNeedsKey).not.toHaveBeenCalled();
    });
  });
});
