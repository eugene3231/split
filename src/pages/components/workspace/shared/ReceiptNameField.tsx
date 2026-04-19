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
    <span className="inline-flex w-fit max-w-full items-center gap-1">
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
          '-mx-1 cursor-text rounded border border-transparent bg-transparent px-1 text-sm font-bold whitespace-nowrap text-on-surface transition-colors outline-none hover:border-outline-variant focus:border-primary',
          className,
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'material-symbols-outlined flex-shrink-0 !text-xs opacity-60',
          iconClassName ?? 'text-on-surface-variant',
        )}
      >
        edit
      </span>
    </span>
  );
}
