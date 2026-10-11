/** True only when the browser says motion is fine, so tests and unknown setups stay still. */
export function prefersMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches ?? false;
}
