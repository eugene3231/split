import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { canSplitEvenly } from '@features/split-workspace/logic/evenSplit';

interface Props {
  onSplitEvenly: () => void;
}

export function EvenSplitCard({ onSplitEvenly }: Props) {
  const { people, activeReceipt } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      activeReceipt: state.receipts.find((receipt) => receipt.id === state.activeReceiptId),
    })),
  );

  if (!activeReceipt || !canSplitEvenly(activeReceipt.items, people)) return null;

  return (
    <div
      data-testid="even-split-card"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest px-5 py-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-on-surface">Shared most of this receipt?</p>
        <p className="text-xs text-on-surface-variant">
          Share this receipt between all {people.length} people, then untick exceptions in Items.
        </p>
      </div>
      <button
        type="button"
        data-testid="even-split-btn"
        onClick={onSplitEvenly}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-container px-4 py-2 text-sm font-bold text-on-surface transition-transform active:scale-95"
      >
        <span aria-hidden="true" className="material-symbols-outlined !text-base leading-none">
          call_split
        </span>
        Share all items equally
      </button>
    </div>
  );
}
