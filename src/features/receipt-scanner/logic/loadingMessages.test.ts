import { describe, expect, it, vi } from 'vitest';
import { FUNNY_LOADING_MESSAGES, getRandomLoadingMessageIndex } from './loadingMessages';

describe('getRandomLoadingMessageIndex', () => {
  it('returns a valid index when called without excludeIndex', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const idx = getRandomLoadingMessageIndex(undefined);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(FUNNY_LOADING_MESSAGES.length);
    vi.restoreAllMocks();
  });

  it('returns a different index than the excluded one', () => {
    for (let i = 0; i < 50; i++) {
      const result = getRandomLoadingMessageIndex(0);
      expect(result).not.toBe(0);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(FUNNY_LOADING_MESSAGES.length);
    }
  });

  it('returns a valid index for negative and out-of-range excludeIndex', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const negResult = getRandomLoadingMessageIndex(-1);
    expect(negResult).toBeGreaterThanOrEqual(0);
    expect(negResult).toBeLessThan(FUNNY_LOADING_MESSAGES.length);

    const overResult = getRandomLoadingMessageIndex(FUNNY_LOADING_MESSAGES.length);
    expect(overResult).toBeGreaterThanOrEqual(0);
    expect(overResult).toBeLessThan(FUNNY_LOADING_MESSAGES.length);
    vi.restoreAllMocks();
  });
});
