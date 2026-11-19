import { registerSW } from 'virtual:pwa-register';

// A new version reloads the page, so it waits until the app is out of sight
// rather than reloading under the user's hands. Drafts are in localStorage and survive it.
export function registerServiceWorker(): void {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      whenHidden(() => void updateServiceWorker(true));
    },
    onRegisteredSW(_url, registration) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update();
      });
    },
  });
}

function whenHidden(run: () => void): void {
  if (document.visibilityState === 'hidden') {
    run();
    return;
  }
  const onChange = () => {
    if (document.visibilityState !== 'hidden') return;
    document.removeEventListener('visibilitychange', onChange);
    run();
  };
  document.addEventListener('visibilitychange', onChange);
}
