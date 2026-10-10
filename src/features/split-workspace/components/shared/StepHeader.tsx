import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  description: ReactNode;
  className?: string;
}

export function StepHeader({ title, description, className }: Props) {
  return (
    <div className={className}>
      <h1 className="font-headline text-2xl leading-tight font-extrabold tracking-tight break-words text-on-surface md:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-on-surface-variant md:text-base">{description}</p>
    </div>
  );
}
