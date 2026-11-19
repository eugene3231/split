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

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  if (options.replace) window.history.replaceState(null, '', href(route));
  else window.history.pushState(null, '', href(route));
  notify();
}

/** The screen the address bar names, kept current through links, back and forward. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute);
}
