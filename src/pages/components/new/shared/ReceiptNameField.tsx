import { useRef } from 'react';
import { cn } from '@shared/utils/cn';

interface Props {
  name: string;
  onRename: (name: string) => void;
  className?: string;
  iconClassName?: string;
}

export function ReceiptNameField({ name, onRename, className, iconClassName }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  const commit = () => {
    const text = ref.current?.textContent?.trim();
    if (text) onRename(text);
    else if (ref.current) ref.current.textContent = name;
  };

  return (
    <span className="inline-flex items-center gap-1 w-fit max-w-full">
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            ref.current?.blur();
          }
          if (e.key === 'Escape') {
            if (ref.current) ref.current.textContent = name;
            ref.current?.blur();
          }
        }}
        className={cn(
          'font-bold text-sm text-on-surface bg-transparent outline-none cursor-text whitespace-nowrap rounded px-1 -mx-1 border border-transparent hover:border-outline-variant focus:border-primary transition-colors',
          className,
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'material-symbols-outlined !text-xs flex-shrink-0 opacity-60',
          iconClassName ?? 'text-on-surface-variant',
        )}
      >
        edit
      </span>
    </span>
  );
}
