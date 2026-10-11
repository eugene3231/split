import type { ReactNode } from 'react';
import { AlertDialog } from 'radix-ui';
import { cn } from '@shared/utils/cn';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = 'primary',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-on-surface/40 motion-safe:animate-fade-in" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-xl motion-safe:animate-rise-in">
          <AlertDialog.Title className="font-headline text-xl font-bold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-3 text-sm text-on-surface-variant">
            {children}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high">
              Cancel
            </AlertDialog.Cancel>
            {/* A plain button: Action would also close, which reports a cancel. */}
            <button
              type="button"
              onClick={onConfirm}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90',
                tone === 'danger' ? 'bg-error text-on-error' : 'bg-primary text-on-primary',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
