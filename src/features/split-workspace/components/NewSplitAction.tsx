import { useEffect, useRef, useState } from 'react';

interface NewSplitActionProps {
  onConfirm: () => void;
}

interface NewSplitConfirmationProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function NewSplitConfirmation({ onCancel, onConfirm }: NewSplitConfirmationProps) {
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
      aria-labelledby="new-split-title"
      aria-describedby="new-split-description"
      onCancel={(event) => {
        event.preventDefault();
        handleCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-on-surface/40"
    >
      <h2 id="new-split-title" className="font-headline text-xl font-bold">
        Start a new split?
      </h2>
      <p id="new-split-description" className="mt-3 text-sm text-on-surface-variant">
        This replaces your current saved split. Export the breakdown first if you want to keep it.
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
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          Start new split
        </button>
      </div>
    </dialog>
  );
}

export function NewSplitAction({ onConfirm }: NewSplitActionProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirmation(true)}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
      >
        New split
      </button>
      {showConfirmation && (
        <NewSplitConfirmation
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
