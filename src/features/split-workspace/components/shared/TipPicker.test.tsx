import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChargeState } from '@shared/types';
import { defaultTipState } from '@features/split-workspace/constants';
import { TipPicker } from './TipPicker';

function Harness({ onChange }: { onChange: (next: ChargeState) => void }) {
  const [tip, setTip] = useState(defaultTipState);
  return (
    <TipPicker
      value={tip}
      onChange={(next) => {
        onChange(next);
        setTip(next);
      }}
      currency="SGD"
    />
  );
}

function renderPicker() {
  const onChange = vi.fn<(next: ChargeState) => void>();
  render(<Harness onChange={onChange} />);
  return () => onChange.mock.lastCall?.[0];
}

describe('TipPicker', () => {
  it('starts with no tip', () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByTestId('tip-none')).toHaveAttribute('aria-pressed', 'true');
  });

  it('picks a preset percent, then a typed amount, then no tip again', () => {
    const latest = renderPicker();

    fireEvent.click(screen.getByTestId('tip-15'));
    expect(latest()).toMatchObject({ enabled: true, mode: 'percent', percentInput: '15' });
    expect(screen.getByTestId('tip-15')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByTestId('tip-amount-input'), { target: { value: '12.50' } });
    expect(latest()).toMatchObject({ enabled: true, mode: 'amount', amountInput: '12.50' });
    expect(screen.getByTestId('tip-15')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('tip-none'));
    expect(latest()?.enabled).toBe(false);
    expect(screen.getByTestId('tip-amount-input')).toHaveValue('');
  });

  it('turns the tip off when the typed amount is cleared', () => {
    const latest = renderPicker();

    fireEvent.change(screen.getByTestId('tip-amount-input'), { target: { value: '5' } });
    fireEvent.change(screen.getByTestId('tip-amount-input'), { target: { value: '' } });

    expect(latest()?.enabled).toBe(false);
  });
});
