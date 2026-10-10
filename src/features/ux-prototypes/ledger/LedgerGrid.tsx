import { cn } from '@shared/utils/cn';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import { getPersonColor } from '@shared/utils/personColors';
import type { SplitResult } from '@shared/types';
import type { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { Avatar } from '@features/ux-prototypes/components/Avatar';

type Prototype = ReturnType<typeof usePrototypeSplit>;

function shareCents(split: SplitResult, personId: string, itemId: string): number | null {
  const line = split.lineItemsByPerson[personId].find((row) => row.itemId === itemId);
  return line?.involved ? line.assignedAmountCents : null;
}

export function LedgerGrid({ prototype }: { prototype: Prototype }) {
  const { people, items, assignments, split, toggle, assign } = prototype;

  return (
    <div className="overflow-x-auto rounded-xl border border-ledger-line bg-ledger-panel">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ledger-line text-left text-xs text-ledger-muted">
            <th className="sticky left-0 z-10 bg-ledger-panel px-4 py-3 font-medium">Item</th>
            <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">Price</th>
            {people.map((person, index) => (
              <th key={person.id} className="min-w-16 px-1 py-3 font-medium sm:min-w-20 sm:px-2">
                <span className="flex flex-col items-center gap-1 text-ledger-ink">
                  <Avatar
                    name={person.name}
                    color={getPersonColor(index).avatarBg}
                    className="h-6 w-6 text-[11px]"
                  />
                  {person.name}
                </span>
              </th>
            ))}
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const unassigned = (assignments[item.id] ?? []).length === 0;
            return (
              <tr
                key={item.id}
                className={cn(
                  'group border-b border-ledger-line last:border-0',
                  unassigned && 'bg-ledger-warn-bg',
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 max-w-36 border-l-2 px-4 py-2.5 text-left font-medium sm:max-w-none sm:whitespace-nowrap',
                    unassigned
                      ? 'border-ledger-warn bg-ledger-warn-bg'
                      : 'border-transparent bg-ledger-panel',
                  )}
                >
                  {item.name}
                  <span className="block text-xs font-normal text-ledger-muted tabular-nums sm:hidden">
                    {formatCurrencyFromCents(parseCurrencyToCents(item.amountInput) ?? 0)}
                  </span>
                </th>
                <td className="hidden px-3 text-right text-ledger-muted tabular-nums sm:table-cell">
                  {formatCurrencyFromCents(parseCurrencyToCents(item.amountInput) ?? 0)}
                </td>
                {people.map((person, index) => {
                  const cents = shareCents(split, person.id, item.id);
                  const color = getPersonColor(index);
                  return (
                    <td key={person.id} className="px-1.5 py-1.5 text-center">
                      <button
                        type="button"
                        aria-pressed={cents !== null}
                        aria-label={`${person.name} had ${item.name}`}
                        onClick={() => toggle(item.id, person.id)}
                        className={cn(
                          'h-8 w-full rounded-md text-xs tabular-nums transition-colors',
                          cents === null
                            ? 'text-transparent hover:bg-ledger-line/60 hover:text-ledger-muted'
                            : cn(color.lightBg, 'font-semibold text-ledger-ink'),
                        )}
                      >
                        {cents === null ? '+' : formatCurrencyFromCents(cents)}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      assign(
                        item.id,
                        people.map((person) => person.id),
                      )
                    }
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium text-ledger-muted hover:bg-ledger-line',
                      !unassigned && 'opacity-0 group-hover:opacity-100',
                    )}
                  >
                    All
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-ledger-ink/80 text-xs tabular-nums">
          <FooterRow
            label="Subtotal"
            byPerson={split.subtotalByPersonCents}
            prototype={prototype}
          />
          <FooterRow
            label="Service + GST"
            byPerson={Object.fromEntries(
              people.map((p) => [
                p.id,
                split.serviceByPersonCents[p.id] + split.gstByPersonCents[p.id],
              ]),
            )}
            prototype={prototype}
          />
          <FooterRow
            label="Owes"
            byPerson={split.totalByPersonCents}
            prototype={prototype}
            strong
          />
        </tfoot>
      </table>
    </div>
  );
}

function FooterRow({
  label,
  byPerson,
  prototype,
  strong,
}: {
  label: string;
  byPerson: Record<string, number>;
  prototype: Prototype;
  strong?: boolean;
}) {
  return (
    <tr className={cn(strong ? 'text-sm font-bold' : 'text-ledger-muted')}>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-ledger-panel px-4 py-2 text-left font-medium"
      >
        {label}
      </th>
      <td className="hidden sm:table-cell" />
      {prototype.people.map((person) => (
        <td key={person.id} className="px-1.5 py-2 text-center">
          {formatCurrencyFromCents(byPerson[person.id])}
        </td>
      ))}
      <td />
    </tr>
  );
}
