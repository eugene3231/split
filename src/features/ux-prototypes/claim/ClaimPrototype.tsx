import { useState } from 'react';
import { formatCurrencyFromCents } from '@shared/logic/core/money';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { ClaimItemTile } from './ClaimItemTile';
import { ClaimPeopleRail } from './ClaimPeopleRail';
import { ClaimProgress } from './ClaimProgress';
import { claimColor } from './claimPalette';

export function ClaimPrototype() {
  const prototype = usePrototypeSplit();
  const { people, items, assignments, split, toggle, assign } = prototype;
  const [activeIndex, setActiveIndex] = useState(1);
  const activePerson = people[activeIndex];
  const activeColor = claimColor(activeIndex);
  const claimedCount = items.length - split.unassignedItemCount;
  const nextIndex = (activeIndex + 1) % people.length;

  return (
    <div className="min-h-screen bg-white pb-40 font-prototype-sans text-neutral-900">
      <header
        className="px-5 pt-16 pb-5 transition-colors duration-300"
        style={{ backgroundColor: `${activeColor}14` }}
      >
        <div className="mx-auto max-w-md">
          <ClaimProgress claimed={claimedCount} total={items.length} color={activeColor} />
          <ClaimPeopleRail
            people={people}
            totals={split.totalByPersonCents}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
          <h1 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight">
            What did <span style={{ color: activeColor }}>{activePerson.name}</span> have?
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tap everything they ate or drank. Shared dishes split automatically.
          </p>
        </div>
      </header>

      <ul className="mx-auto mt-4 max-w-md space-y-2.5 px-5">
        {items.map((item) => (
          <ClaimItemTile
            key={item.id}
            item={item}
            people={people}
            assignees={assignments[item.id] ?? []}
            activePersonId={activePerson.id}
            activeColor={activeColor}
            onToggle={() => toggle(item.id, activePerson.id)}
            onShareWithEveryone={() =>
              assign(
                item.id,
                people.map((person) => person.id),
              )
            }
          />
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-neutral-900 p-3 pl-5 text-white shadow-2xl">
          <div className="flex-1">
            <p className="text-xs text-white/60">{activePerson.name} owes</p>
            <p className="text-2xl font-extrabold tabular-nums">
              {formatCurrencyFromCents(split.totalByPersonCents[activePerson.id])}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveIndex(nextIndex)}
            className="flex items-center gap-1 rounded-2xl px-4 py-3 text-sm font-bold"
            style={{ backgroundColor: activeColor }}
          >
            Next: {people[nextIndex].name}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
