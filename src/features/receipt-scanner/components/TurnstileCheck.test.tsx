import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTurnstileStore } from '@features/receipt-scanner/stores/turnstileStore';
import type { TurnstileApi } from '@features/receipt-scanner/api/turnstileScript';
import { TurnstileCheck } from './TurnstileCheck';

const SCRIPT_SELECTOR = 'script[src^="https://challenges.cloudflare.com/turnstile"]';

let renderOptions: Parameters<TurnstileApi['render']>[1] | null;
const removeMock = vi.fn();

beforeEach(() => {
  renderOptions = null;
  removeMock.mockReset();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
  window.turnstile = {
    render: (_container, options) => {
      renderOptions = options;
      return 'widget-1';
    },
    remove: removeMock,
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.turnstile;
  document.head.querySelectorAll(SCRIPT_SELECTOR).forEach((node) => node.remove());
  useTurnstileStore.setState({ pending: null });
});

describe('TurnstileCheck', () => {
  it('shows nothing and loads no script until a check is requested', () => {
    render(<TurnstileCheck />);

    expect(screen.queryByTestId('turnstile-check')).not.toBeInTheDocument();
    expect(document.head.querySelector(SCRIPT_SELECTOR)).toBeNull();
    expect(renderOptions).toBeNull();
  });

  it('renders the widget with the site key and resolves the request with its token', async () => {
    render(<TurnstileCheck />);

    let token!: Promise<string>;
    act(() => {
      token = useTurnstileStore.getState().request();
    });

    await waitFor(() => expect(renderOptions?.sitekey).toBe('site-key'));
    expect(screen.getByTestId('turnstile-check')).toBeInTheDocument();

    act(() => renderOptions?.callback('cf-token'));

    await expect(token).resolves.toBe('cf-token');
    await waitFor(() => expect(screen.queryByTestId('turnstile-check')).not.toBeInTheDocument());
    expect(removeMock).toHaveBeenCalledWith('widget-1');
  });

  it('rejects with bot-check-failed when the widget errors', async () => {
    render(<TurnstileCheck />);
    let token!: Promise<string>;
    act(() => {
      token = useTurnstileStore.getState().request();
    });
    await waitFor(() => expect(renderOptions).not.toBeNull());

    act(() => renderOptions?.['error-callback']());

    await expect(token).rejects.toMatchObject({ kind: 'bot-check-failed' });
  });

  it('rejects with misconfigured when no site key is built in', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    render(<TurnstileCheck />);

    let token!: Promise<string>;
    act(() => {
      token = useTurnstileStore.getState().request();
    });

    await expect(token).rejects.toMatchObject({ kind: 'misconfigured' });
  });

  it('adds the Turnstile script only when a check starts', async () => {
    delete window.turnstile;
    render(<TurnstileCheck />);

    act(() => {
      void useTurnstileStore
        .getState()
        .request()
        .catch(() => undefined);
    });

    await waitFor(() => expect(document.head.querySelector(SCRIPT_SELECTOR)).not.toBeNull());
  });
});
