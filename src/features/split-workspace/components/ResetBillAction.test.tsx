import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetBillAction } from './ResetBillAction';

const prototype = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
const closeConnections: boolean[] = [];
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  closeConnections.push(this.isConnected);
  this.open = false;
});

beforeAll(() => {
  Object.defineProperty(prototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(prototype, 'close', { configurable: true, value: close });
});

afterAll(() => {
  if (originalShowModal) Object.defineProperty(prototype, 'showModal', originalShowModal);
  else Reflect.deleteProperty(prototype, 'showModal');
  if (originalClose) Object.defineProperty(prototype, 'close', originalClose);
  else Reflect.deleteProperty(prototype, 'close');
});

beforeEach(() => {
  vi.clearAllMocks();
  closeConnections.length = 0;
});

describe('ResetBillAction', () => {
  it('requires confirmation before resetting the bill', () => {
    const onConfirm = vi.fn(() => expect(closeConnections).toEqual([true]));
    render(<ResetBillAction onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset bill' }));

    const dialog = screen.getByRole('dialog', { name: 'Reset this bill?' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset bill' }));
    expect(closeConnections).toEqual([true]);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the bill when the user cancels', () => {
    const onConfirm = vi.fn();
    render(<ResetBillAction onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset bill' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledOnce();
    expect(closeConnections).toEqual([true]);
  });

  it('keeps the bill when the browser cancels the modal', () => {
    const onConfirm = vi.fn();
    render(<ResetBillAction onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset bill' }));

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeConnections).toEqual([true]);
  });
});
