import { useEffect, useRef, useState } from 'react';

interface ResetSplitActionProps {
  onConfirm: () => void;
}

interface ResetSplitConfirmationProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ResetSplitConfirmation({ onCancel, onConfirm }: ResetSplitConfirmationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="reset-split-title"
      aria-describedby="reset-split-description"
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-on-surface/40"
    >
      <h2 id="reset-split-title" className="font-headline text-xl font-bold">
        Reset this split?
      </h2>
      <p id="reset-split-description" className="mt-3 text-sm text-on-surface-variant">
        This removes everyone and every receipt, and can&apos;t be undone. To keep a copy of the
        breakdown, use Save Image or Copy Text first.
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
          className="rounded-xl bg-error px-4 py-2 text-sm font-semibold text-on-error transition-opacity hover:opacity-90"
        >
          Reset split
        </button>
      </div>
    </dialog>
  );
}

export function ResetSplitAction({ onConfirm }: ResetSplitActionProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirmation(true)}
        className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold whitespace-nowrap text-error transition-colors hover:bg-error-container md:px-4"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-base">
          restart_alt
        </span>
        Reset split
      </button>
      {showConfirmation && (
        <ResetSplitConfirmation
          onCancel={() => setShowConfirmation(false)}
          onConfirm={() => {
            setShowConfirmation(false);
            onConfirm();
          }}
        />
      )}
    </>
  );
}
