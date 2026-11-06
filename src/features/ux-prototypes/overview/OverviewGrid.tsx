import { cn } from '@shared/utils/cn';
import { parseCurrencyToCents } from '@shared/logic/core/money';
import type { Person, SplitResult } from '@shared/types';
import { firstName, formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import { personColor } from '@features/ux-prototypes/logic/personPalette';
import type {
  PrototypeAssignments,
  PrototypeItem,
} from '@features/ux-prototypes/logic/prototypeReceipt';
import { Avatar } from '@features/ux-prototypes/components/Avatar';

interface Props {
  people: Person[];
  items: PrototypeItem[];
  assignments: PrototypeAssignments;
  split: SplitResult;
  className?: string;
}

function shareCents(split: SplitResult, personId: string, itemId: string): number | null {
  const line = split.lineItemsByPerson[personId].find((row) => row.itemId === itemId);
  return line?.involved ? line.assignedAmountCents : null;
}

export function OverviewGrid({ people, items, assignments, split, className }: Props) {
  return (
    <section
      aria-label="Who had what"
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-overview-line bg-overview-panel',
        className,
      )}
    >
      <h2 className="px-4 pt-4 text-sm font-semibold">Who had what</h2>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-overview-line text-xs text-overview-muted">
              <th className="sticky left-0 z-10 bg-overview-panel px-4 py-2 text-left font-medium">
                Item
              </th>
              {people.map((person, index) => (
                <th key={person.id} title={person.name} className="px-0.5 py-2 font-medium sm:px-1">
                  <span className="flex flex-col items-center gap-1 text-overview-ink">
                    <Avatar
                      name={person.name}
                      color={personColor(index)}
                      className="h-6 w-6 text-[11px]"
                    />
                    <span className="hidden max-w-16 truncate sm:block">
                      {firstName(person.name)}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const unassigned = (assignments[item.id] ?? []).length === 0;
              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-overview-line last:border-0',
                    unassigned && 'bg-overview-warn-bg',
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      'sticky left-0 z-10 w-36 min-w-36 border-l-2 px-4 py-2.5 text-left font-medium sm:w-64 sm:min-w-64',
                      unassigned
                        ? 'border-overview-warn bg-overview-warn-bg'
                        : 'border-transparent bg-overview-panel',
                    )}
                  >
                    <span className="line-clamp-2 sm:line-clamp-none">{item.name}</span>
                    <span className="block text-xs font-normal text-overview-muted tabular-nums">
                      {formatMoney(parseCurrencyToCents(item.amountInput) ?? 0)}
                      {unassigned && ' · nobody yet'}
                    </span>
                  </th>
                  {people.map((person, index) => (
                    <ShareCell
                      key={person.id}
                      cents={shareCents(split, person.id, item.id)}
                      color={personColor(index)}
                      label={`${person.name}, ${item.name}`}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="hidden border-t-2 border-overview-ink/80 text-xs tabular-nums sm:table-footer-group">
            <tr className="text-sm font-bold">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-overview-panel px-4 py-2.5 text-left font-medium"
              >
                Owes
              </th>
              {people.map((person) => (
                <td key={person.id} className="px-1 py-2.5 text-center">
                  {formatMoney(split.totalByPersonCents[person.id])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function ShareCell({
  cents,
  color,
  label,
}: {
  cents: number | null;
  color: string;
  label: string;
}) {
  if (cents === null) return <td aria-label={`${label}: no`} />;
  return (
    <td className="px-0.5 py-1.5 text-center sm:px-1" title={`${label}: ${formatMoney(cents)}`}>
      <span
        aria-hidden
        className="mx-auto block h-2.5 w-2.5 rounded-full sm:hidden"
        style={{ backgroundColor: color }}
      />
      <span
        className="hidden rounded-md px-1.5 py-1.5 text-xs font-semibold tabular-nums sm:block"
        style={{ backgroundColor: `${color}1f` }}
      >
        {formatMoney(cents)}
      </span>
    </td>
  );
}
