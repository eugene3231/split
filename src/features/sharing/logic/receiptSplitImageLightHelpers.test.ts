import { describe, expect, it, vi } from 'vitest';
import { drawCurrencyConversionLines } from './receiptSplitImageLightHelpers';

describe('currency conversion copy', () => {
  it('renders the allocated SGD cents supplied by the shared breakdown', () => {
    const fillText = vi.fn();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText,
    } as unknown as CanvasRenderingContext2D;

    drawCurrencyConversionLines(ctx, 200, 100, 24, {
      amountCents: 1352,
      rate: 1.35,
      fromCurrency: 'USD',
      toCurrency: 'SGD',
    });

    expect(fillText.mock.calls).toEqual([
      ['≈ $13.52', 200, 100],
      ['1 SGD = 0.74074 USD', 200, 124],
    ]);
  });
});
