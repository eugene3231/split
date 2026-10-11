import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { canSplitEvenly } from '@features/split-workspace/logic/evenSplit';

interface Props {
  onSplitEvenly: () => void;
}

export function EvenSplitCard({ onSplitEvenly }: Props) {
  const { people, receipts } = useReceiptStore(
    useShallow((state) => ({ people: state.people, receipts: state.receipts })),
  );

  if (!canSplitEvenly(receipts, people)) return null;

  return (
    <div
      data-testid="even-split-card"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest px-5 py-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-on-surface">Shared most of it?</p>
        <p className="text-xs text-on-surface-variant">
          Start with all {people.length} people on every item, then untick what someone didn't have.
        </p>
      </div>
      <button
        type="button"
        data-testid="even-split-btn"
        onClick={onSplitEvenly}
        className="flex items-center gap-2 rounded-xl bg-surface-container px-4 py-2 text-sm font-bold text-on-surface transition-transform active:scale-95"
      >
        <span className="material-symbols-outlined !text-base leading-none">call_split</span>
        Start even
      </button>
    </div>
  );
}
