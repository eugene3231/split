import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSplitAction } from './NewSplitAction';

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

describe('NewSplitAction', () => {
  it('requires confirmation before replacing the saved split', () => {
    const onConfirm = vi.fn(() => expect(closeConnections).toEqual([true]));
    render(<NewSplitAction onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'New split' }));

    expect(screen.getByRole('dialog', { name: 'Start a new split?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start new split' }));
    expect(closeConnections).toEqual([true]);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the split when the user cancels', () => {
    const onConfirm = vi.fn();
    render(<NewSplitAction onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'New split' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledOnce();
    expect(closeConnections).toEqual([true]);
  });

  it('keeps the split when the browser cancels the modal', () => {
    const onConfirm = vi.fn();
    render(<NewSplitAction onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'New split' }));

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(closeConnections).toEqual([true]);
  });
});
