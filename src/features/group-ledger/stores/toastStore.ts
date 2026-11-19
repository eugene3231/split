import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastStore {
  toast: Toast | null;
  show: (message: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** One message at a time, such as "Deleted Grab" with Undo. It outlives the screen that said it. */
export const useToastStore = create<ToastStore>((set, get) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: nextId++, message, action } }),
  dismiss: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
}));

export const showToast = (message: string, action?: Toast['action']) =>
  useToastStore.getState().show(message, action);
