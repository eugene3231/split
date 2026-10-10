import { useEffect, useRef, useState } from 'react';

interface ResetBillActionProps {
  onConfirm: () => void;
}

interface ResetBillConfirmationProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ResetBillConfirmation({ onCancel, onConfirm }: ResetBillConfirmationProps) {
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
      aria-labelledby="reset-bill-title"
      aria-describedby="reset-bill-description"
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-on-surface/40"
    >
      <h2 id="reset-bill-title" className="font-headline text-xl font-bold">
        Reset this bill?
      </h2>
      <p id="reset-bill-description" className="mt-3 text-sm text-on-surface-variant">
        This deletes everyone and every receipt in this bill, and can&apos;t be undone. Save the
        image or copy the text first if you want to keep it.
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
          Reset bill
        </button>
      </div>
    </dialog>
  );
}

export function ResetBillAction({ onConfirm }: ResetBillActionProps) {
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
        Reset bill
      </button>
      {showConfirmation && (
        <ResetBillConfirmation
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
