import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL } from '@features/receipt-scanner/constants';
import { useGeminiStore } from '@features/split-workspace/stores/geminiStore';
import { quickSplitStore } from '@features/split-workspace/stores/receiptStore';
import { navigate } from '@shared/routing';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  quickSplitStore.getState().resetSplit();
  useGeminiStore.setState({
    geminiApiKeyInput: 'test-key',
    geminiModel: DEFAULT_GEMINI_MODEL,
    showApiKeyModal: false,
  });
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('opens home, and its quick split link opens the wizard where it was left', () => {
    quickSplitStore.getState().addPeople(['Alice']);
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: 'Quick split' }));

    expect(window.location.pathname).toBe('/split');
    expect(screen.getByTestId('workspace')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows the groups placeholder on every group address', () => {
    window.history.replaceState(null, '', '/g/g1/receipt/e1');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Groups are coming' })).toBeInTheDocument();

    act(() => navigate({ kind: 'home' }));
    expect(screen.getByRole('link', { name: 'Quick split' })).toBeInTheDocument();
  });
});
