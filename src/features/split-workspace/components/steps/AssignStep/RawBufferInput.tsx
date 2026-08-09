import { useState } from 'react';
import { cn } from '@shared/utils/cn';

type RawBufferInputProps = {
  value: number;
  onCommit: (value: number) => void;
  format: (value: number) => string;
  parse: (raw: string) => number | null;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  testId?: string;
  inputMode?: 'numeric' | 'decimal';
  widthClassName?: string;
};

/**
 * Owns a local raw-text buffer so the input's displayed value is exactly what
 * was typed while focused, never a live-reformatted derivation — reformatting
 * on every keystroke fights the cursor mid-type. Commits (calls `onCommit`)
 * only on blur or Enter, never per keystroke.
 */
export function RawBufferInput({
  value,
  onCommit,
  format,
  parse,
  prefix,
  suffix,
  placeholder = '0',
  testId,
  inputMode = 'numeric',
  widthClassName = 'w-14',
}: RawBufferInputProps) {
  const [buffer, setBuffer] = useState<string | null>(null);

  const commit = () => {
    if (buffer === null) return;
    const parsed = parse(buffer);
    if (parsed !== null) {
      onCommit(parsed);
    }
    setBuffer(null);
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {prefix && <span className="text-sm font-bold text-on-surface-variant">{prefix}</span>}
      <input
        type="text"
        inputMode={inputMode}
        data-testid={testId}
        value={buffer ?? (value === 0 ? '' : format(value))}
        onChange={(event) => setBuffer(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        }}
        placeholder={placeholder}
        className={cn(
          widthClassName,
          'rounded-md border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-right text-sm font-bold text-secondary outline-none focus:border-primary/40',
        )}
      />
      {suffix && <span className="text-sm font-bold text-on-surface-variant">{suffix}</span>}
    </div>
  );
}
