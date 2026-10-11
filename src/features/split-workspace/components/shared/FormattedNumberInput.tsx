import { useState } from 'react';
import type { ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: string;
  onValueChange: (value: string) => void;
  format: (value: string) => string;
}

/** A number field that shows `value` formatted, and keeps what the person types while it has focus. */
export function FormattedNumberInput({
  value,
  onValueChange,
  format,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="text"
      inputMode="decimal"
      {...props}
      value={draft ?? format(value)}
      onFocus={(event) => {
        setDraft(format(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onValueChange(event.target.value);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
