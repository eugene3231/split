import { cn } from '@shared/utils/cn';
import { formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';

interface Props {
  name: string;
  totalCents: number;
  nextName: string;
  color: string;
  onNext: () => void;
  className?: string;
}

export function ClaimTally({ name, totalCents, nextName, color, onNext, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-3xl bg-neutral-900 p-3 pl-5 text-white shadow-2xl lg:flex-col lg:items-stretch lg:p-5 lg:shadow-none',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-white/60">{name} owes</p>
        <p className="text-2xl font-extrabold tabular-nums">{formatMoney(totalCents)}</p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="flex max-w-[55%] items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-bold lg:max-w-none"
        style={{ backgroundColor: color }}
      >
        <span className="truncate">Next: {nextName}</span>
        <span className="material-symbols-outlined text-lg">arrow_forward</span>
      </button>
    </div>
  );
}
