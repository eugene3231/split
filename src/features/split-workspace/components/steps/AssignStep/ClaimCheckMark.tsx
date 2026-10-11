import type { Checkbox } from 'radix-ui';
import { CheckIcon } from '@features/split-workspace/components/shared/CheckIcon';
import { cn } from '@shared/utils/cn';

interface Props {
  /** Radix's checked state: 'indeterminate' draws a dash for a partly selected group. */
  checked: Checkbox.CheckedState;
}

export function ClaimCheckMark({ checked }: Props) {
  const markClass = cn(
    'text-on-primary motion-safe:transition-[transform,opacity] motion-safe:duration-180 motion-safe:ease-out',
    checked ? 'scale-100 opacity-100 motion-safe:animate-pop-in' : 'scale-50 opacity-0',
  );

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-outline-variant',
      )}
    >
      {checked === 'indeterminate' ? (
        <span className={cn('h-[3px] w-2.5 rounded-full bg-on-primary', markClass)} />
      ) : (
        <CheckIcon className={cn('h-3.5 w-3.5', markClass)} />
      )}
    </span>
  );
}
