import { registerSW } from 'virtual:pwa-register';

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
