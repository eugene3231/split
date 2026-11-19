import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDataUrl } from './useDataUrl';

describe('useDataUrl', () => {
  it('gives the image made for the current key, and nothing while the next one is made', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useDataUrl(key, async () => `url:${key}`),
      {
        initialProps: { key: 'a' as string | null },
      },
    );

    await waitFor(() => expect(result.current).toBe('url:a'));
    rerender({ key: 'b' });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('url:b'));
    rerender({ key: null });
    expect(result.current).toBeNull();
  });

  it('stays empty when making the image fails', async () => {
    const { result } = renderHook(() => useDataUrl('a', () => Promise.reject(new Error('no'))));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current).toBeNull();
  });
});
