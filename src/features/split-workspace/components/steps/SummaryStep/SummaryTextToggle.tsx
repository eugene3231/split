import type { ComponentProps } from 'react';
import { cn } from '@shared/utils/cn';

interface Props extends ComponentProps<'button'> {
  icon: string;
}

export function SummaryTextToggle({ icon, className, children, ...props }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary',
        className,
      )}
      {...props}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {children}
    </button>
  );
}
