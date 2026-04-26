import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { ChargeState, Person, SplitResult } from '@shared/types';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { getPersonColor } from '@shared/utils/personColors';
import { cn } from '@shared/utils/cn';

interface ReceiptBreakdownEntry {
  name: string;
  split: SplitResult;
  currency?: string;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
}

interface Props {
  person: Person;
  colorIndex: number;
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  expanded: boolean;
  currency?: string;
  receiptBreakdown?: ReceiptBreakdownEntry[];
  onToggle: () => void;
  onShowPayNow: () => void;
}

function shareLabel(splitCount: number): string {
  if (splitCount <= 1) return '1';
  return `1/${splitCount}`;
}

function totalPercent(split: SplitResult, personId: string): number {
  const total = split.totalByPersonCents[personId] ?? 0;
  if (split.grandTotalCents <= 0) return 0;
  return Math.round((total / split.grandTotalCents) * 100);
}

export function PersonPaymentCard({
  person,
  colorIndex,
  split,
  discount,
  serviceCharge,
  gst,
  expanded,
  currency,
  receiptBreakdown,
  onToggle,
  onShowPayNow,
}: Props) {
  const color = getPersonColor(colorIndex);
  const total = split.totalByPersonCents[person.id] ?? 0;
  const lines = split.lineItemsByPerson[person.id] ?? [];
  const involvedLines = lines.filter((line) => line.involved);
  const subtotal = split.subtotalByPersonCents[person.id] ?? 0;
  const discountAmt = split.discountByPersonCents[person.id] ?? 0;
  const serviceAmt = split.serviceByPersonCents[person.id] ?? 0;
  const gstAmt = split.gstByPersonCents[person.id] ?? 0;
  const chargeShare = serviceAmt + gstAmt;
  const percent = totalPercent(split, person.id);
  const itemCount = involvedLines.length;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  const hasReceiptBreakdown = !!receiptBreakdown && receiptBreakdown.length > 0;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-[22px] bg-cream px-5 py-3.5 text-left transition-colors hover:bg-cream-dim"
      >
        <PersonAvatar name={person.name} colorIndex={colorIndex} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-medium text-ink sm:text-xl">
            {person.name}
          </h3>
          <p className="truncate text-xs text-ink2 sm:text-sm">
            {percent}% · {itemCountLabel}
          </p>
        </div>
        <p
          className="shrink-0 font-display text-xl font-medium text-ink sm:text-2xl"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrencyFromCents(total, currency)}
        </p>
        <span className="material-symbols-outlined text-lg text-ink2">chevron_right</span>
      </button>
    );
  }

  return (
    <div className="rounded-[22px] border-2 border-accent-red bg-[#FFFCF7] px-5 py-4">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <PersonAvatar name={person.name} colorIndex={colorIndex} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-medium text-ink sm:text-xl">
            {person.name}
          </h3>
          <p className="truncate text-xs text-ink2 sm:text-sm">
            {percent}% · {itemCountLabel}
          </p>
        </div>
        <p
          className="shrink-0 font-display text-xl font-medium text-ink sm:text-2xl"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrencyFromCents(total, currency)}
        </p>
        <span className="material-symbols-outlined text-lg text-ink2">expand_less</span>
      </button>

      <div className="mt-4 border-t border-cream-dim pt-4">
        {hasReceiptBreakdown ? (
          <div className="space-y-4">
            {receiptBreakdown.map((entry) => {
              const entryLines = (entry.split.lineItemsByPerson[person.id] ?? []).filter(
                (line) => line.involved,
              );
              const entrySubtotal = entry.split.subtotalByPersonCents[person.id] ?? 0;
              const entryDiscount = entry.split.discountByPersonCents[person.id] ?? 0;
              const entryCharges =
                (entry.split.serviceByPersonCents[person.id] ?? 0) +
                (entry.split.gstByPersonCents[person.id] ?? 0);
              if (entryLines.length === 0 && entrySubtotal === 0) return null;

              return (
                <div key={entry.name} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-ink2 uppercase">
                      {entry.name}
                    </p>
                    <p className="text-sm font-medium text-ink">
                      {formatCurrencyFromCents(
                        entry.split.totalByPersonCents[person.id] ?? 0,
                        entry.currency,
                      )}
                    </p>
                  </div>
                  <ItemLines lines={entryLines} currency={entry.currency} color={color.avatarBg} />
                  <TotalsRows
                    subtotal={entrySubtotal}
                    discount={entryDiscount}
                    chargeShare={entryCharges}
                    currency={entry.currency}
                    discountLabel={buildChargeLabel('Discount', entry.discount)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-1.5">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-ink2 uppercase">
                Items
              </p>
              <span className="text-[11px] font-semibold text-ink2">-</span>
              <span className="text-[11px] font-semibold tracking-[0.22em] text-ink2">
                {involvedLines.length}
              </span>
            </div>

            {involvedLines.length > 0 ? (
              <ItemLines lines={involvedLines} currency={currency} color={color.avatarBg} />
            ) : (
              <p className="text-sm text-ink2 italic">No items assigned.</p>
            )}

            <TotalsRows
              subtotal={subtotal}
              discount={discountAmt}
              chargeShare={chargeShare}
              currency={currency}
              discountLabel={buildChargeLabel('Discount', discount)}
              chargeLabel={
                serviceAmt > 0 && gstAmt > 0
                  ? 'Share of GST + service'
                  : serviceAmt > 0
                    ? buildChargeLabel('Service', serviceCharge)
                    : buildChargeLabel('GST / Tax', gst)
              }
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onShowPayNow}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] bg-ink px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <span className="material-symbols-outlined text-base">qr_code_2</span>
        Show PayNow QR
      </button>
    </div>
  );
}

type ItemLinesProps = {
  lines: SplitResult['lineItemsByPerson'][string];
  currency?: string;
  color: string;
};

function ItemLines({ lines, currency, color }: ItemLinesProps) {
  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={`${line.itemId}-${index}`} className="flex items-center gap-3 text-sm">
          <span
            className="h-5 w-5 shrink-0 rounded-[6px]"
            style={{ backgroundColor: index % 2 === 0 ? color : '#FFA12B' }}
          />
          <span className="min-w-0 flex-1 truncate text-ink">{line.name}</span>
          <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-ink2">
            {shareLabel(line.splitCount)}
          </span>
          <span className="w-16 shrink-0 text-right font-semibold text-ink">
            {formatCurrencyFromCents(line.assignedAmountCents, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

type TotalsRowsProps = {
  subtotal: number;
  discount: number;
  chargeShare: number;
  currency?: string;
  discountLabel: string;
  chargeLabel?: string;
};

function TotalsRows({
  subtotal,
  discount,
  chargeShare,
  currency,
  discountLabel,
  chargeLabel = 'Share of GST + service',
}: TotalsRowsProps) {
  const hasRows = subtotal > 0 || discount > 0 || chargeShare > 0;
  if (!hasRows) return null;

  return (
    <div
      className={cn('mt-4 space-y-1.5 border-t border-dashed border-cream-dim pt-3 text-sm', {
        'border-t-0 pt-0': subtotal === 0,
      })}
    >
      {subtotal > 0 && (
        <div className="flex justify-between gap-4 text-ink2">
          <span>Items subtotal</span>
          <span className="font-medium text-ink">
            {formatCurrencyFromCents(subtotal, currency)}
          </span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between gap-4 text-ink2">
          <span>{discountLabel}</span>
          <span className="font-medium text-ink">
            -{formatCurrencyFromCents(discount, currency)}
          </span>
        </div>
      )}
      {chargeShare > 0 && (
        <div className="flex justify-between gap-4 text-ink2">
          <span>{chargeLabel}</span>
          <span className="font-medium text-ink">
            +{formatCurrencyFromCents(chargeShare, currency)}
          </span>
        </div>
      )}
    </div>
  );
}
