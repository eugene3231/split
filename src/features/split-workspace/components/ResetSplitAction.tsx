import { useState } from 'react';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';
import { cn } from '@shared/utils/cn';

interface ResetSplitActionProps {
  onConfirm: () => void;
  className?: string;
}

export function ResetSplitAction({ onConfirm, className }: ResetSplitActionProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirmation(true)}
        className={cn(
          'flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap text-on-surface-variant transition-colors hover:bg-error-container hover:text-error',
          className,
        )}
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
          Export to file in the menu at the top, or Save image above.
        </ConfirmDialog>
      )}
    </>
  );
}
