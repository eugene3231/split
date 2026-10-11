import type { ReactNode } from 'react';
import { useOverviewHeader } from './useOverviewHeader';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';
import { personColor } from '@shared/utils/personColors';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import type {
  OverviewChargeRow,
  OverviewItemRow,
  OverviewReceiptSection,
  SummaryOverview,
} from '@shared/types/summaryOverview';

interface Props {
  overview: SummaryOverview;
  actions?: ReactNode;
}

// `features/sharing/logic/overviewTableImage.ts` draws the same table for the PNG export.
export function OverviewTable({ overview, actions }: Props) {
  const { attachStickyHeader, attachScroller, attachTable, onScroll } = useOverviewHeader();
  const { people, sections } = overview;
  const showSectionHeadings = sections.length > 1;

  return (
    <section
      aria-labelledby="overview-heading"
      className="min-w-0 rounded-2xl bg-surface-container-lowest"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-3 sm:px-6">
        <h2 id="overview-heading" className="text-lg font-bold text-on-surface">
          Who had what
        </h2>
        {overview.unassignedItemCount > 0 && (
          <span className="rounded-full bg-warning-container px-2.5 py-1 text-xs font-semibold text-on-warning-container">
            {overview.unassignedItemCount} unassigned
          </span>
        )}
        {actions && <div className="ml-auto max-w-full">{actions}</div>}
      </div>
      {/* Document stickiness and export controls are UI-only; the PNG keeps its static table. */}
      <div
        ref={attachStickyHeader}
        aria-hidden="true"
        className="sticky z-20 overflow-hidden bg-surface-container-lowest text-xs text-on-surface-variant"
        style={{ visibility: 'hidden', height: 0 }}
      >
        <div data-header-people className="flex w-max border-y border-outline-variant/40">
          <div data-header-cell className="shrink-0" />
          {people.map((person, index) => (
            <div
              key={person.id}
              data-header-cell
              className="flex shrink-0 items-center justify-center px-1 py-2 font-medium"
            >
              <PersonIdentity person={person} colorIndex={index} />
            </div>
          ))}
        </div>
        <div
          data-header-item
          className="absolute top-0 left-0 flex items-center border-y border-outline-variant/40 bg-surface-container-lowest px-4 font-medium shadow-[inset_-1px_0_0_var(--color-outline-variant)] sm:px-6"
        >
          Item
        </div>
      </div>
      <div
        ref={attachScroller}
        onScroll={onScroll}
        data-testid="overview-table-scroll"
        className="relative overflow-x-auto"
      >
        <table ref={attachTable} className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-outline-variant/40 text-xs text-on-surface-variant">
              <StickyCell as="th" className="py-2 font-medium">
                Item
              </StickyCell>
              {people.map((person, index) => (
                <PersonHeader key={person.id} person={person} colorIndex={index} />
              ))}
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.id}>
              {showSectionHeadings && (
                <SectionHeading section={section} columnCount={people.length + 1} />
              )}
              {section.itemRows.map((row) => (
                <ItemRow key={row.id} row={row} people={people} />
              ))}
              {section.chargeRows.map((row) => (
                <ChargeRow key={row.kind} row={row} people={people} currency={section.currency} />
              ))}
              {showSectionHeadings && <SectionTotalRow section={section} people={people} />}
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

function PersonHeader({ person, colorIndex }: { person: Person; colorIndex: number }) {
  return (
    <th scope="col" title={person.name} className="px-1 py-2 font-medium">
      <PersonIdentity person={person} colorIndex={colorIndex} />
    </th>
  );
}

function PersonIdentity({ person, colorIndex }: { person: Person; colorIndex: number }) {
  return (
    <span className="flex flex-col items-center gap-1 text-on-surface">
      <PersonAvatar name={person.name} colorIndex={colorIndex} size="sm" />
      <span className="block max-w-16 truncate">{person.name.trim().split(/\s+/)[0]}</span>
    </span>
  );
}

function SectionHeading({
  section,
  columnCount,
}: {
  section: OverviewReceiptSection;
  columnCount: number;
}) {
  return (
    <tr className="bg-surface-container-low">
      <th scope="rowgroup" colSpan={columnCount} className="p-0 text-left">
        <span className="sticky left-0 inline-block px-4 py-2 text-xs font-bold tracking-widest text-on-surface-variant uppercase sm:px-6">
          {section.title}
        </span>
      </th>
    </tr>
  );
}

function ItemRow({ row, people }: { row: OverviewItemRow; people: Person[] }) {
  return (
    <tr
      className={cn('border-b border-outline-variant/30', row.unassigned && 'bg-warning-container')}
    >
      <StickyCell
        as="th"
        scope="row"
        className={cn(
          'border-l-2 py-2.5 font-medium text-on-surface',
          row.unassigned ? 'border-warning bg-warning-container' : 'border-transparent',
        )}
      >
        <span className="line-clamp-2 sm:line-clamp-none">{row.name}</span>
        <span
          className={cn(
            'block text-xs font-normal tabular-nums',
            row.unassigned ? 'text-on-warning-container' : 'text-on-surface-variant',
          )}
        >
          {formatCurrencyFromCents(row.priceCents, row.currency)}
          {row.unassigned && ' · nobody yet'}
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
  currency: string;
  colorIndex: number;
  label: string;
}

function ShareCell({ cents, currency, colorIndex, label }: ShareCellProps) {
  if (cents === undefined) return <td />;
  const amount = formatCurrencyFromCents(cents, currency);
  const color = personColor(colorIndex);
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

function ChargeRow({
  row,
  people,
  currency,
}: {
  row: OverviewChargeRow;
  people: Person[];
  currency: string;
}) {
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

function SectionTotalRow({
  section,
  people,
}: {
  section: OverviewReceiptSection;
  people: Person[];
}) {
  return (
    <tr className="border-b border-outline-variant/30 font-semibold text-on-surface tabular-nums">
      <StickyCell as="th" scope="row" className="py-2.5 text-xs">
        {section.title} total
        <span className="block font-medium text-on-surface-variant">
          {formatCurrencyFromCents(section.totalCents, section.currency)}
        </span>
      </StickyCell>
      {people.map((person) => (
        <AmountCell
          key={person.id}
          cents={section.totalByPersonCents[person.id] ?? 0}
          currency={section.currency}
        />
      ))}
    </tr>
  );
}

function AmountCell({ cents, currency }: { cents: number; currency: string }) {
  return (
    <td className="px-1 py-2.5 text-center text-xs whitespace-nowrap">
      {formatCurrencyFromCents(cents, currency)}
    </td>
  );
}
