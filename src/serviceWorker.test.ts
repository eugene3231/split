import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { registerServiceWorker } from './serviceWorker';

const updateServiceWorker = vi.fn<(reloadPage?: boolean) => Promise<void>>();
let options: RegisterSWOptions = {};

vi.mock('virtual:pwa-register', () => ({
  registerSW: (registerOptions: RegisterSWOptions) => {
    options = registerOptions;
    return updateServiceWorker;
  },
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('registerServiceWorker', () => {
  beforeEach(() => {
    setVisibility('visible');
    registerServiceWorker();
  });

  afterEach(() => {
    updateServiceWorker.mockReset();
  });

  it('waits for the app to be hidden before reloading into a new version', () => {
    options.onNeedRefresh?.();
    expect(updateServiceWorker).not.toHaveBeenCalled();

    setVisibility('hidden');
    expect(updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true);

    setVisibility('visible');
    setVisibility('hidden');
    expect(updateServiceWorker).toHaveBeenCalledOnce();
  });

  it('reloads into a new version at once when the app is already hidden', () => {
    setVisibility('hidden');
    options.onNeedRefresh?.();
    expect(updateServiceWorker).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('checks for a new version each time the app comes back into view', () => {
    const registration = { update: vi.fn(() => Promise.resolve()) };
    options.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration);

    setVisibility('hidden');
    expect(registration.update).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(registration.update).toHaveBeenCalledOnce();
  });
});
