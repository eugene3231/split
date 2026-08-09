import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RawBufferInput } from './RawBufferInput';

function parseIntOrNull(raw: string): number | null {
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

describe('RawBufferInput', () => {
  it('tracks raw typed text without reformatting mid-type, and commits exactly once on blur', () => {
    const onCommit = vi.fn();
    render(
      <RawBufferInput
        value={0}
        onCommit={onCommit}
        format={(v) => String(v)}
        parse={parseIntOrNull}
        testId="pct-input"
      />,
    );

    const input = screen.getByTestId('pct-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2' } });
    expect(input.value).toBe('2');
    fireEvent.change(input, { target: { value: '25' } });
    expect(input.value).toBe('25');
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(25);
  });

  it('commits on Enter by blurring the input', () => {
    const onCommit = vi.fn();
    render(
      <RawBufferInput
        value={0}
        onCommit={onCommit}
        format={(v) => String(v)}
        parse={parseIntOrNull}
        testId="pct-input"
      />,
    );
    const input = screen.getByTestId('pct-input') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith(40);
  });

  it('does not call onCommit when the typed text fails to parse', () => {
    const onCommit = vi.fn();
    render(
      <RawBufferInput
        value={0}
        onCommit={onCommit}
        format={(v) => String(v)}
        parse={parseIntOrNull}
        testId="pct-input"
      />,
    );
    const input = screen.getByTestId('pct-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('stops click and double-click from bubbling to the row', () => {
    const rowOnClick = vi.fn();
    const rowOnDoubleClick = vi.fn();
    render(
      <div onClick={rowOnClick} onDoubleClick={rowOnDoubleClick}>
        <RawBufferInput
          value={0}
          onCommit={() => {}}
          format={(v) => String(v)}
          parse={parseIntOrNull}
          testId="pct-input"
        />
      </div>,
    );
    const input = screen.getByTestId('pct-input');
    fireEvent.click(input);
    fireEvent.doubleClick(input);
    expect(rowOnClick).not.toHaveBeenCalled();
    expect(rowOnDoubleClick).not.toHaveBeenCalled();
  });

  it('displays the formatted committed value when not being edited', () => {
    render(
      <RawBufferInput
        value={25}
        onCommit={() => {}}
        format={(v) => `${v}`}
        parse={parseIntOrNull}
        testId="pct-input"
      />,
    );
    const input = screen.getByTestId('pct-input') as HTMLInputElement;
    expect(input.value).toBe('25');
  });
});
