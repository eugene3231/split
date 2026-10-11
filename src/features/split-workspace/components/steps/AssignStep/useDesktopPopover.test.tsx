import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDesktopPopover } from './useDesktopPopover';

describe('useDesktopPopover', () => {
  it('closes an open popover only when crossing into desktop, then removes the listener', () => {
    const desktop = new EventTarget();
    let matches = false;
    const media: MediaQueryList = {
      media: '(min-width: 48rem)',
      get matches() {
        return matches;
      },
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: desktop.addEventListener.bind(desktop),
      removeEventListener: desktop.removeEventListener.bind(desktop),
      dispatchEvent: desktop.dispatchEvent.bind(desktop),
    };
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const popover = document.createElement('div');
    popover.id = 'details';
    document.body.append(popover);
    const open = vi.spyOn(popover, 'matches').mockReturnValue(true);
    const hidePopover = vi.fn();
    Object.defineProperty(popover, 'hidePopover', { value: hidePopover });
    const { unmount } = renderHook(() => useDesktopPopover('details'));
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 48rem)');
    desktop.dispatchEvent(new Event('change'));
    expect(hidePopover).not.toHaveBeenCalled();
    matches = true;
    desktop.dispatchEvent(new Event('change'));
    expect(hidePopover).toHaveBeenCalledOnce();
    open.mockReturnValue(false);
    desktop.dispatchEvent(new Event('change'));
    expect(hidePopover).toHaveBeenCalledOnce();
    unmount();
    open.mockReturnValue(true);
    desktop.dispatchEvent(new Event('change'));
    expect(hidePopover).toHaveBeenCalledOnce();
    popover.remove();
    matchMedia.mockRestore();
  });
});
