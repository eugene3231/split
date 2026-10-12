import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSplits } from '@features/split-workspace/hooks/useSplits';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { buildSplitShareText, shareText, copyShareText } from '@features/sharing/logic/shareSplit';
import {
  percentCharge,
  resetAllStores,
  seedStore,
  makePerson,
  makeItem,
  makeReceipt,
  sumValues,
} from './testHelpers';
import { equalShares } from '@features/split-workspace/logic/assignment';
import { centsByPerson } from '@features/split-workspace/logic/split/amounts';

beforeEach(resetAllStores);

describe('Export and sharing integration', () => {
  it('consolidated view — buildSplitShareText includes all person names and total matches split', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const receipt = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
        makeItem({
          amountInput: '20.00',
          assignment: equalShares([bob.id]),
        }),
      ],
      serviceCharge: percentCharge('10'),
    });

    seedStore([alice, bob], [receipt]);
    const { result } = renderHook(() => useSplits());
    const { consolidated } = result.current;

    const text = buildSplitShareText({
      people: useReceiptStore.getState().people,
      receiptName: 'Receipt 1',
      split: consolidated,
      currency: 'SGD',
    });

    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
    expect(text).toContain('Receipt 1');

    const sumFromSplit = sumValues(centsByPerson(consolidated, 'total'));
    expect(sumFromSplit).toBe(consolidated.totals.totalCents);
  });

  it('single receipt view — buildSplitShareText shows per-receipt total', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const receipt = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
        makeItem({
          amountInput: '20.00',
          assignment: equalShares([bob.id]),
        }),
      ],
    });

    seedStore([alice, bob], [receipt]);
    const { result } = renderHook(() => useSplits());
    const [active] = result.current.receiptSplits;

    const text = buildSplitShareText({
      people: useReceiptStore.getState().people,
      receiptName: 'Dinner',
      split: active.split,
      currency: 'SGD',
    });

    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
    expect(text).toContain('Dinner');

    const sumFromSplit = sumValues(centsByPerson(active.split, 'total'));
    expect(sumFromSplit).toBe(active.split.totals.totalCents);
  });

  it('multi-currency — consolidated text uses base currency with converted totals', () => {
    const alice = makePerson('Alice');
    const bob = makePerson('Bob');
    const rSgd = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([alice.id]),
        }),
      ],
      currency: 'SGD',
    });
    const rUsd = makeReceipt({
      items: [
        makeItem({
          amountInput: '10.00',
          assignment: equalShares([bob.id]),
        }),
      ],
      currency: 'USD',
    });

    seedStore([alice, bob], [rSgd, rUsd], { exchangeRates: { SGD: 1, USD: 1.35 } });
    const { result } = renderHook(() => useSplits());

    const { consolidated } = result.current;
    const text = buildSplitShareText({
      people: useReceiptStore.getState().people,
      receiptName: 'Split',
      split: consolidated,
      currency: 'SGD',
    });

    expect(text).toContain('Alice');
    expect(text).toContain('Bob');

    expect(sumValues(centsByPerson(consolidated, 'total'))).toBe(consolidated.totals.totalCents);

    expect(consolidated.byPerson[bob.id].totalCents).toBeGreaterThan(1000);
  });

  it('native share — shareText returns native when navigator.share available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    const mode = await shareText('summary text', {
      share,
      canShare: vi.fn(),
      clipboard: {} as Navigator['clipboard'],
    });

    expect(mode).toBe('native');
    expect(share).toHaveBeenCalledWith({ text: 'summary text' });
  });

  it('fallback share — shareText falls back to clipboard when navigator.share unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    const mode = await shareText('summary text', {
      share: undefined as unknown as Navigator['share'],
      canShare: vi.fn(),
      clipboard: { writeText } as unknown as Navigator['clipboard'],
    });

    expect(mode).toBe('fallback');
    expect(writeText).toHaveBeenCalledWith('summary text');
  });

  it('copyShareText — works with clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyShareText('test summary', {
      share: vi.fn(),
      canShare: vi.fn(),
      clipboard: { writeText } as unknown as Navigator['clipboard'],
    });

    expect(writeText).toHaveBeenCalledWith('test summary');
  });

  it('copyShareText — throws when clipboard unavailable', async () => {
    await expect(
      copyShareText('test', {
        share: vi.fn(),
        canShare: vi.fn(),
        clipboard: undefined as unknown as Navigator['clipboard'],
      }),
    ).rejects.toThrow('Copy is not available');
  });
});
