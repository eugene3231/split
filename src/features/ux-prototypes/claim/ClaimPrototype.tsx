import { useState } from 'react';
import { firstName } from '@features/ux-prototypes/logic/prototypeFormat';
import type { PrototypeReceipt } from '@features/ux-prototypes/logic/prototypeReceipt';
import { Avatar } from '@features/ux-prototypes/components/Avatar';
import { usePrototypeSplit } from '@features/ux-prototypes/hooks/usePrototypeSplit';
import { ClaimItemTile } from './ClaimItemTile';
import { ClaimPeopleRail } from './ClaimPeopleRail';
import { ClaimProgress } from './ClaimProgress';
import { ClaimTally } from './ClaimTally';
import { personColor } from '@features/ux-prototypes/logic/personPalette';

export function ClaimPrototype({ receipt }: { receipt: PrototypeReceipt }) {
  const { people, items, assignments, split, toggle, assign } = usePrototypeSplit(receipt);
  const [activeIndex, setActiveIndex] = useState(0);
  const activePerson = people[activeIndex];
  const activeName = firstName(activePerson.name);
  const claimedCount = items.length - split.unassignedItemCount;
  const nextIndex = (activeIndex + 1) % people.length;

  return (
    <div className="min-h-screen bg-white pb-32 font-prototype-sans text-neutral-900 lg:pb-16">
      <header className="bg-surface-container-low px-5 pt-16 pb-5">
        <div className="mx-auto max-w-md lg:max-w-5xl">
          <ClaimProgress claimed={claimedCount} total={items.length} />
          <ClaimPeopleRail
            people={people}
            totals={split.totalByPersonCents}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            className="-mx-5 mt-5 overflow-x-auto px-5 pb-1 lg:hidden"
          />
          <h1 className="mt-6 text-3xl leading-tight font-extrabold tracking-tight break-words">
            What did{' '}
            <Avatar
              name={activePerson.name}
              color={personColor(activeIndex)}
              className="h-8 w-8 -translate-y-0.5 align-middle text-base"
            />{' '}
            {activeName} have?
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tap everything they ate or drank. Shared dishes split automatically.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <ClaimItemTile
              key={item.id}
              item={item}
              people={people}
              assignees={assignments[item.id] ?? []}
              activePersonId={activePerson.id}
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

        <aside className="hidden lg:sticky lg:top-6 lg:mt-4 lg:block lg:self-start">
          <ClaimTally
            name={activeName}
            totalCents={split.totalByPersonCents[activePerson.id]}
            nextName={firstName(people[nextIndex].name)}
            onNext={() => setActiveIndex(nextIndex)}
            className="mb-4"
          />
          <ClaimPeopleRail
            people={people}
            totals={split.totalByPersonCents}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            className="max-h-[55vh] flex-col overflow-y-auto p-1 [&>button]:w-full"
          />
        </aside>
      </div>

      <ClaimTally
        name={activeName}
        totalCents={split.totalByPersonCents[activePerson.id]}
        nextName={firstName(people[nextIndex].name)}
        onNext={() => setActiveIndex(nextIndex)}
        className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md lg:hidden"
      />
    </div>
  );
}
