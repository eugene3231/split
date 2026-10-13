import { describe, expect, it } from 'vitest';
import { personColor } from '@shared/utils/personColors';
import {
  drawPersonAvatar,
  ellipsizeText,
  formatGeneratedAt,
  wrapText,
} from '@features/sharing/logic/canvas/draw';

function makeContext(charWidth: number): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * charWidth }),
  } as unknown as CanvasRenderingContext2D;
}

describe('ellipsizeText', () => {
  it('returns text unchanged when it fits within maxWidth', () => {
    const ctx = makeContext(10);
    expect(ellipsizeText(ctx, 'Hello', 100)).toBe('Hello');
  });

  it('truncates and appends ellipsis when text exceeds maxWidth', () => {
    const ctx = makeContext(10);
    const result = ellipsizeText(ctx, 'Hello World', 60);
    expect(result).toMatch(/\.\.\.$/);
    expect(result.length).toBeLessThan('Hello World'.length + 3);
  });

  it('returns empty string with ellipsis when even one char overflows', () => {
    const ctx = makeContext(100);
    const result = ellipsizeText(ctx, 'X', 10);
    expect(result).toBe('...');
  });
});

describe('formatGeneratedAt', () => {
  it('returns a formatted timestamp string', () => {
    const result = formatGeneratedAt(new Date('2024-06-15T10:30:00Z'));
    expect(result).toMatch(/\d{4}/);
    expect(result.length).toBeGreaterThan(8);
  });
});

describe('wrapText', () => {
  const ctx = makeContext(10);

  it('keeps text that fits on one line', () => {
    expect(wrapText(ctx, 'Nasi goreng', 200, 2)).toEqual(['Nasi goreng']);
  });

  it('breaks a long name at a space onto a second line', () => {
    expect(wrapText(ctx, 'Grilled Eggplant with Garlic', 160, 2)).toEqual([
      'Grilled Eggplant',
      'with Garlic',
    ]);
  });

  it('cuts the last allowed line short with an ellipsis', () => {
    const lines = wrapText(ctx, 'Charcoal Grilled Scallops with Garlic Butter and Lime', 160, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Charcoal Grilled');
    expect(lines[1]).toMatch(/\.\.\.$/);
    expect(lines[1].length * 10).toBeLessThanOrEqual(160);
  });

  it('splits a single word wider than the line', () => {
    const lines = wrapText(ctx, 'Supercalifragilisticexpialidocious', 100, 2);
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length * 10 <= 100)).toBe(true);
  });
});

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
