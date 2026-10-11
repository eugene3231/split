import type { ComponentProps } from 'react';

export function CheckIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    >
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}
