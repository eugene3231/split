import { useRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';
import { personColor } from '@shared/utils/personColors';
import { usePinnedSectionTitle } from './usePinnedSectionTitle';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import type {
  OverviewChargeRow,
  OverviewHeadingRow,
  OverviewItemRow,
  OverviewRow,
  OverviewSectionTotalRow,
  SummaryOverview,
} from '@features/split-workspace/summary/overview/types';
import type { CurrencyCode } from '@shared/constants';

interface Props {
  overview: SummaryOverview;
}

// Both the pinned header and the table lay columns out from these, so they line up without
// measuring: the Item column is fixed and the people share the rest, never below a minimum.
const ITEM_COLUMN = 'w-32 sm:w-56';
const TABLE_WIDTH =
  'w-full min-w-[calc(8rem+var(--people)*5rem)] sm:min-w-[calc(14rem+var(--people)*6.5rem)]';

// `overviewImage.ts`, beside this file, draws the same table for the PNG export.
export function OverviewTable({ overview }: Props) {
  const { people, sections } = overview;
  const headerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const pinnedSectionTitle = usePinnedSectionTitle(tableRef, headerRef);

  return (
    <section
      aria-labelledby="overview-heading"
      className="min-w-0 overflow-clip rounded-2xl bg-surface-container-lowest"
      style={{ '--people': people.length } as CSSProperties}
    >
      <h2
        id="overview-heading"
        className="px-4 pt-5 pb-3 text-lg font-bold text-on-surface sm:px-6"
      >
        Who had what
      </h2>
      {/* The people row, and the receipt being scrolled through, pin under the app bar while the
          page scrolls. They sit outside the table because a sticky row can't escape the table's
          sideways scroll box, so the people row follows that box's scroll instead.
          React only: the PNG shows the whole table at once. */}
      <div aria-hidden="true" className="sticky top-(--app-bar-height) z-20">
        <div
          ref={headerRef}
          data-testid="overview-pinned-people"
          className="overflow-hidden border-y border-outline-variant/40 bg-surface-container-lowest text-xs text-on-surface-variant"
        >
          <div className={cn('flex', TABLE_WIDTH)}>
            <div
              className={cn(
                ITEM_COLUMN,
                'sticky left-0 flex shrink-0 items-center bg-surface-container-lowest px-4 font-medium shadow-[inset_-1px_0_0_var(--color-outline-variant)] sm:px-6 sm:shadow-none',
              )}
            >
              Item
            </div>
            {people.map((person, index) => (
              <div
                key={person.id}
                title={person.name}
                className="flex min-w-0 flex-1 basis-0 justify-center px-1 py-2 font-medium last:pr-3 sm:last:pr-5"
              >
                <PersonIdentity person={person} colorIndex={index} />
              </div>
            ))}
          </div>
        </div>
        {pinnedSectionTitle && (
          <SectionTitle className="absolute inset-x-0 top-full border-b border-outline-variant/40 bg-surface-container-low">
            {pinnedSectionTitle}
          </SectionTitle>
        )}
      </div>
      <div
        data-testid="overview-table-scroll"
        className="relative overflow-x-auto"
        onScroll={(event) => {
          if (headerRef.current) headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <table ref={tableRef} className={cn('table-fixed border-collapse text-sm', TABLE_WIDTH)}>
          <colgroup>
            <col className={ITEM_COLUMN} />
            {people.map((person) => (
              <col key={person.id} />
            ))}
          </colgroup>
          <thead className="sr-only">
            <tr>
              <th scope="col">Item</th>
              {people.map((person) => (
                <th key={person.id} scope="col">
                  {person.name}
                </th>
              ))}
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.id}>
              {section.rows.map((row) => (
                <Row key={rowKey(row)} row={row} people={people} />
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-on-surface/80 font-bold text-on-surface tabular-nums">
              <StickyCell as="th" scope="row" className="py-3">
                <span className="block">Owes</span>
                <span className="block text-xs font-medium text-on-surface-variant">
                  of {formatCurrencyFromCents(overview.totalCents, overview.currency)}
                </span>
              </StickyCell>
              {people.map((person) => (
                <AmountCell
                  key={person.id}
                  cents={overview.totalByPersonCents[person.id] ?? 0}
                  currency={overview.currency}
                />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

interface StickyCellProps {
  as: 'th' | 'td';
  scope?: 'row' | 'col';
  className?: string;
  children: ReactNode;
}

function StickyCell({ as: Cell, scope, className, children }: StickyCellProps) {
  return (
    <Cell
      scope={scope}
      className={cn(
        'sticky left-0 z-10 w-32 min-w-32 bg-surface-container-lowest px-4 text-left shadow-[inset_-1px_0_0_var(--color-outline-variant)] sm:w-56 sm:min-w-56 sm:px-6 sm:shadow-none',
        className,
      )}
    >
      {children}
    </Cell>
  );
}

function PersonIdentity({ person, colorIndex }: { person: Person; colorIndex: number }) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-1 text-on-surface">
      <PersonAvatar name={person.name} colorIndex={colorIndex} size="sm" />
      <span className="block max-w-full truncate">{person.name.trim().split(/\s+/)[0]}</span>
    </span>
  );
}

function rowKey(row: OverviewRow): string {
  switch (row.kind) {
    case 'item':
      return row.id;
    case 'charge':
      return row.charge;
    case 'heading':
    case 'sectionTotal':
      return row.kind;
  }
}

function Row({ row, people }: { row: OverviewRow; people: Person[] }): ReactElement {
  switch (row.kind) {
    case 'heading':
      return <SectionHeading row={row} columnCount={people.length + 1} />;
    case 'item':
      return <ItemRow row={row} people={people} />;
    case 'charge':
      return <ChargeRow row={row} people={people} />;
    case 'sectionTotal':
      return <SectionTotalRow row={row} people={people} />;
  }
}

function SectionHeading({ row, columnCount }: { row: OverviewHeadingRow; columnCount: number }) {
  return (
    <tr data-section-title={row.title} className="bg-surface-container-low">
      <th scope="rowgroup" colSpan={columnCount} className="p-0 text-left">
        <SectionTitle className="sticky left-0 inline-block">{row.title}</SectionTitle>
      </th>
    </tr>
  );
}

function SectionTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'px-4 py-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase sm:px-6',
        className,
      )}
    >
      {children}
    </span>
  );
}

function ItemRow({ row, people }: { row: OverviewItemRow; people: Person[] }) {
  return (
    <tr className="border-b border-outline-variant/30">
      <StickyCell
        as="th"
        scope="row"
        className="border-l-2 border-transparent py-2.5 font-medium text-on-surface"
      >
        {/* React only: a long name is clamped on a phone; the PNG cuts it to one line. */}
        <span className="line-clamp-2 sm:line-clamp-none">{row.name}</span>
        <span className="block text-xs font-normal text-on-surface-variant tabular-nums">
          {formatCurrencyFromCents(row.priceCents, row.currency)}
        </span>
      </StickyCell>
      {people.map((person, index) => (
        <ShareCell
          key={person.id}
          cents={row.sharesByPerson[person.id]}
          currency={row.currency}
          colorIndex={index}
          label={`${person.name}, ${row.name}`}
        />
      ))}
    </tr>
  );
}

interface ShareCellProps {
  cents: number | undefined;
  currency: CurrencyCode;
  colorIndex: number;
  label: string;
}

function ShareCell({ cents, currency, colorIndex, label }: ShareCellProps) {
  if (cents === undefined) return <td />;
  const amount = formatCurrencyFromCents(cents, currency);
  const color = personColor(colorIndex);
  // React only: a phone shows a dot in the person's colour and keeps the amount for screen
  // readers. The PNG always has room for the amount.
  return (
    <td className="px-1 py-1.5 text-center last:pr-3 sm:last:pr-5" title={`${label}: ${amount}`}>
      <span
        aria-hidden
        className="mx-auto block h-2.5 w-2.5 rounded-full sm:hidden"
        style={{ backgroundColor: color }}
      />
      <span
        className="sr-only text-xs font-semibold text-on-surface tabular-nums sm:not-sr-only sm:inline-block sm:min-w-14 sm:rounded-md sm:px-2 sm:py-1.5"
        // A 12% tint of the person's colour; Tailwind can't build it from a runtime hex.
        style={{ backgroundColor: `${color}1f` }}
      >
        {amount}
      </span>
    </td>
  );
}

function ChargeRow({ row, people }: { row: OverviewChargeRow; people: Person[] }) {
  const { currency } = row;
  const sign = row.sign === 'minus' ? '−' : '';
  return (
    <tr className="border-b border-outline-variant/30 text-on-surface-variant italic">
      <StickyCell as="th" scope="row" className="py-2 font-normal">
        <span className="block text-xs sm:text-sm">{row.label}</span>
        <span className="block text-xs tabular-nums">
          {sign}
          {formatCurrencyFromCents(row.totalCents, currency)}
        </span>
      </StickyCell>
      {people.map((person) => {
        const cents = row.sharesByPerson[person.id];
        return (
          <td
            key={person.id}
            className="px-1 py-2 text-center text-[11px] whitespace-nowrap tabular-nums sm:text-xs"
          >
            {cents !== undefined && `${sign}${formatCurrencyFromCents(cents, currency)}`}
          </td>
        );
      })}
    </tr>
  );
}

function SectionTotalRow({ row, people }: { row: OverviewSectionTotalRow; people: Person[] }) {
  return (
    <tr className="border-b border-outline-variant/30 font-semibold text-on-surface tabular-nums">
      <StickyCell as="th" scope="row" className="py-2.5 text-xs">
        {row.label}
        <span className="block font-medium text-on-surface-variant">
          {formatCurrencyFromCents(row.totalCents, row.currency)}
        </span>
      </StickyCell>
      {people.map((person) => (
        <AmountCell
          key={person.id}
          cents={row.totalByPersonCents[person.id] ?? 0}
          currency={row.currency}
        />
      ))}
    </tr>
  );
}

function AmountCell({ cents, currency }: { cents: number; currency: CurrencyCode }) {
  return (
    <td className="px-1 py-2.5 text-center text-xs whitespace-nowrap">
      {formatCurrencyFromCents(cents, currency)}
    </td>
  );
}
