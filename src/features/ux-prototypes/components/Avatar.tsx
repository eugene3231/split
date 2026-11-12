import type { ComponentProps } from 'react';
import { cn } from '@shared/utils/cn';

interface Props extends ComponentProps<'span'> {
  name: string;
  color: string;
}

export function Avatar({ name, color, className, style, ...rest }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none',
        className,
      )}
      style={{ backgroundColor: color, ...style }}
      {...rest}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
