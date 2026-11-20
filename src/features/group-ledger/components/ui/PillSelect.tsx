import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

interface PillSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  /** What the pill shows; the native select lies over it, unseen, so the phone's own picker opens. */
  children: ReactNode;
}

export function PillSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  children,
}: PillSelectProps<T>) {
  return (
    <span className={cn('relative', className)}>
      {children}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          const picked = options.find((option) => option.value === event.target.value);
          if (picked) onChange(picked.value);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
