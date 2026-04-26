import type { Person } from '@shared/types';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { getPersonColor } from '@shared/utils/personColors';

interface Props {
  rank: number;
  person: Person;
  colorIndex: number;
  totalCents: number;
  maxCents: number;
  currency: string;
}

export function PersonRowCompact({
  rank,
  person,
  colorIndex,
  totalCents,
  maxCents,
  currency,
}: Props) {
  const color = getPersonColor(colorIndex);
  const barWidth = maxCents > 0 ? (totalCents / maxCents) * 100 : 0;

  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-cream px-3 py-2.5">
      <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-ink2 tabular-nums">
        {rank}
      </span>
      <div
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color.avatarBg }}
      >
        {person.name.charAt(0).toUpperCase()}
      </div>
      <span className="w-14 shrink-0 truncate text-sm font-medium text-ink">{person.name}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-black/5" style={{ height: 6 }}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${barWidth}%`, backgroundColor: color.avatarBg }}
        />
      </div>
      <span
        className="font-display text-base font-semibold text-ink"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatCurrencyFromCents(totalCents, currency)}
      </span>
    </div>
  );
}
