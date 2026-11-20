export function withScrollToTop<Args extends unknown[]>(action: (...args: Args) => void) {
  return (...args: Args) => {
    action(...args);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
}
