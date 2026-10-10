import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import type { Person, SplitResult } from '@shared/types';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { plateColor } from './platePalette';

interface Props {
  people: Person[];
  split: SplitResult;
}

export function PlateTotals({ people, split }: Props) {
  const assignedCents = people.reduce((sum, p) => sum + split.totalByPersonCents[p.id], 0);

  return (
    <section aria-label="Who owes what" className="mt-10">
      <div className="rounded-3xl bg-plate-ink p-6 text-plate-paper">
        <p className="text-xs tracking-[0.25em] text-plate-paper/60 uppercase">Owed to Eugene</p>
        <p className="mt-1 font-plate-serif text-5xl font-semibold tabular-nums">
          {formatCurrencyFromCents(assignedCents - split.totalByPersonCents.eugene)}
        </p>
        <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-plate-paper/10">
          {people.map((person, index) => (
            <span
              key={person.id}
              className="h-full"
              style={{
                width: `${(split.totalByPersonCents[person.id] / split.grandTotalCents) * 100}%`,
                backgroundColor: plateColor(index),
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-plate-paper/60">
          Bar shows each share of the {formatCurrencyFromCents(split.grandTotalCents)} bill
          {split.unassignedItemCount > 0 && '; the gap is what nobody has claimed yet'}
        </p>
      </div>

      <ul className="mt-4 space-y-2.5">
        {people.map((person, index) => (
          <PlatePersonRow key={person.id} person={person} color={plateColor(index)} split={split} />
        ))}
      </ul>
    </section>
  );
}

function PlatePersonRow({
  person,
  color,
  split,
}: {
  person: Person;
  color: string;
  split: SplitResult;
}) {
  const [expanded, setExpanded] = useState(person.id === 'mei');
  const lines = split.lineItemsByPerson[person.id].filter((line) => line.involved);

  return (
    <li className="rounded-2xl bg-plate-paper">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <Avatar name={person.name} color={color} className="h-9 w-9 text-sm" />
        <span className="flex-1">
          <span className="block font-semibold">{person.name}</span>
          <span className="block text-xs text-plate-muted">
            {lines.length} {lines.length === 1 ? 'dish' : 'dishes'}
          </span>
        </span>
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrencyFromCents(split.totalByPersonCents[person.id])}
        </span>
        <span
          className={cn(
            'material-symbols-outlined text-plate-muted transition-transform',
            expanded && 'rotate-180',
          )}
        >
          expand_more
        </span>
      </button>
      {expanded && (
        <dl className="space-y-1 border-t border-dashed border-plate-line px-4 py-3 text-sm">
          {lines.map((line) => (
            <div key={line.itemId} className="flex justify-between">
              <dt>
                {line.name}
                {line.splitCount > 1 && (
                  <span className="text-plate-muted"> · split {line.splitCount} ways</span>
                )}
              </dt>
              <dd className="font-mono tabular-nums">
                {formatCurrencyFromCents(line.assignedAmountCents)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between text-plate-muted">
            <dt>Service + GST</dt>
            <dd className="font-mono tabular-nums">
              {formatCurrencyFromCents(
                split.serviceByPersonCents[person.id] + split.gstByPersonCents[person.id],
              )}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}
