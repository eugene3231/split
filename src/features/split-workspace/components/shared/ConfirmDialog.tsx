import { useEffect, useId, useRef, type ReactNode } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const handleCancel = () => {
    dialogRef.current?.close();
    onCancel();
  };

  const handleConfirm = () => {
    dialogRef.current?.close();
    onConfirm();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-on-surface/40"
    >
      <h2 id={titleId} className="font-headline text-xl font-bold">
        {title}
      </h2>
      <p id={descriptionId} className="mt-3 text-sm text-on-surface-variant">
        {children}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={handleCancel}
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-container-high"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className={cn(
            'rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90',
            tone === 'danger' ? 'bg-error text-on-error' : 'bg-primary text-on-primary',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
