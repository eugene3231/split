/** Runs `action`, then puts the page back at the top, as moving between steps does. */
export function withScrollToTop<Args extends unknown[]>(action: (...args: Args) => void) {
  return (...args: Args) => {
    action(...args);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
}
