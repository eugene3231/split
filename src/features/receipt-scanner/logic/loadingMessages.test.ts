import { afterEach, describe, expect, it, vi } from 'vitest';
import { FUNNY_LOADING_MESSAGES, getRandomLoadingMessageIndex } from './loadingMessages';

afterEach(() => vi.restoreAllMocks());

describe('getRandomLoadingMessageIndex', () => {
  it('never repeats the message on screen, even at the ends of the list', () => {
    const last = FUNNY_LOADING_MESSAGES.length - 1;
    for (const random of [0, 0.5, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(random);
      for (const shown of [0, 1, last]) {
        expect(getRandomLoadingMessageIndex(shown)).not.toBe(shown);
      }
    }
  });

  it('picks from the whole list when nothing valid is on screen', () => {
    const last = FUNNY_LOADING_MESSAGES.length - 1;
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(getRandomLoadingMessageIndex(undefined)).toBe(last);
    expect(getRandomLoadingMessageIndex(-1)).toBe(last);
    expect(getRandomLoadingMessageIndex(last + 1)).toBe(last);
  });
});
