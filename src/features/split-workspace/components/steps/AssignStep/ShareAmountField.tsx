import { useState } from 'react';
import { parseShareInput } from '@features/split-workspace/logic/itemShare';
import type { ShareInput } from '@features/split-workspace/logic/itemShare';

interface Props {
  label: string;
  onCommit: (input: ShareInput) => void;
  testId: string;
}

function focusOnMount(element: HTMLInputElement | null) {
  element?.focus();
}

/** The active person's share: tap it to type an amount ("8.50") or a percent ("40%"). */
export function ShareAmountField({ label, onCommit, testId }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={`Your share ${label}, tap to type an amount or percent`}
        data-testid={testId}
        onClick={() => setDraft('')}
        className="-mr-2 h-9 min-w-18 rounded-lg px-2 text-right font-semibold whitespace-nowrap tabular-nums underline decoration-outline/60 decoration-dotted decoration-2 underline-offset-4 transition-colors hover:bg-surface-container hover:decoration-transparent"
      >
        {label}
      </button>
    );
  }

  const commit = () => {
    const input = parseShareInput(draft);
    if (input) onCommit(input);
    setDraft(null);
  };

  return (
    <input
      ref={focusOnMount}
      type="text"
      inputMode="decimal"
      aria-label="Share as an amount or percent"
      data-testid={`${testId}-input`}
      value={draft}
      placeholder={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(null);
      }}
      className="-mr-2 h-9 w-18 rounded-lg border border-primary bg-surface-container-lowest px-2 py-1 text-right font-bold tabular-nums ring-1 ring-primary outline-none"
    />
  );
}
