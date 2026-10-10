import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { PROTOTYPE_RECEIPT_NAME } from '@features/ux-prototypes/logic/prototypeReceipt';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { PlateReceipt } from './PlateReceipt';
import { PlateTotals } from './PlateTotals';
import { plateColor } from './platePalette';

export function PlatePrototype() {
  const prototype = usePrototypeSplit();
  const { people, split } = prototype;

  return (
    <div className="min-h-screen bg-plate-cream pb-32 font-prototype-sans text-plate-ink">
      <div className="mx-auto max-w-md px-5 pt-16">
        <p className="font-plate-serif text-lg text-plate-muted italic">split</p>
        <h1 className="mt-1 font-plate-serif text-4xl leading-tight font-semibold">
          {PROTOTYPE_RECEIPT_NAME}
        </h1>
        <p className="mt-2 text-sm text-plate-muted">
          Fri 9 Oct · {people.length} at the table ·{' '}
          {formatCurrencyFromCents(split.grandTotalCents)}
        </p>

        <section aria-label="At the table" className="mt-8 flex justify-between">
          {people.map((person, index) => (
            <div key={person.id} className="flex w-16 flex-col items-center gap-1.5">
              <Avatar
                name={person.name}
                color={plateColor(index)}
                className="h-12 w-12 text-base ring-4 ring-plate-paper"
              />
              <span className="text-xs font-medium">{person.name}</span>
              <span className="font-mono text-[11px] text-plate-muted tabular-nums">
                {formatCurrencyFromCents(split.totalByPersonCents[person.id])}
              </span>
            </div>
          ))}
        </section>

        <PlateReceipt prototype={prototype} />
        <PlateTotals people={people} split={split} />
      </div>

      <PlateShareBar unassignedCount={split.unassignedItemCount} />
    </div>
  );
}

function PlateShareBar({ unassignedCount }: { unassignedCount: number }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-plate-cream via-plate-cream/95 to-transparent px-5 pt-8 pb-5">
      <div className="mx-auto flex max-w-md items-center gap-3">
        {unassignedCount > 0 && (
          <span className="rounded-full bg-plate-accent/10 px-3 py-2 text-xs font-semibold text-plate-accent">
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
    </div>
  );
}
