import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  description: ReactNode;
  className?: string;
}

export function StepHeader({ title, description, className }: Props) {
  return (
    <div className={className}>
      <h1 className="font-headline text-[1.75rem] leading-tight font-bold tracking-tight break-words text-on-surface md:text-4xl">
        {title}
      </h1>
      <p className="mt-1.5 text-[0.9375rem] text-on-surface-variant md:text-base">{description}</p>
    </div>
  );
}
