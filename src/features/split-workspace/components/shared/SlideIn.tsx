import type { ComponentProps } from 'react';
import { cn } from '@shared/utils/cn';
import type { SlideDirection } from '@features/split-workspace/hooks/useSlideDirection';

const ENTER_ANIMATION: Record<SlideDirection, string> = {
  forward: 'motion-safe:animate-slide-in-forward',
  back: 'motion-safe:animate-slide-in-back',
  none: 'motion-safe:animate-fade-in',
};

interface Props extends ComponentProps<'div'> {
  direction: SlideDirection;
}

/** Plays its enter animation on mount, so give it a `key` that changes with the content. */
export function SlideIn({ direction, className, ...props }: Props) {
  return (
    <div
      data-direction={direction}
      className={cn(ENTER_ANIMATION[direction], className)}
      {...props}
    />
  );
}
