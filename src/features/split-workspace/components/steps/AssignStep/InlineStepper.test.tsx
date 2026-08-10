import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InlineStepper } from './InlineStepper';

describe('InlineStepper', () => {
  it('disables decrement at the floor by default', () => {
    render(<InlineStepper weight={1} onDelta={() => {}} testId="stepper" />);
    expect(screen.getByTestId('stepper-decrement')).toBeDisabled();
  });

  it('allows overriding decrement-disabled so the floor can route elsewhere', () => {
    const onDelta = vi.fn();
    render(
      <InlineStepper weight={1} onDelta={onDelta} decrementDisabled={false} testId="stepper" />,
    );
    const decrement = screen.getByTestId('stepper-decrement');
    expect(decrement).not.toBeDisabled();
    fireEvent.click(decrement);
    expect(onDelta).toHaveBeenCalledWith(-1);
  });

  it('does not trigger the row assign-only handler on rapid clicks (stopPropagation regression)', () => {
    const onDelta = vi.fn();
    const rowOnClick = vi.fn();
    const rowOnDoubleClick = vi.fn();

    render(
      <div onClick={rowOnClick} onDoubleClick={rowOnDoubleClick}>
        <InlineStepper weight={2} onDelta={onDelta} testId="stepper" />
      </div>,
    );

    const increment = screen.getByTestId('stepper-increment');
    fireEvent.click(increment);
    fireEvent.doubleClick(increment);

    expect(onDelta).toHaveBeenCalled();
    expect(rowOnClick).not.toHaveBeenCalled();
    expect(rowOnDoubleClick).not.toHaveBeenCalled();
  });

  it('stops keydown from bubbling to the row (does not trigger row keyboard handlers)', () => {
    const rowOnKeyDown = vi.fn();

    render(
      <div onKeyDown={rowOnKeyDown}>
        <InlineStepper weight={2} onDelta={() => {}} testId="stepper" />
      </div>,
    );

    fireEvent.keyDown(screen.getByTestId('stepper-increment'), { key: 'Enter' });
    expect(rowOnKeyDown).not.toHaveBeenCalled();
  });
});
