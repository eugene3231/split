import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScanStore } from '@features/receipt-scanner/stores/scanStore';
import { scanReceipt } from './scanReceipt';

const { analyzeReceiptWithGemini: analyzeReceiptWithGeminiMock } = vi.hoisted(() => ({
  analyzeReceiptWithGemini: vi.fn(),
}));

vi.mock('@features/receipt-scanner/api/geminiApi', async (importActual) => {
  const actual = await importActual<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: analyzeReceiptWithGeminiMock };
});

beforeEach(() => {
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

  it('forwards status updates from Gemini analysis into scanStore', async () => {
    let statusDuringCall: string | undefined;
    analyzeReceiptWithGeminiMock.mockImplementationOnce(
      async (
        _file: unknown,
        _key: unknown,
        _model: unknown,
        setStatus: (status: string) => void,
      ) => {
        setStatus('Calling Gemini...');
        statusDuringCall = useScanStore.getState().scanStateByReceipt.r1?.scanStatus;
        return {
          items: [],
          subtotal: null,
          total: null,
          detected: {
            gst: { enabled: false, amount: null, percent: null, confidence: null, source: '' },
            serviceCharge: {
              enabled: false,
              amount: null,
              percent: null,
              confidence: null,
              source: '',
            },
          },
          warnings: [],
        };
      },
    );

    await scanReceipt({
      receiptId: 'r1',
      receiptFile: new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
      apiKeyInput: 'test-key',
      model: 'gemini-2.5-flash',
    });

    expect(statusDuringCall).toBe('Calling Gemini...');
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
});
