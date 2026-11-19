import type { ComponentProps } from 'react';
import { Link } from '@shared/routing';
import { cn } from '@shared/utils/cn';

const ICON_BUTTON =
  'flex size-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface active:scale-95';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** The accessible name, since the icon has none. */
  label: string;
  icon: string;
}

export function IconButton({ label, icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={cn(ICON_BUTTON, className)} {...props}>
      <Icon name={icon} />
    </button>
  );
}

interface IconLinkProps extends Omit<ComponentProps<typeof Link>, 'children'> {
  label: string;
  icon: string;
}

export function IconLink({ label, icon, className, ...props }: IconLinkProps) {
  return (
    <Link aria-label={label} className={cn(ICON_BUTTON, className)} {...props}>
      <Icon name={icon} />
    </Link>
  );
}

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('material-symbols-outlined text-[1.375rem]', className)}>
      {name}
    </span>
  );
}
