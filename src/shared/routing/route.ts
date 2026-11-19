/** Every screen the app has, with what its address carries. */
export type Route =
  | { kind: 'home' }
  | { kind: 'split' }
  | { kind: 'join'; code: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'newExpense'; groupId: string }
  | { kind: 'editExpense'; groupId: string; entryId: string }
  | { kind: 'receipt'; groupId: string; entryId?: string }
  | { kind: 'settle'; groupId: string }
  | { kind: 'activity'; groupId: string };

const HOME: Route = { kind: 'home' };

/** An address the app has no screen for opens home. */
export function parseRoute(location: Pick<Location, 'pathname' | 'hash'>): Route {
  const segments = location.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(decodeSegment);
  if (!segments.every((segment) => segment !== null)) return HOME;
  const [first, groupId, page, entryId, ...rest] = segments;

  if (segments.length === 0) return HOME;
  if (first === 'split' && segments.length === 1) return { kind: 'split' };
  if (first === 'join' && segments.length === 1) {
    // The code rides in the hash so it never reaches a server log.
    const code = decodeSegment(location.hash.replace(/^#/, ''));
    return code ? { kind: 'join', code } : HOME;
  }
  if (first !== 'g' || groupId === undefined || rest.length > 0) return HOME;

  if (page === undefined) return { kind: 'group', groupId };
  if (entryId === undefined) {
    if (page === 'new') return { kind: 'newExpense', groupId };
    if (page === 'receipt') return { kind: 'receipt', groupId };
    if (page === 'settle') return { kind: 'settle', groupId };
    if (page === 'activity') return { kind: 'activity', groupId };
    return HOME;
  }
  if (page === 'e') return { kind: 'editExpense', groupId, entryId };
  if (page === 'receipt') return { kind: 'receipt', groupId, entryId };
  return HOME;
}

export function href(route: Route): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'split':
      return '/split';
    case 'join':
      return `/join#${encodeURIComponent(route.code)}`;
    case 'group':
      return groupPath(route.groupId);
    case 'newExpense':
      return groupPath(route.groupId, 'new');
    case 'editExpense':
      return groupPath(route.groupId, 'e', route.entryId);
    case 'receipt':
      return route.entryId === undefined
        ? groupPath(route.groupId, 'receipt')
        : groupPath(route.groupId, 'receipt', route.entryId);
    case 'settle':
      return groupPath(route.groupId, 'settle');
    case 'activity':
      return groupPath(route.groupId, 'activity');
  }
}

function groupPath(groupId: string, ...rest: string[]): string {
  return ['', 'g', groupId, ...rest].map(encodeURIComponent).join('/');
}

/** Null when the segment is not valid percent-encoding. */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
