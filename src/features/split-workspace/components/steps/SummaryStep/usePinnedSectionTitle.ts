import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** The receipt whose heading row has scrolled up under the pinned people row, if any. */
export function usePinnedSectionTitle(
  tableRef: RefObject<HTMLElement | null>,
  pinnedRef: RefObject<HTMLElement | null>,
): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const pinnedBottom = pinnedRef.current?.getBoundingClientRect().bottom ?? 0;
      const headings =
        tableRef.current?.querySelectorAll<HTMLElement>('[data-section-title]') ?? [];
      let current: string | null = null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top >= pinnedBottom) break;
        current = heading.dataset.sectionTitle ?? null;
      }
      setTitle(current);
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [tableRef, pinnedRef]);

  return title;
}
