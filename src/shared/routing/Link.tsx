import type { ComponentProps, MouseEvent } from 'react';
import { href, type Route } from './route';
import { navigate } from './navigation';

interface LinkProps extends Omit<ComponentProps<'a'>, 'href'> {
  to: Route;
}

/** A real link, so it can open in a new tab, that moves within the app without a reload. */
export function Link({ to, onClick, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || props.target === '_blank') return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return <a href={href(to)} onClick={handleClick} {...props} />;
}
