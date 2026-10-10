import { useState } from 'react';
import { parseShareInput } from '@features/split-workspace/logic/itemShare';
import type { ShareInput } from '@features/split-workspace/logic/itemShare';

interface Props {
  label: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (input: ShareInput) => void;
  testId: string;
}

function focusOnMount(element: HTMLInputElement | null) {
  element?.focus();
}

/** The active person's share: tap it to type an amount ("8.50") or a percent ("40%"). */
export function ShareAmountField({ label, editing, onEditingChange, onCommit, testId }: Props) {
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Your share ${label}, tap to type an amount or percent`}
        data-testid={testId}
        onClick={() => {
          setDraft('');
          onEditingChange(true);
        }}
        className="min-w-18 shrink-0 text-right font-bold tabular-nums underline decoration-outline-variant decoration-dotted underline-offset-4"
      >
        {label}
      </button>
    );
  }

  const commit = () => {
    const input = parseShareInput(draft);
    if (input) onCommit(input);
    onEditingChange(false);
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
        if (event.key === 'Escape') onEditingChange(false);
      }}
      className="w-18 shrink-0 rounded-lg border-2 border-primary bg-surface-container-lowest px-2 py-1 text-right font-bold tabular-nums outline-none"
    />
  );
}
