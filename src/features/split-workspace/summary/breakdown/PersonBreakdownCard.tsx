import type { ReactElement } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type {
  BreakdownConversion,
  BreakdownRow,
  PersonBreakdown,
  PersonBreakdownBody,
  ReceiptBreakdownSection,
  ReceiptBreakdownTotal,
} from '@features/split-workspace/summary/breakdown/types';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import {
  formatChargeAmount,
  formatConversionLines,
  formatItemAmount,
} from '@features/split-workspace/summary/breakdown/breakdownFormat';
import { buildDownloadFilename } from '@features/split-workspace/summary/shareSplit';
import { cn } from '@shared/utils/cn';

interface Props {
  breakdown: PersonBreakdown;
}

// `personBreakdownImage.ts`, beside this file, draws the same breakdown for the PNG export.
// Where the two look different on purpose, a comment at the spot says so and
// docs/EXPORT-PARITY.md lists it.
export function PersonBreakdownCard({ breakdown }: Props) {
  return (
    <div className="flex h-full flex-col surface-card p-4 sm:p-6">
      {/* Wraps the total under the name rather than truncating the name when both don't fit.
          React only: the PNG card is a fixed 760px wide, so its header always fits on one line. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={breakdown.person.name} colorIndex={breakdown.colorIndex} />
          <h3 className="truncate text-lg font-semibold text-on-surface sm:text-xl">
            {breakdown.person.name}
          </h3>
        </div>
        <div className="ml-auto flex-shrink-0 text-right">
          <span className="mb-1 block text-xs leading-none font-medium text-on-surface-variant">
            {breakdown.headerLabel}
          </span>
          <p className="font-headline text-3xl leading-none font-bold tracking-tight text-on-surface tabular-nums">
            {formatCurrencyFromCents(breakdown.totalCents, breakdown.currency)}
          </p>
          {/* React only: each card keeps its rate; the PNG says it once, above the cards. */}
          {breakdown.conversion && <ConversionLines conversion={breakdown.conversion} />}
        </div>
      </div>

      <Body body={breakdown.body} />

      {breakdown.qrDataUrl && (
        <PayNowQr qrDataUrl={breakdown.qrDataUrl} personName={breakdown.person.name} />
      )}
    </div>
  );
}

function Body({ body }: { body: PersonBreakdownBody }): ReactElement | null {
  switch (body.kind) {
    case 'receiptTotals':
      if (body.totals.length === 0) return null;
      return (
        <div className="space-y-1.5 border-t border-surface-container-high pt-4">
          {body.totals.map((total) => (
            <ReceiptTotal key={total.id} total={total} />
          ))}
        </div>
      );
    case 'sections':
      return (
        <div className="flex-grow space-y-4">
          {body.sections.map((section) => (
            <ReceiptSection key={section.id} section={section} />
          ))}
        </div>
      );
    case 'empty':
      return (
        <div className="flex-grow border-t border-surface-container-high pt-4">
          <EmptyMessage message={body.message} />
        </div>
      );
  }
}

// React only: the code is a button that downloads it. The PNG shows the code alone.
function PayNowQr({ qrDataUrl, personName }: { qrDataUrl: string; personName: string }) {
  return (
    <div className="mt-auto pt-4">
      <button
        type="button"
        onClick={() => {
          const a = document.createElement('a');
          a.href = qrDataUrl;
          a.download = buildDownloadFilename('paynow', personName);
          a.click();
        }}
        className="flex max-w-full cursor-pointer flex-col items-start gap-1.5"
      >
        <img
          src={qrDataUrl}
          alt={`PayNow QR for ${personName}`}
          className="h-auto max-h-40 w-auto max-w-full"
        />
        <span className="flex items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm">download</span>
          Click to download
        </span>
      </button>
    </div>
  );
}

function ReceiptTotal({ total }: { total: ReceiptBreakdownTotal }) {
  return (
    <div className="flex justify-between text-[15px] text-on-surface tabular-nums">
      <span className="truncate pr-3">{total.label}</span>
      <span className="flex-shrink-0">
        {formatCurrencyFromCents(total.totalCents, total.currency)}
      </span>
    </div>
  );
}

function ReceiptSection({ section }: { section: ReceiptBreakdownSection }) {
  return (
    <div className="border-t border-surface-container-high pt-4">
      {section.showTitle && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="min-w-0 text-sm font-medium text-on-surface-variant">
            {section.title}
          </span>
          <div className="flex-shrink-0 text-right">
            <span className="block text-sm font-medium text-on-surface-variant tabular-nums">
              {formatCurrencyFromCents(section.totalCents, section.currency)}
            </span>
            {section.conversion && <ConversionLines conversion={section.conversion} compact />}
          </div>
        </div>
      )}
      <div className="space-y-2.5">
        {section.rows.map((row) => (
          <Row key={rowKey(row)} row={row} />
        ))}
      </div>
    </div>
  );
}

function rowKey(row: BreakdownRow): string {
  switch (row.kind) {
    case 'item':
      return row.id;
    case 'charge':
      return row.charge;
    case 'rule':
    case 'empty':
      return row.kind;
  }
}

function Row({ row }: { row: BreakdownRow }): ReactElement {
  switch (row.kind) {
    case 'item':
      // React only: a name wraps as far as it needs, so two similar items stay tellable apart
      // on a phone. The PNG stops at two lines.
      return (
        <div
          className={cn(
            'flex justify-between gap-4 text-[15px] text-on-surface tabular-nums',
            row.amountCents === null && 'text-on-surface-variant/50 italic',
          )}
        >
          <span className="min-w-0 break-words">{row.label}</span>
          <span className="flex-shrink-0">{formatItemAmount(row)}</span>
        </div>
      );
    case 'rule':
      return <div className="border-t border-dashed border-surface-container-highest" />;
    case 'charge':
      return (
        <div className="flex justify-between gap-4 text-sm text-on-surface-variant tabular-nums">
          <span>{row.label}</span>
          <span className={cn(row.sign === 'minus' && 'text-secondary')}>
            {formatChargeAmount(row)}
          </span>
        </div>
      );
    case 'empty':
      return <EmptyMessage message={row.message} />;
  }
}

function EmptyMessage({ message }: { message: string }) {
  return <p className="text-sm text-on-surface-variant italic">{message}</p>;
}

function ConversionLines({
  conversion,
  compact = false,
}: {
  conversion: BreakdownConversion;
  compact?: boolean;
}) {
  return formatConversionLines(conversion).map((line, index) => (
    <span
      key={line}
      className={cn(
        index === 0 && (compact ? 'mt-0.5' : 'mt-1'),
        'block text-xs text-on-surface-variant',
      )}
    >
      {line}
    </span>
  ));
}
