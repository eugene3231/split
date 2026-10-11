import { BASE_CURRENCY } from '@shared/constants';
import { formatCurrencyFromCents, formatExchangeRate } from '@shared/logic/core/money';
import type {
  BreakdownChargeRow,
  BreakdownConversion,
  BreakdownItemRow,
  PersonBreakdown,
  ReceiptBreakdownSection,
  ReceiptBreakdownTotal,
} from '@shared/types/summaryBreakdown';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { buildDownloadFilename } from '@features/sharing/logic/shareSplit';
import { cn } from '@shared/utils/cn';

interface Props {
  breakdown: PersonBreakdown;
  showDetails?: boolean;
}

export function PersonBreakdownCard({ breakdown, showDetails = false }: Props) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-surface-container-lowest p-4 sm:p-6">
      {/* Wraps the total under the name rather than truncating the name when both don't fit.
          React only: the PNG card is a fixed 760px wide, so its header always fits on one line. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={breakdown.person.name} colorIndex={breakdown.colorIndex} />
          <h3 className="truncate text-xl font-bold text-primary sm:text-2xl">
            {breakdown.person.name}
          </h3>
        </div>
        <div className="ml-auto flex-shrink-0 text-right">
          <span className="mb-1 block text-[10px] leading-none font-semibold tracking-widest text-on-surface-variant uppercase">
            {breakdown.headerLabel}
          </span>
          <p className="font-headline text-2xl leading-none font-semibold text-on-surface sm:text-3xl">
            {formatCurrencyFromCents(breakdown.totalCents, breakdown.currency)}
          </p>
          {breakdown.conversion && <ConversionLines conversion={breakdown.conversion} />}
        </div>
      </div>

      {breakdown.qrDataUrl && (
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const a = document.createElement('a');
              a.href = breakdown.qrDataUrl ?? '';
              a.download = buildDownloadFilename('paynow', breakdown.person.name);
              a.click();
            }}
            className="flex cursor-pointer flex-col items-center gap-1.5"
          >
            <img
              src={breakdown.qrDataUrl}
              alt={`PayNow QR for ${breakdown.person.name}`}
              className="h-auto w-40 rounded-xl border border-outline-variant/20"
            />
            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">download</span>
              Click to download
            </span>
          </button>
        </div>
      )}

      {!showDetails && breakdown.collapsedReceiptTotals.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {breakdown.collapsedReceiptTotals.map((total) => (
            <CollapsedReceiptTotal key={total.id} total={total} />
          ))}
        </div>
      )}

      {showDetails && (
        <div className="mt-2 flex-grow space-y-3">
          {breakdown.emptyMessage ? (
            <p className="text-sm text-on-surface-variant italic">{breakdown.emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {breakdown.sections.map((section) => (
                <ReceiptSection key={section.id} section={section} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CollapsedReceiptTotal({ total }: { total: ReceiptBreakdownTotal }) {
  return (
    <div className="flex justify-between text-base text-on-surface-variant">
      <span className="truncate pr-3">{total.label}</span>
      <span className="flex-shrink-0">
        {formatCurrencyFromCents(total.totalCents, total.currency)}
      </span>
    </div>
  );
}

function ReceiptSection({ section }: { section: ReceiptBreakdownSection }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-3 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="min-w-0 text-base font-bold text-on-surface">{section.title}</span>
        <div className="flex-shrink-0 text-right">
          <span className="block text-base font-bold text-on-surface">
            {formatCurrencyFromCents(section.totalCents, section.currency)}
          </span>
          {section.conversion && <ConversionLines conversion={section.conversion} compact />}
        </div>
      </div>
      <div className="space-y-3 border-t border-outline-variant/15 pt-3">
        {section.emptyMessage ? (
          <p className="text-sm text-on-surface-variant italic">{section.emptyMessage}</p>
        ) : (
          section.itemRows.map((row) => <ItemRow key={row.id} row={row} />)
        )}
        {section.chargeRows.length > 0 && (
          <>
            <div className="border-t border-outline-variant/40" />
            {section.chargeRows.map((row) => (
              <ChargeRow key={row.kind} row={row} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Names wrap rather than truncate, so two similar items stay tellable apart on a phone.
function ItemRow({ row }: { row: BreakdownItemRow }) {
  return (
    <div
      className={cn(
        'flex justify-between gap-4 text-base text-on-surface-variant sm:pl-4',
        !row.involved && 'text-on-surface-variant/40 italic',
      )}
    >
      <span className="min-w-0 break-words">{row.label}</span>
      <span className="flex-shrink-0">
        {row.amountCents !== null ? formatCurrencyFromCents(row.amountCents, row.currency) : '—'}
      </span>
    </div>
  );
}

function ChargeRow({ row }: { row: BreakdownChargeRow }) {
  return (
    <div className="flex justify-between gap-4 text-base sm:pl-4">
      <span className="text-on-surface-variant italic">{row.label}</span>
      <span className="text-on-surface-variant italic">
        {row.sign === 'minus' ? '−' : '+'}
        {formatCurrencyFromCents(row.amountCents, row.currency)}
      </span>
    </div>
  );
}

function ConversionLines({
  conversion,
  compact = false,
}: {
  conversion: BreakdownConversion;
  compact?: boolean;
}) {
  return (
    <>
      <span className={`${compact ? 'mt-0.5' : 'mt-1'} block text-xs text-on-surface-variant`}>
        ≈ {formatCurrencyFromCents(conversion.amountCents, conversion.toCurrency)}
      </span>
      {conversion.showRate && (
        <span className="block text-xs text-on-surface-variant">
          1 {BASE_CURRENCY} = {formatExchangeRate(1 / conversion.rate)} {conversion.fromCurrency}
        </span>
      )}
    </>
  );
}
