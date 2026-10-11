import { useState } from 'react';

export type SlideDirection = 'forward' | 'back' | 'none';

/** Which way `position` last moved, so the content that replaces it can slide in from that side. */
export function useSlideDirection(position: number): SlideDirection {
  const [previous, setPrevious] = useState(position);
  const [direction, setDirection] = useState<SlideDirection>('none');

  if (position !== previous) {
    setPrevious(position);
    setDirection(position > previous ? 'forward' : 'back');
  }

  return direction;
}
