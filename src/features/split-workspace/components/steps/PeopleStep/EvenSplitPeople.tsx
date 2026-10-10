import { useState } from 'react';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import {
  EVEN_SPLIT_MAX_PEOPLE,
  EVEN_SPLIT_MIN_PEOPLE,
  placeholderNames,
} from '@features/split-workspace/logic/evenSplit';

const stepButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface transition-transform active:scale-90 disabled:opacity-40 disabled:active:scale-100';

export function EvenSplitPeople() {
  const addPeople = useReceiptStore((state) => state.addPeople);
  const [count, setCount] = useState(EVEN_SPLIT_MIN_PEOPLE);

  return (
    <div
      data-testid="even-split-people"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-lowest px-5 py-4"
    >
      <p className="text-sm font-semibold text-on-surface">Splitting evenly? Skip the names.</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Fewer people"
            disabled={count <= EVEN_SPLIT_MIN_PEOPLE}
            onClick={() => setCount(count - 1)}
            className={stepButtonClass}
          >
            <span className="material-symbols-outlined !text-lg leading-none">remove</span>
          </button>
          <span
            data-testid="even-split-count"
            className="w-6 text-center text-base font-bold text-on-surface tabular-nums"
          >
            {count}
          </span>
          <button
            type="button"
            aria-label="More people"
            disabled={count >= EVEN_SPLIT_MAX_PEOPLE}
            onClick={() => setCount(count + 1)}
            className={stepButtonClass}
          >
            <span className="material-symbols-outlined !text-lg leading-none">add</span>
          </button>
        </div>
        <button
          type="button"
          data-testid="even-split-add-people-btn"
          onClick={() => addPeople(placeholderNames(count))}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-transform active:scale-95"
        >
          Add {count} people
        </button>
      </div>
    </div>
  );
}
