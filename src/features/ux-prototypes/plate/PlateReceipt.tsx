import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import { formatCurrencyFromCents, parseCurrencyToCents } from '@shared/logic/core/money';
import type { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { plateColor } from './platePalette';

type Prototype = ReturnType<typeof usePrototypeSplit>;

const ZIGZAG =
  'bg-[linear-gradient(135deg,var(--color-plate-paper)_33%,transparent_33%),linear-gradient(225deg,var(--color-plate-paper)_33%,transparent_33%)] bg-[length:14px_14px]';

export function PlateReceipt({ prototype }: { prototype: Prototype }) {
  const { items, people, assignments, split } = prototype;
  const [openItemId, setOpenItemId] = useState<string | null>('ckt');

  return (
    <section aria-label="Receipt" className="mt-8 drop-shadow-[0_10px_24px_rgba(60,40,10,0.10)]">
      <div className={cn('h-3.5 rotate-180', ZIGZAG)} />
      <div className="bg-plate-paper px-5 pt-3 pb-5">
        <p className="text-center text-[11px] tracking-[0.3em] text-plate-muted uppercase">
          Tap a line to say who had it
        </p>
        <ul className="mt-4 divide-y divide-dashed divide-plate-line">
          {items.map((item) => {
            const assignees = assignments[item.id] ?? [];
            const isOpen = openItemId === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenItemId(isOpen ? null : item.id)}
                  className="flex w-full items-baseline gap-2 py-3 text-left"
                >
                  <span className="text-[15px]">{item.name}</span>
                  <span className="mb-1 flex-1 border-b border-dotted border-plate-line" />
                  <span className="font-mono text-sm tabular-nums">
                    {formatCurrencyFromCents(parseCurrencyToCents(item.amountInput) ?? 0)}
                  </span>
                </button>
                <div className="-mt-1 flex min-h-5 items-center pb-3">
                  {assignees.length === 0 ? (
                    <span className="text-xs font-semibold text-plate-accent">
                      Nobody yet, tap to assign
                    </span>
                  ) : (
                    <span className="flex -space-x-1.5">
                      {assignees.map((personId) => {
                        const index = people.findIndex((person) => person.id === personId);
                        return (
                          <Avatar
                            key={personId}
                            name={people[index].name}
                            color={plateColor(index)}
                            className="h-5 w-5 text-[10px] ring-2 ring-plate-paper"
                          />
                        );
                      })}
                    </span>
                  )}
                </div>
                {isOpen && (
                  <PlateAssigneePicker
                    itemId={item.id}
                    assignees={assignees}
                    prototype={prototype}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t-2 border-plate-ink pt-3 font-mono text-sm tabular-nums">
          <ReceiptLine label="Subtotal" cents={split.subtotalCents} />
          <ReceiptLine label="Service 10%" cents={split.serviceChargeCents} />
          <ReceiptLine label="GST 9%" cents={split.gstCents} />
          <ReceiptLine label="Total" cents={split.grandTotalCents} strong />
        </dl>
      </div>
      <div className={cn('h-3.5', ZIGZAG)} />
    </section>
  );
}

function ReceiptLine({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between', strong && 'pt-1 text-base font-bold')}>
      <dt>{label}</dt>
      <dd>{formatCurrencyFromCents(cents)}</dd>
    </div>
  );
}

function PlateAssigneePicker({
  itemId,
  assignees,
  prototype,
}: {
  itemId: string;
  assignees: string[];
  prototype: Prototype;
}) {
  const { people, toggle, assign } = prototype;
  return (
    <div className="mb-3 rounded-2xl bg-plate-cream p-3">
      <div className="flex justify-between">
        {people.map((person, index) => {
          const selected = assignees.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(itemId, person.id)}
              className="flex flex-col items-center gap-1"
            >
              <Avatar
                name={person.name}
                color={plateColor(index)}
                className={cn(
                  'h-11 w-11 text-sm transition-all',
                  selected
                    ? 'scale-100 ring-2 ring-plate-ink ring-offset-2'
                    : 'scale-90 opacity-35',
                )}
              />
              <span className="text-[11px]">{person.name}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() =>
            assign(
              itemId,
              people.map((person) => person.id),
            )
          }
          className="flex-1 rounded-full border border-plate-ink/15 py-2"
        >
          Everyone shared
        </button>
        <button
          type="button"
          onClick={() => assign(itemId, [])}
          className="flex-1 rounded-full border border-plate-ink/15 py-2 text-plate-muted"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
