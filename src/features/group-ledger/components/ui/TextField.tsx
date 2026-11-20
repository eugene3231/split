import type { ComponentProps, ReactNode } from 'react';

interface TextFieldProps extends ComponentProps<'input'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function TextField({ label, hint, className, ...props }: TextFieldProps) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block section-label">{label}</span>
        <input
          className="h-12 w-full field px-4 text-base text-on-surface outline-none placeholder:text-outline"
          {...props}
        />
      </label>
      {hint && <p className="mt-1.5 px-1 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
