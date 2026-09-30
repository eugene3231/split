import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateReceiptSplitImageLight } from '@features/sharing/logic/receiptSplitImageLight';
import {
  makeItem,
  makePerson,
  makeReceipt,
  resetAllStores,
  seedStore,
} from '../../../../../tests/integration/testHelpers';
import { useSummaryModel } from './useSummaryModel';
import { useSummaryExport } from './useSummaryExport';

vi.mock('@features/sharing/logic/receiptSplitImageLight', () => ({
  generateReceiptSplitImageLight: vi.fn(),
}));

vi.mock('@features/payments', () => ({
  generatePaynowQrDataUrls: vi.fn().mockResolvedValue({}),
}));

function seedReceipts() {
  const alice = makePerson('Alice');
  const assignment = { mode: 'equal', personId: '', personIds: [alice.id] } satisfies Parameters<
    typeof makeItem
  >[0]['assignment'];
  seedStore(
    [alice],
    [
      makeReceipt({
        id: 'r1',
        name: 'Dinner',
        items: [makeItem({ amountInput: '10.00', assignment })],
      }),
      makeReceipt({
        id: 'r2',
        name: 'Drinks',
        currency: 'USD',
        items: [makeItem({ amountInput: '20.00', assignment })],
      }),
    ],
    { exchangeRates: { SGD: 1, USD: 1.35 } },
  );
}

function renderExporter(strictMode = false) {
  return renderHook(
    ({ activeTab, showBaseCurrency }) => {
      const model = useSummaryModel({ activeTab, showBaseCurrency });
      return useSummaryExport({ model, includeItemDetails: true });
    },
    {
      initialProps: { activeTab: 'r1', showBaseCurrency: false },
      wrapper: strictMode ? StrictMode : undefined,
    },
  );
}

beforeEach(() => {
  resetAllStores();
  seedReceipts();
  vi.mocked(generateReceiptSplitImageLight).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useSummaryExport', () => {
  it('reports native sharing without claiming the text was copied', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const { result } = renderExporter();

    await act(async () => result.current.share());

    expect(result.current.exportState).toEqual({ kind: 'text-success', method: 'native' });
    expect(share).toHaveBeenCalledWith({ text: 'Dinner total: $10.00\n\nAlice: $10.00' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('reports a successful clipboard fallback as copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderExporter();

    await act(async () => result.current.share());

    expect(result.current.exportState).toEqual({ kind: 'text-success', method: 'fallback' });
    expect(writeText).toHaveBeenCalledWith('Dinner total: $10.00\n\nAlice: $10.00');
  });

  it('offers manual text when clipboard access is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderExporter();

    await act(async () => result.current.share());

    expect(result.current.exportState).toEqual({
      kind: 'manual-copy',
      message: 'Unable to share or copy automatically. Select the text below and copy it.',
    });
    expect(result.current.text).toBe('Dinner total: $10.00\n\nAlice: $10.00');
  });

  it('offers manual text when clipboard permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderExporter();

    await act(async () => result.current.share());

    expect(result.current.exportState.kind).toBe('manual-copy');
  });

  it('derives recovery text from the selected receipt and display currency', async () => {
    vi.stubGlobal('navigator', {});
    const { result, rerender } = renderExporter();
    await act(async () => result.current.share());

    rerender({ activeTab: 'r2', showBaseCurrency: false });
    expect(result.current.text).toBe('Drinks total: US$20.00\n\nAlice: US$20.00');

    rerender({ activeTab: 'r2', showBaseCurrency: true });
    expect(result.current.text).toBe('Drinks total: $27.00\n\nAlice: $27.00');
    expect(result.current.exportState.kind).toBe('manual-copy');
  });

  it('leaves cancellation silent and does not attempt clipboard fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const { result } = renderExporter();

    await act(async () => result.current.share());

    expect(result.current.exportState).toEqual({ kind: 'idle' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('replaces manual recovery with successful retry feedback', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderExporter();
    await act(async () => result.current.share());
    expect(result.current.exportState.kind).toBe('manual-copy');

    await act(async () => result.current.share());

    expect(result.current.exportState).toEqual({ kind: 'text-success', method: 'fallback' });
  });

  it('expires success feedback after two seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { result } = renderExporter();
    await act(async () => result.current.share());

    act(() => vi.advanceTimersByTime(2000));

    expect(result.current.exportState).toEqual({ kind: 'idle' });
  });

  it('keeps a newer download busy state and failure when prior success would expire', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    let rejectImage!: (error: Error) => void;
    vi.mocked(generateReceiptSplitImageLight).mockImplementation(
      () => new Promise<Blob>((_resolve, reject) => (rejectImage = reject)),
    );
    const { result } = renderExporter();
    await act(async () => result.current.share());
    act(() => vi.advanceTimersByTime(1000));

    let downloadPromise = Promise.resolve();
    act(() => {
      downloadPromise = result.current.download();
    });
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.exportState).toEqual({ kind: 'busy', action: 'download' });

    await act(async () => {
      rejectImage(new Error('Image failed'));
      await downloadPromise;
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.exportState).toEqual({
      kind: 'error',
      message: 'Failed to generate image.',
    });
  });

  it('preserves image preview error feedback', async () => {
    vi.mocked(generateReceiptSplitImageLight).mockRejectedValue(new Error('Preview failed'));
    const { result } = renderExporter();

    await act(async () => result.current.preview());

    expect(result.current.exportState).toEqual({
      kind: 'error',
      message: 'Failed to generate preview.',
    });
  });

  it.each([false, true])(
    'does not create a late preview URL after unmount with StrictMode=%s',
    async (strictMode) => {
      const createObjectURL = vi.fn().mockReturnValue('blob:late');
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
      let resolveImage!: (blob: Blob) => void;
      vi.mocked(generateReceiptSplitImageLight).mockImplementation(
        () => new Promise<Blob>((resolve) => (resolveImage = resolve)),
      );
      const { result, unmount } = renderExporter(strictMode);
      let previewPromise = Promise.resolve();
      act(() => {
        previewPromise = result.current.preview();
      });

      unmount();
      await act(async () => {
        resolveImage(new Blob(['image']));
        await previewPromise;
      });

      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );
});
