import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { GeminiApiKeyModal } from './GeminiApiKeyModal';

describe('GeminiApiKeyModal', () => {
  beforeEach(() => {
    useGeminiStore.setState({
      geminiApiKeyInput: '',
      geminiModel: DEFAULT_GEMINI_MODEL,
      showApiKeyModal: true,
      apiKeyModalReason: null,
    });
  });

  it('hides the key until the user asks to see it', () => {
    render(<GeminiApiKeyModal />);
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show key' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide key' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('marks the default model in the picker', () => {
    render(<GeminiApiKeyModal />);
    const defaultOption = screen.getByRole('option', { name: /default/i });
    expect(defaultOption).toHaveValue(DEFAULT_GEMINI_MODEL);
  });

  it('links to where a key is created', () => {
    render(<GeminiApiKeyModal />);
    expect(screen.getByRole('link', { name: /key/i })).toHaveAttribute(
      'href',
      'https://aistudio.google.com/app/api-keys',
    );
  });

  it('shows why it opened after a scan fell back, and drops the reason when closed', () => {
    useGeminiStore
      .getState()
      .openApiKeyModalFor("Split's shared scanner has reached today's limit.");
    render(<GeminiApiKeyModal />);

    expect(screen.getByRole('status')).toHaveTextContent(
      "Split's shared scanner has reached today's limit.",
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(useGeminiStore.getState().apiKeyModalReason).toBeNull();
  });

  it('shows no reason when opened by hand', () => {
    render(<GeminiApiKeyModal />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
