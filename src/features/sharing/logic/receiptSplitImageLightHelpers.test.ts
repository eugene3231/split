import { describe, expect, it } from 'vitest';
import { personColor } from '@shared/utils/personColors';
import {
  drawPersonAvatar,
  formatConversionLines,
} from '@features/sharing/logic/receiptSplitImageLightHelpers';

interface FillCall {
  kind: 'fill' | 'text';
  style: string;
  text?: string;
}

function makeRecordingContext() {
  const calls: FillCall[] = [];
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    beginPath: () => {},
    arc: () => {},
    fill() {
      calls.push({ kind: 'fill', style: ctx.fillStyle });
    },
    fillText(text: string) {
      calls.push({ kind: 'text', style: ctx.fillStyle, text });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('drawPersonAvatar', () => {
  it('fills the avatar with the same person colour the React avatar uses', () => {
    for (const colorIndex of [0, 3, 9, 12]) {
      const { ctx, calls } = makeRecordingContext();
      drawPersonAvatar(ctx, { cx: 0, cy: 0, radius: 22, name: 'Mei', colorIndex });
      expect(calls[0]).toEqual({ kind: 'fill', style: personColor(colorIndex) });
    }
  });

  it('draws the trimmed, upper-cased initial in white', () => {
    const { ctx, calls } = makeRecordingContext();
    drawPersonAvatar(ctx, { cx: 0, cy: 0, radius: 22, name: '  arjun', colorIndex: 2 });
    expect(calls[1]).toEqual({ kind: 'text', style: '#ffffff', text: 'A' });
  });

  it('falls back to a question mark for a blank name', () => {
    const { ctx, calls } = makeRecordingContext();
    drawPersonAvatar(ctx, { cx: 0, cy: 0, radius: 22, name: '   ', colorIndex: 0 });
    expect(calls[1].text).toBe('?');
  });
});

describe('currency conversion copy', () => {
  const conversion = {
    amountCents: 1352,
    rate: 1.35,
    fromCurrency: 'USD',
    toCurrency: 'SGD',
    showRate: true,
  };

  it('renders the allocated SGD cents supplied by the shared breakdown, then the rate', () => {
    expect(formatConversionLines(conversion)).toEqual(['≈ $13.52', '1 SGD = 0.74074 USD']);
  });

  it('leaves the rate out when the breakdown already shows it above', () => {
    expect(formatConversionLines({ ...conversion, showRate: false })).toEqual(['≈ $13.52']);
  });
});
