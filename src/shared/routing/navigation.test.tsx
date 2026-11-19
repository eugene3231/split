import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link, navigate, useRoute } from '.';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('useRoute', () => {
  it('follows navigate, and back to where it was', () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ kind: 'home' });

    act(() => navigate({ kind: 'settle', groupId: 'g1' }));
    expect(result.current).toEqual({ kind: 'settle', groupId: 'g1' });
    expect(window.location.pathname).toBe('/g/g1/settle');

    act(() => {
      window.history.replaceState(null, '', '/split');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toEqual({ kind: 'split' });
  });

  it('replaces the entry instead of adding one when asked', () => {
    const before = window.history.length;

    act(() => navigate({ kind: 'split' }, { replace: true }));

    expect(window.history.length).toBe(before);
    expect(window.location.pathname).toBe('/split');
  });

  it('reads a join code from the hash as it changes', () => {
    const { result } = renderHook(() => useRoute());

    act(() => {
      window.history.replaceState(null, '', '/join#abc');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current).toEqual({ kind: 'join', code: 'abc' });
  });
});

describe('Link', () => {
  it('moves within the app on a plain click', () => {
    const onClick = vi.fn();
    render(
      <Link to={{ kind: 'group', groupId: 'g1' }} onClick={onClick}>
        Open group
      </Link>,
    );
    const link = screen.getByRole('link', { name: 'Open group' });

    expect(link).toHaveAttribute('href', '/g/g1');
    fireEvent.click(link);

    expect(onClick).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe('/g/g1');
  });

  it('leaves a modified click to the browser', () => {
    render(<Link to={{ kind: 'split' }}>Quick split</Link>);

    const handled = fireEvent.click(screen.getByRole('link', { name: 'Quick split' }), {
      metaKey: true,
    });

    expect(handled).toBe(true);
    expect(window.location.pathname).toBe('/');
  });
});
