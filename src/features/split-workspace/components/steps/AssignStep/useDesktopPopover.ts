import { useEffect } from 'react';

export function useDesktopPopover(id: string) {
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 48rem)');
    const closePopover = () => {
      const popover = document.getElementById(id);
      if (desktop.matches && popover?.matches(':popover-open')) popover.hidePopover();
    };
    desktop.addEventListener('change', closePopover);
    return () => desktop.removeEventListener('change', closePopover);
  }, [id]);
}
