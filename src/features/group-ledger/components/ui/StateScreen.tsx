import type { ReactNode } from 'react';
import { ScreenHeader } from './ScreenHeader';
import { Icon } from './IconButton';

interface StateScreenProps {
  icon: string;
  title: string;
  children?: ReactNode;
  /** What to do about it. */
  action?: ReactNode;
  /** Spins the icon, for a wait. */
  busy?: boolean;
}

/** A whole screen that says where things stand: loading, offline, a link that opens nothing. */
export function StateScreen({ icon, title, children, action, busy = false }: StateScreenProps) {
  return (
    <div className="min-h-dvh bg-surface font-body text-on-surface">
      <ScreenHeader back={{ kind: 'home' }} backLabel="Home" title={null} />
      <main className="mx-auto flex max-w-sm flex-col items-center px-6 pt-24 text-center motion-safe:animate-fade-in">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={icon} className={busy ? 'motion-safe:animate-spin' : undefined} />
        </span>
        <h1 className="mt-5 font-headline text-2xl font-bold tracking-tight">{title}</h1>
        {children && <p className="mt-2 text-[0.9375rem] text-on-surface-variant">{children}</p>}
        {action && <div className="mt-6 flex flex-col items-center gap-2">{action}</div>}
      </main>
    </div>
  );
}
