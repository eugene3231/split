import type { ReactNode } from 'react';

export function ActionBar({ status, children }: { status: ReactNode; children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-30 w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="px-4">
        <div className="mx-auto flex max-w-xl items-center gap-2 rounded-3xl bg-primary p-2 text-on-primary shadow-[0_8px_24px_-10px_rgba(23,28,39,0.35)]">
          <div
            aria-live="polite"
            className="flex min-h-12 min-w-0 flex-1 flex-col justify-center pl-3"
          >
            {status}
          </div>
          {children}
        </div>
      </div>
    </footer>
  );
}
