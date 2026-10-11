import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportActions } from './ExportActions';

describe.each(['buttons', 'icons'] as const)('ExportActions %s', (appearance) => {
  it('labels native success as shared', () => {
    render(
      <ExportActions
        appearance={appearance}
        exportState={{ kind: 'text-success', method: 'native' }}
        text="Dinner total: $10.00"
        nativeShareSupported
        onDownload={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    expect(screen.getByTestId('export-copy-text-btn')).toHaveTextContent('Shared!');
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('labels clipboard success as copied even when native share is supported', () => {
    render(
      <ExportActions
        appearance={appearance}
        exportState={{ kind: 'text-success', method: 'fallback' }}
        text="Dinner total: $10.00"
        nativeShareSupported
        onDownload={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    expect(screen.getByTestId('export-copy-text-btn')).toHaveTextContent('Copied!');
  });

  it('offers a labelled readonly field and selects its full text', () => {
    const text = 'Dinner total: $10.00\n\nAlice: $10.00';
    render(
      <ExportActions
        appearance={appearance}
        exportState={{ kind: 'manual-copy', message: 'Select the text below and copy it.' }}
        text={text}
        nativeShareSupported={false}
        onDownload={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Select the text below and copy it.');
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Split text' });
    expect(field).toHaveValue(text);
    expect(field).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Select text' }));

    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(text.length);
    expect(screen.getByTestId('export-copy-text-btn')).toBeEnabled();
  });
});

it('exposes icon actions and blocks duplicate exports while generating', () => {
  const download = vi.fn();
  const share = vi.fn();
  const { rerender } = render(
    <ExportActions
      appearance="icons"
      exportState={{ kind: 'idle' }}
      text="Split"
      nativeShareSupported={false}
      onDownload={download}
      onShare={share}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save Image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy Text' }));
  expect(download).toHaveBeenCalledOnce();
  expect(share).toHaveBeenCalledOnce();
  rerender(
    <ExportActions
      appearance="icons"
      exportState={{ kind: 'busy', action: 'download' }}
      text="Split"
      nativeShareSupported={false}
      onDownload={download}
      onShare={share}
    />,
  );
  expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Copy Text' })).toBeDisabled();
});

it('announces generation errors in the icon toolbar', () => {
  render(
    <ExportActions
      appearance="icons"
      exportState={{ kind: 'error', message: 'Unable to generate image.' }}
      text="Split"
      nativeShareSupported
      onDownload={vi.fn()}
      onShare={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to generate image.');
  expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled();
});
