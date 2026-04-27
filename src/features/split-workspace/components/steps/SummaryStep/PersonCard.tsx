import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { buildChargeLabel } from '@features/split-workspace/logic/chargeLabels';
import type { ChargeState, Person, SplitResult } from '@shared/types';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { buildDownloadFilename } from '@features/sharing/logic/shareSplit';
import { BASE_CURRENCY } from '@shared/constants';

interface ReceiptBreakdownEntry {
  name: string;
  split: SplitResult;
  currency?: string;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  effectiveRate?: number;
}

interface Props {
  person: Person;
  colorIndex: number;
  split: SplitResult;
  discount: ChargeState;
  serviceCharge: ChargeState;
  gst: ChargeState;
  showDetails?: boolean;
  receiptBreakdown?: ReceiptBreakdownEntry[];
  currency?: string;
  conversionRate?: number;
  fromCurrency?: string;
  qrDataUrl?: string;
}

export function PersonCard({
  person,
  colorIndex,
  split,
  discount,
  serviceCharge,
  gst,
  showDetails = false,
  receiptBreakdown,
  currency,
  conversionRate,
  fromCurrency,
  qrDataUrl,
}: Props) {
  const lines = split.lineItemsByPerson[person.id] ?? [];
  const total = split.totalByPersonCents[person.id] ?? 0;
  const discountAmt = split.discountByPersonCents[person.id] ?? 0;
  const serviceAmt = split.serviceByPersonCents[person.id] ?? 0;
  const gstAmt = split.gstByPersonCents[person.id] ?? 0;

  return (
    <div className="flex h-full flex-col rounded-[22px] bg-cream p-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} colorIndex={colorIndex} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-medium text-ink">{person.name}</h3>
          {conversionRate !== undefined && fromCurrency !== undefined && (
            <span className="block text-xs text-ink2">
              ≈ {formatCurrencyFromCents(Math.round(total * conversionRate), BASE_CURRENCY)}
              {' · '}1 SGD = {parseFloat((1 / conversionRate).toFixed(5))} {fromCurrency}
            </span>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p
            className="font-display text-2xl font-medium text-ink"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCurrencyFromCents(total, currency)}
          </p>
          <span className="text-[10px] font-medium tracking-wide text-ink2 uppercase">
            {receiptBreakdown ? 'Grand Total' : 'Total Due'}
          </span>
        </div>
        <span className="material-symbols-outlined text-sm text-ink2/40">chevron_right</span>
      </div>

      {/* PayNow QR — below header */}
      {qrDataUrl && (
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const a = document.createElement('a');
              a.href = qrDataUrl;
              a.download = buildDownloadFilename('paynow', person.name);
              a.click();
            }}
            className="flex cursor-pointer flex-col items-center gap-1.5"
          >
            <img
              src={qrDataUrl}
              alt={`PayNow QR for ${person.name}`}
              className="h-auto w-36 rounded-xl"
            />
            <span className="flex items-center gap-1 text-xs text-ink2">
              <span className="material-symbols-outlined text-sm">download</span>
              Tap to download
            </span>
          </button>
        </div>
      )}

      {/* Receipt totals summary (collapsed view) */}
      {!showDetails && receiptBreakdown && receiptBreakdown.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {receiptBreakdown.map((entry) => {
            const entryLines = (entry.split.lineItemsByPerson[person.id] ?? []).filter(
              (l) => l.involved,
            );
            const entrySubtotalCents = entryLines.reduce(
              (sum, l) => sum + l.assignedAmountCents,
              0,
            );
            if ((entry.split.lineItemsByPerson[person.id] ?? []).length === 0) return null;
            return (
              <div key={entry.name} className="flex justify-between text-sm text-ink2">
                <span className="truncate pr-3">{entry.name}</span>
                <span className="flex-shrink-0">
                  {formatCurrencyFromCents(entrySubtotalCents, entry.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Itemized shares */}
      {showDetails && (
        <div className="mt-2 flex-grow space-y-3">
          {receiptBreakdown ? (
            // Multi-receipt: each receipt as its own card
            receiptBreakdown.length === 0 ? (
              <p className="text-xs text-ink2/60 italic">No items assigned.</p>
            ) : (
              <div className="space-y-3">
                {receiptBreakdown.map((entry) => {
                  const entryLines = entry.split.lineItemsByPerson[person.id] ?? [];
                  const involvedLines = entryLines.filter((l) => l.involved);
                  const entrySubtotalCents = involvedLines.reduce(
                    (sum, l) => sum + l.assignedAmountCents,
                    0,
                  );
                  const entryDiscountAmt = entry.split.discountByPersonCents[person.id] ?? 0;
                  const entryServiceAmt = entry.split.serviceByPersonCents[person.id] ?? 0;
                  const entryGstAmt = entry.split.gstByPersonCents[person.id] ?? 0;
                  const hasCharges = entryDiscountAmt > 0 || entryServiceAmt > 0 || entryGstAmt > 0;
                  if (entryLines.length === 0) return null;

                  return (
                    <div key={entry.name} className="rounded-[18px] bg-cream-dim p-4">
                      <div className="mb-4 flex items-start justify-between">
                        <span className="text-base font-bold text-ink">{entry.name}</span>
                        <div className="text-right">
                          <span className="block text-base font-medium text-ink">
                            {formatCurrencyFromCents(entrySubtotalCents, entry.currency)}
                          </span>
                          {entry.effectiveRate !== undefined && (
                            <>
                              <span className="mt-0.5 block text-xs text-ink2">
                                ≈{' '}
                                {formatCurrencyFromCents(
                                  Math.round(entrySubtotalCents * entry.effectiveRate),
                                  BASE_CURRENCY,
                                )}
                              </span>
                              <span className="block text-xs text-ink2">
                                1 {BASE_CURRENCY} ={' '}
                                {parseFloat((1 / entry.effectiveRate).toFixed(5))} {entry.currency}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 border-t border-cream-dim pt-3">
                        {entryLines.map((line, i) => (
                          <div
                            key={`${line.itemId}-${i}`}
                            className="flex justify-between pl-4 text-base"
                          >
                            <span
                              className={
                                line.involved
                                  ? 'truncate pr-4 text-ink2'
                                  : 'truncate pr-4 text-ink2/40 italic'
                              }
                            >
                              {line.name}
                            </span>
                            <span
                              className={
                                line.involved
                                  ? 'flex-shrink-0 text-ink2'
                                  : 'flex-shrink-0 text-ink2/40 italic'
                              }
                            >
                              {line.involved
                                ? formatCurrencyFromCents(line.assignedAmountCents, entry.currency)
                                : '—'}
                            </span>
                          </div>
                        ))}
                        {hasCharges && (
                          <>
                            <div className="border-t border-cream" />
                            {entryDiscountAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-ink2 italic">
                                  {buildChargeLabel('Discount', entry.discount)}
                                </span>
                                <span className="text-ink2 italic">
                                  −{formatCurrencyFromCents(entryDiscountAmt, entry.currency)}
                                </span>
                              </div>
                            )}
                            {entryServiceAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-ink2 italic">
                                  {buildChargeLabel('Service Charge', entry.serviceCharge)}
                                </span>
                                <span className="text-ink2 italic">
                                  +{formatCurrencyFromCents(entryServiceAmt, entry.currency)}
                                </span>
                              </div>
                            )}
                            {entryGstAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-ink2 italic">
                                  {buildChargeLabel('GST / Tax', entry.gst)}
                                </span>
                                <span className="text-ink2 italic">
                                  +{formatCurrencyFromCents(entryGstAmt, entry.currency)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Single receipt: card with items + charges
            <div className="rounded-[18px] bg-cream-dim p-4">
              {lines.length === 0 ? (
                <p className="text-sm text-ink2 italic">No items assigned.</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line, i) => (
                    <div
                      key={`${line.itemId}-${i}`}
                      className="flex justify-between pl-4 text-base"
                    >
                      <span
                        className={
                          line.involved
                            ? 'truncate pr-4 text-ink2'
                            : 'truncate pr-4 text-ink2/40 italic'
                        }
                      >
                        {line.name}
                      </span>
                      <span
                        className={
                          line.involved
                            ? 'flex-shrink-0 text-ink2'
                            : 'flex-shrink-0 text-ink2/40 italic'
                        }
                      >
                        {line.involved
                          ? formatCurrencyFromCents(line.assignedAmountCents, currency)
                          : '—'}
                      </span>
                    </div>
                  ))}
                  {(serviceAmt > 0 || gstAmt > 0 || discountAmt > 0) && (
                    <div className="space-y-3 border-t border-cream-dim pt-3">
                      {discountAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-ink2 italic">
                            {buildChargeLabel('Discount', discount)}
                          </span>
                          <span className="text-ink2 italic">
                            −{formatCurrencyFromCents(discountAmt, currency)}
                          </span>
                        </div>
                      )}
                      {serviceAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-ink2 italic">
                            {buildChargeLabel('Service', serviceCharge)}
                          </span>
                          <span className="text-ink2 italic">
                            +{formatCurrencyFromCents(serviceAmt, currency)}
                          </span>
                        </div>
                      )}
                      {gstAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-ink2 italic">
                            {buildChargeLabel('GST / Tax', gst)}
                          </span>
                          <span className="text-ink2 italic">
                            +{formatCurrencyFromCents(gstAmt, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
