import type { ReactNode } from 'react';
import type { Route } from '@shared/routing';
import { IconLink } from './IconButton';

interface ScreenHeaderProps {
  back?: Route;
  backLabel?: string;
  title: ReactNode;
  children?: ReactNode;
}

export function ScreenHeader({ back, backLabel = 'Back', title, children }: ScreenHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-(--app-bar-height) w-full max-w-xl items-center gap-1 border-b border-surface-container-highest px-2 sm:px-4">
        {back && <IconLink to={back} label={backLabel} icon="arrow_back" />}
        <div className="min-w-0 flex-1 px-2">{title}</div>
        {children}
      </div>
    </header>
  );
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="truncate font-headline text-xl font-bold tracking-tight text-on-surface">
      {children}
    </h1>
  );
}
