import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeSplit } from '@features/split-workspace/logic/split/split';
import { resolveSummaryView } from '@features/split-workspace/logic/summaryView';
import { resolveSummaryBreakdown } from '@features/split-workspace/logic/summaryBreakdown';
import { makeItem, makeReceipt } from '../../../../../tests/integration/testHelpers';
import { useSummaryExport } from './useSummaryExport';

const people = [{ id: 'p1', name: 'Alice' }];
const receipt = makeReceipt({
  id: 'r1',
  name: 'Lunch',
  items: [
    makeItem({
      id: 'i1',
      amountInput: '10.00',
      assignment: { mode: 'equal', personId: '', personIds: ['p1'] },
    }),
  ],
});
const split = computeSplit({ people, ...receipt });
const view = resolveSummaryView({
  receipts: [receipt],
  splitByReceipt: [split],
  consolidatedSplit: split,
  fallbackSplit: split,
  discount: receipt.discount,
  serviceCharge: receipt.serviceCharge,
  gst: receipt.gst,
  exchangeRates: { SGD: 1 },
  activeTab: 'r1',
  showBaseCurrency: false,
});
const model = {
  people,
  view,
  reconciliation: { cents: null, applyCorrectiveDiscount: () => {} },
  summaryBreakdown: resolveSummaryBreakdown({ people, view }),
};
const writeText = vi.fn<(text: string) => Promise<void>>();

function renderExport() {
  return renderHook(() => useSummaryExport({ model, includeItemDetails: false }));
}

describe('useSummaryExport sharing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reports an actionable error when clipboard permission is denied', async () => {
    writeText.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const { result } = renderExport();

    await act(async () => result.current.share());

    expect(result.current.exportError).toEqual(expect.stringMatching(/try again/i));
    expect(result.current.copied).toBe(false);
    expect(result.current.busy).toBeNull();
  });

  it('reports an error when neither sharing nor clipboard is available', async () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderExport();

    await act(async () => result.current.share());

    expect(result.current.exportError).toEqual(expect.stringMatching(/share or copy/i));
    expect(result.current.copied).toBe(false);
    expect(result.current.busy).toBeNull();
  });

  it('clears the previous error when retrying a failed copy', async () => {
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    const { result } = renderExport();
    await act(async () => result.current.share());
    expect(result.current.exportError).toEqual(expect.stringMatching(/try again/i));

    let resolveCopy!: () => void;
    writeText.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveCopy = resolve)));
    let sharePromise: Promise<void> = Promise.resolve();
    act(() => {
      sharePromise = result.current.share();
    });

    expect(result.current.exportError).toBeNull();
    expect(result.current.busy).toBe('copying');

    await act(async () => {
      resolveCopy();
      await sharePromise;
    });

    expect(writeText).toHaveBeenLastCalledWith('Lunch total: $10.00\n\nAlice: $10.00');
    expect(result.current.copied).toBe(true);
    expect(result.current.busy).toBeNull();
  });

  it('keeps native share cancellation silent without copying', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const { result } = renderExport();

    await act(async () => result.current.share());

    expect(result.current.exportError).toBeNull();
    expect(result.current.copied).toBe(false);
    expect(result.current.busy).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the summary when native sharing fails', async () => {
    const share = vi.fn().mockRejectedValue(new TypeError('Sharing unsupported'));
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    const { result } = renderExport();

    await act(async () => result.current.share());

    expect(writeText).toHaveBeenCalledWith('Lunch total: $10.00\n\nAlice: $10.00');
    expect(result.current.exportError).toBeNull();
    expect(result.current.copied).toBe(true);
  });
});
