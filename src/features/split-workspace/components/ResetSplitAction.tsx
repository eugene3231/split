import { useState } from 'react';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';

interface ResetSplitActionProps {
  onConfirm: () => void;
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
        <ConfirmDialog
          title="Reset this split?"
          confirmLabel="Reset split"
          tone="danger"
          onCancel={() => setShowConfirmation(false)}
          onConfirm={() => {
            setShowConfirmation(false);
            onConfirm();
          }}
        >
          This removes everyone and every receipt, and can&apos;t be undone. To keep a copy, use
          Export split in the menu at the top, or Save Image or Copy Text below.
        </ConfirmDialog>
      )}
    </>
  );
}
