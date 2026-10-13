import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportActions } from './ExportActions';

describe('ExportActions', () => {
  it('labels native success as shared', () => {
    render(
      <ExportActions
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
