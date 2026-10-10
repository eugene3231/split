import { cn } from '@shared/utils/cn';
import { firstName, formatMoney } from '@features/ux-prototypes/logic/prototypeFormat';
import type { PrototypeReceipt } from '@features/ux-prototypes/logic/prototypeReceipt';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { PlateReceipt } from './PlateReceipt';
import { PlateTotals } from './PlateTotals';
import { plateColor } from './platePalette';

export function PlatePrototype({ receipt }: { receipt: PrototypeReceipt }) {
  const prototype = usePrototypeSplit(receipt);
  const { people, split } = prototype;

  return (
    <div className="min-h-screen bg-plate-cream pb-32 font-prototype-sans text-plate-ink lg:pb-16">
      <div className="mx-auto max-w-md px-5 pt-16 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:px-10">
        <div className="min-w-0">
          <p className="font-plate-serif text-lg text-plate-muted italic">split</p>
          <h1 className="mt-1 font-plate-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            {prototype.receiptName}
          </h1>
          <p className="mt-2 text-sm text-plate-muted">
            Fri 9 Oct · {people.length} at the table · {formatMoney(split.grandTotalCents)}
          </p>

          <section
            aria-label="At the table"
            className="-mx-5 mt-8 flex gap-1.5 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-wrap lg:px-0"
          >
            {people.map((person, index) => (
              <div
                key={person.id}
                title={person.name}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <Avatar
                  name={person.name}
                  color={plateColor(index)}
                  className="h-12 w-12 text-base ring-4 ring-plate-paper"
                />
                <span className="w-full truncate text-center text-xs font-medium">
                  {firstName(person.name)}
                </span>
                <span className="font-mono text-[11px] text-plate-muted tabular-nums">
                  {formatMoney(split.totalByPersonCents[person.id])}
                </span>
              </div>
            ))}
          </section>

          <PlateReceipt prototype={prototype} />
        </div>

        <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
          <PlateTotals people={people} split={split} />
          <ShareButton
            unassignedCount={split.unassignedItemCount}
            className="mt-4 hidden lg:flex"
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-plate-cream via-plate-cream/95 to-transparent px-5 pt-8 pb-5 lg:hidden">
        <ShareButton unassignedCount={split.unassignedItemCount} className="mx-auto max-w-md" />
      </div>
    </div>
  );
}

function ShareButton({
  unassignedCount,
  className,
}: {
  unassignedCount: number;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {unassignedCount > 0 && (
        <span className="shrink-0 rounded-full bg-plate-accent/10 px-3 py-2 text-xs font-semibold text-plate-accent">
          {unassignedCount} left to assign
        </span>
      )}
      <button
        type="button"
        disabled={unassignedCount > 0}
        className="flex-1 rounded-full bg-plate-ink py-3.5 text-sm font-semibold text-plate-paper transition-opacity disabled:opacity-40"
      >
        Send everyone their share
      </button>
    </div>
  );
}
