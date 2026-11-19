import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDataUrl } from './useDataUrl';

describe('useDataUrl', () => {
  it('gives the image drawn for the current key, and loading while the next one is drawn', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useDataUrl(key, async () => `url:${key}`),
      { initialProps: { key: 'a' } },
    );

    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', url: 'url:a' }));
    rerender({ key: 'b' });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', url: 'url:b' }));
  });

  it('says it failed when drawing throws or gives nothing', async () => {
    const thrown = renderHook(() => useDataUrl('a', () => Promise.reject(new Error('no'))));
    const empty = renderHook(() => useDataUrl('a', async () => ''));

    await waitFor(() => expect(thrown.result.current).toEqual({ status: 'failed' }));
    await waitFor(() => expect(empty.result.current).toEqual({ status: 'failed' }));
  });
});
