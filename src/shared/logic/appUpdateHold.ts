const holds = new Set<symbol>();

/**
 * Keeps a waiting app update from reloading the page while something unsaved is on screen.
 * Returns the release. The update goes ahead the next time the app is hidden with no hold.
 */
export function holdAppUpdate(): () => void {
  const hold = Symbol('app update hold');
  holds.add(hold);
  return () => {
    holds.delete(hold);
  };
}

export function appUpdateHeld(): boolean {
  return holds.size > 0;
}
