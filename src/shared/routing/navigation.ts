import { useSyncExternalStore } from 'react';
import { parseRoute, href, type Route } from './route';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('popstate', notify);
    window.removeEventListener('hashchange', notify);
  };
}

let snapshot: { address: string; route: Route } | null = null;

/** The same object for as long as the address stays the same, as `useSyncExternalStore` needs. */
function currentRoute(): Route {
  const address = window.location.pathname + window.location.hash;
  if (snapshot?.address !== address) snapshot = { address, route: parseRoute(window.location) };
  return snapshot.route;
}

interface NavigateOptions {
  replace?: boolean;
  /** Kept with the history entry, for the screen to read once, such as a sheet to open. */
  state?: unknown;
}

export function navigate(
  route: Route,
  { replace = false, state = null }: NavigateOptions = {},
): void {
  if (replace) window.history.replaceState(state, '', href(route));
  else window.history.pushState(state, '', href(route));
  notify();
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute);
}
