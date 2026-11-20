import { useEffect } from 'react';
import { holdAppUpdate } from '@shared/logic/appUpdateHold';

/** Keeps a waiting app update from reloading the page while this screen, holding unsaved work, is open. */
export function useHoldAppUpdate(): void {
  useEffect(() => holdAppUpdate(), []);
}
