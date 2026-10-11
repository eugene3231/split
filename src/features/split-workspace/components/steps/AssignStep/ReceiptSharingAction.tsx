import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { canSplitEvenly, hasReceiptSelections } from '@features/split-workspace/logic/evenSplit';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';

interface Props {
  receiptId: string;
}

export function ReceiptSharingAction({ receiptId }: Props) {
  const { receipt, people, splitReceiptEvenly } = useReceiptStore(
    useShallow((state) => ({
      receipt: state.receipts.find((entry) => entry.id === receiptId),
      people: state.people,
      splitReceiptEvenly: state.splitReceiptEvenly,
    })),
  );
  const [confirming, setConfirming] = useState(false);
  if (!receipt) return null;

  const share = () => {
    splitReceiptEvenly(receiptId);
    setConfirming(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={!canSplitEvenly(receipt.items, people)}
        onClick={() => {
          if (hasReceiptSelections(receipt.items)) setConfirming(true);
          else share();
        }}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface-container-high"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          groups
        </span>
        Share all items equally
      </button>
      {confirming && (
        <ConfirmDialog
          title="Share all items equally?"
          confirmLabel="Share equally"
          onCancel={() => setConfirming(false)}
          onConfirm={share}
        >
          This shares all items on {receipt.name} equally among all {people.length} people.
        </ConfirmDialog>
      )}
    </>
  );
}
