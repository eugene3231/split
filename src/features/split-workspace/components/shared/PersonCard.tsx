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
    <div className="flex h-full flex-col rounded-2xl bg-surface-container-lowest p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <PersonAvatar name={person.name} colorIndex={colorIndex} />
          <h3 className="text-2xl font-bold text-primary">{person.name}</h3>
        </div>
        <div className="text-right">
          <span className="mb-1 block text-[10px] leading-none font-semibold tracking-widest text-on-surface-variant uppercase">
            {receiptBreakdown ? 'Grand Total Due' : 'Total Due'}
          </span>
          <p className="font-headline text-3xl leading-none font-semibold text-on-surface">
            {formatCurrencyFromCents(total, currency)}
          </p>
          {conversionRate !== undefined && fromCurrency !== undefined && (
            <>
              <span className="mt-1 block text-xs text-on-surface-variant">
                ≈ {formatCurrencyFromCents(Math.round(total * conversionRate), BASE_CURRENCY)}
              </span>
              <span className="block text-xs text-on-surface-variant">
                1 {BASE_CURRENCY} = {parseFloat((1 / conversionRate).toFixed(5))} {fromCurrency}
              </span>
            </>
          )}
        </div>
      </div>

      {/* PayNow QR — centered below header */}
      {qrDataUrl && (
        <div className="mb-4 flex flex-col items-center gap-1.5">
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
              className="h-auto w-40 rounded-xl border border-outline-variant/20"
            />
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">download</span>
              Click to download
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
              <div
                key={entry.name}
                className="flex justify-between text-base text-on-surface-variant"
              >
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
              <p className="text-xs text-outline italic">No items assigned.</p>
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
                    <div key={entry.name} className="rounded-xl bg-surface-container-low p-5">
                      <div className="mb-4 flex items-start justify-between">
                        <span className="text-base font-bold text-on-surface">{entry.name}</span>
                        <div className="text-right">
                          <span className="block text-base font-bold text-on-surface">
                            {formatCurrencyFromCents(entrySubtotalCents, entry.currency)}
                          </span>
                          {entry.effectiveRate !== undefined && (
                            <>
                              <span className="mt-0.5 block text-xs text-on-surface-variant">
                                ≈{' '}
                                {formatCurrencyFromCents(
                                  Math.round(entrySubtotalCents * entry.effectiveRate),
                                  BASE_CURRENCY,
                                )}
                              </span>
                              <span className="block text-xs text-on-surface-variant">
                                1 {BASE_CURRENCY} ={' '}
                                {parseFloat((1 / entry.effectiveRate).toFixed(5))} {entry.currency}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 border-t border-outline-variant/15 pt-3">
                        {entryLines.map((line, i) => (
                          <div
                            key={`${line.itemId}-${i}`}
                            className="flex justify-between pl-4 text-base"
                          >
                            <span
                              className={
                                line.involved
                                  ? 'truncate pr-4 text-on-surface-variant'
                                  : 'truncate pr-4 text-on-surface-variant/40 italic'
                              }
                            >
                              {line.name}
                            </span>
                            <span
                              className={
                                line.involved
                                  ? 'flex-shrink-0 text-on-surface-variant'
                                  : 'flex-shrink-0 text-on-surface-variant/40 italic'
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
                            <div className="border-t border-outline-variant/40" />
                            {entryDiscountAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-on-surface-variant italic">
                                  {buildChargeLabel('Discount', discount)}
                                </span>
                                <span className="text-on-surface-variant italic">
                                  −{formatCurrencyFromCents(entryDiscountAmt, entry.currency)}
                                </span>
                              </div>
                            )}
                            {entryServiceAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-on-surface-variant italic">
                                  {buildChargeLabel('Service Charge', serviceCharge)}
                                </span>
                                <span className="text-on-surface-variant italic">
                                  +{formatCurrencyFromCents(entryServiceAmt, entry.currency)}
                                </span>
                              </div>
                            )}
                            {entryGstAmt > 0 && (
                              <div className="flex justify-between pl-4 text-base">
                                <span className="text-on-surface-variant italic">
                                  {buildChargeLabel('GST / Tax', gst)}
                                </span>
                                <span className="text-on-surface-variant italic">
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
            <div className="rounded-xl bg-surface-container-low p-5">
              {lines.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic">No items assigned.</p>
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
                            ? 'truncate pr-4 text-on-surface-variant'
                            : 'truncate pr-4 text-on-surface-variant/40 italic'
                        }
                      >
                        {line.name}
                      </span>
                      <span
                        className={
                          line.involved
                            ? 'flex-shrink-0 text-on-surface-variant'
                            : 'flex-shrink-0 text-on-surface-variant/40 italic'
                        }
                      >
                        {line.involved
                          ? formatCurrencyFromCents(line.assignedAmountCents, currency)
                          : '—'}
                      </span>
                    </div>
                  ))}
                  {(serviceAmt > 0 || gstAmt > 0 || discountAmt > 0) && (
                    <div className="space-y-3 border-t border-outline-variant/15 pt-3">
                      {discountAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-on-surface-variant italic">
                            {buildChargeLabel('Discount', discount)}
                          </span>
                          <span className="text-on-surface-variant italic">
                            −{formatCurrencyFromCents(discountAmt, currency)}
                          </span>
                        </div>
                      )}
                      {serviceAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-on-surface-variant italic">
                            {buildChargeLabel('Service', serviceCharge)}
                          </span>
                          <span className="text-on-surface-variant italic">
                            +{formatCurrencyFromCents(serviceAmt, currency)}
                          </span>
                        </div>
                      )}
                      {gstAmt > 0 && (
                        <div className="flex justify-between pl-4 text-base">
                          <span className="text-on-surface-variant italic">
                            {buildChargeLabel('GST / Tax', gst)}
                          </span>
                          <span className="text-on-surface-variant italic">
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
