import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

interface TextFieldProps extends ComponentProps<'input'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function TextField({ label, hint, className, ...props }: TextFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block section-label">{label}</span>
      <input
        className="h-12 w-full field px-4 text-base text-on-surface outline-none placeholder:text-outline"
        {...props}
      />
      {hint && <span className="mt-1.5 block px-1 text-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}
