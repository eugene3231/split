import { create } from 'zustand';
import { ScanError } from '@features/receipt-scanner/logic/scanError';

interface PendingCheck {
  promise: Promise<string>;
  resolve: (token: string) => void;
  reject: (error: ScanError) => void;
}

interface TurnstileStore {
  pending: PendingCheck | null;
  request: () => Promise<string>;
}

export const useTurnstileStore = create<TurnstileStore>((set, get) => ({
  pending: null,
  request: () => {
    const existing = get().pending;
    if (existing) return existing.promise;

    const settle = () => set({ pending: null });
    let resolve!: PendingCheck['resolve'];
    let reject!: PendingCheck['reject'];
    const promise = new Promise<string>((res, rej) => {
      resolve = (token) => {
        settle();
        res(token);
      };
      reject = (error) => {
        settle();
        rej(error);
      };
    });
    set({ pending: { promise, resolve, reject } });
    return promise;
  },
}));

export function requestTurnstileToken(): Promise<string> {
  return useTurnstileStore.getState().request();
}
