import type { Person, Receipt, SplitResult } from '@shared/types';
import { getCurrencySymbol } from '@shared/logic/core/money';
import { ReceiptNameField } from '@features/split-workspace/components/shared/ReceiptNameField';
import { getPersonColor } from '@shared/utils/personColors';

interface Props {
  grandTotal: number;
  displayCurrency: string;
  currentReceipt: Receipt | null;
  people: Person[];
  onRenameReceipt: (id: string, name: string) => void;
  split?: SplitResult;
  exchangeRateText?: string | null;
}

export function GrandTotalCard({
  grandTotal,
  displayCurrency,
  currentReceipt,
  people,
  onRenameReceipt,
  split,
  exchangeRateText,
}: Props) {
  const totalFormatted = (grandTotal / 100).toFixed(2);
  const peopleLabel = `${people.length} ${people.length === 1 ? 'person' : 'people'}`;

  const barSegments = people
    .map((person, i) => {
      const personTotal = split?.totalByPersonCents[person.id] ?? 0;
      return {
        person,
        flex: split && grandTotal > 0 ? personTotal / grandTotal : 1,
        color: getPersonColor(i).avatarBg,
      };
    })
    .filter((segment) => segment.flex > 0);

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-ink px-8 py-5 text-left">
      {/* Decorative rings */}
      <div
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full"
        style={{ border: '1.5px solid rgba(255,255,255,0.07)' }}
      />
      <div
        className="pointer-events-none absolute -top-14 -right-8 h-44 w-44 rounded-full"
        style={{ border: '1.5px solid rgba(255,255,255,0.07)' }}
      />

      <div className="relative">
        <div className="mb-2 flex min-h-5 items-center justify-between gap-4">
          <div className="min-w-0 text-[11px] leading-none font-semibold tracking-[0.32em] text-white/48 uppercase">
            {currentReceipt ? (
              <ReceiptNameField
                key={currentReceipt.id}
                name={currentReceipt.name}
                onRename={(name) => onRenameReceipt(currentReceipt.id, name)}
                className="text-[11px] tracking-[0.32em] text-white/48 uppercase placeholder:text-white/30"
                iconClassName="text-white/30"
              />
            ) : (
              <span data-testid="grand-total-label">Grand total</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <span
            className="block font-display text-6xl leading-[0.92] font-medium text-white sm:text-7xl lg:text-6xl xl:text-7xl"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {getCurrencySymbol(displayCurrency)}
            {totalFormatted}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between gap-4 text-xs font-medium text-white/55">
          <span data-testid="grand-total-people-count">{peopleLabel}</span>
          {exchangeRateText && (
            <span data-testid="grand-total-exchange-rate" className="text-right">
              {exchangeRateText}
            </span>
          )}
        </div>

        {/* Stacked proportion bar — proportional widths when split data available */}
        {barSegments.length > 0 && (
          <div className="flex h-3 overflow-hidden rounded-full">
            {barSegments.map(({ person, flex, color }, i) => {
              const isFirst = i === 0;
              const isLast = i === barSegments.length - 1;
              const borderRadius =
                isFirst && isLast
                  ? '9999px'
                  : isFirst
                    ? '9999px 0 0 9999px'
                    : isLast
                      ? '0 9999px 9999px 0'
                      : undefined;
              return (
                <div
                  key={person.id}
                  style={{
                    flex,
                    background: color,
                    borderRadius,
                  }}
                />
              );
            })}
          </div>
        )}

        {/*
        Details are intentionally hidden for the compact card design.
        Restore this block if the expanded stats / PayNow controls are needed again.
          <div id="grand-total-details" className="pt-3">
            {showStats ? (
              <div className="mb-5 flex items-start gap-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                    Highest
                  </p>
                  <p
                    className="font-display text-base font-semibold text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatCurrencyFromCents(highest.cents, displayCurrency)} ·{' '}
                    {highest.person.name}
                  </p>
                </div>
                <div className="mt-1 w-px self-stretch bg-white/15" />
                <div>
                  <p className="text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                    Lowest
                  </p>
                  <p
                    className="font-display text-base font-semibold text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatCurrencyFromCents(lowest.cents, displayCurrency)} ·{' '}
                    {lowest.person.name}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mb-5 text-xs text-white/50">
                {people.length} {people.length === 1 ? 'person' : 'people'} · reconciled
              </p>
            )}

            <div className="mb-1">
              <label
                htmlFor="payer-mobile"
                className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/50 uppercase"
              >
                PayNow Number
              </label>
              <input
                id="payer-mobile"
                type="tel"
                value={payerMobile}
                onChange={(e) => handlePayerMobileChange(e.target.value)}
                onBlur={handlePayerMobileBlur}
                placeholder="9123 4567"
                className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-white/20"
              />
              {mobileError ? (
                <p className="mt-1 text-xs text-red-300">{mobileError}</p>
              ) : (
                <p className="mt-1.5 text-[10px] text-white/40">
                  Generates a PayNow QR per person.
                </p>
              )
            </div>
          </div>
        */}
      </div>
    </div>
  );
}
