import { registerSW } from 'virtual:pwa-register';
import { appUpdateHeld } from '@shared/logic/appUpdateHold';

export function registerServiceWorker(): void {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      whenHiddenAndFree(() => void updateServiceWorker(true));
    },
    onRegisteredSW(_url, registration) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update();
      });
    },
  });
}

/** Runs once the app is out of sight with no form open, so the reload is never seen and loses nothing. */
function whenHiddenAndFree(run: () => void): void {
  const ready = () => document.visibilityState === 'hidden' && !appUpdateHeld();
  if (ready()) {
    run();
    return;
  }
  const onChange = () => {
    if (!ready()) return;
    document.removeEventListener('visibilitychange', onChange);
    run();
  };
  document.addEventListener('visibilitychange', onChange);
}
