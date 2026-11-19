import { useEffect } from 'react';
import { useToastStore } from '@features/group-ledger/stores/toastStore';

const TOAST_MS = 6000;

export function Toaster() {
  const toast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className="pointer-events-auto flex max-w-md min-w-0 items-center gap-3 rounded-2xl bg-inverse-surface py-2 pr-2 pl-4 text-sm text-inverse-on-surface shadow-[0_12px_32px_-12px_rgba(23,28,39,0.5)] motion-safe:animate-rise-in"
      >
        <p className="min-w-0 flex-1 truncate">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.run();
              dismiss(toast.id);
            }}
            className="h-9 shrink-0 rounded-xl px-3 font-semibold text-white transition hover:bg-white/10"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
