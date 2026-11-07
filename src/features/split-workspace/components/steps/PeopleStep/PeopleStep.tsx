import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { usePersonRemoval } from '@features/split-workspace/hooks/usePersonRemoval';
import { cn } from '@shared/utils/cn';
import { SavedGroups } from './SavedGroups';
import { SaveGroupForm } from './SaveGroupForm';

export function PeopleStep() {
  const { people, addPeople, removePerson, removeAllPeople } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      addPeople: state.addPeople,
      removePerson: state.removePerson,
      removeAllPeople: state.removeAllPeople,
    })),
  );
  const [peopleInput, setPeopleInput] = useState('');
  const { leavingIds, startRemoval, finishRemoval } = usePersonRemoval(removePerson);

  const addTypedPeople = () => {
    const names = peopleInput.split(/[\n,]+/).filter((name) => name.trim().length > 0);
    if (names.length === 0) return;
    addPeople(names);
    setPeopleInput('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepHeader
        title="Who's splitting the bill?"
        description="Add everyone sharing the bill."
        className="mb-6 md:mb-8"
      />

      <div className="surface-card p-4 md:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addTypedPeople();
          }}
          className="flex items-center gap-2 field p-1.5 pl-4"
        >
          <input
            id="new-people-input"
            data-testid="people-input"
            value={peopleInput}
            onChange={(e) => setPeopleInput(e.target.value)}
            placeholder="Names, e.g. Alice, Bob"
            className="min-w-0 flex-1 border-none bg-transparent py-2 text-base text-on-surface outline-none placeholder:text-outline focus:ring-0"
          />
          <button
            type="submit"
            data-testid="people-add-btn"
            className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
        <p className="mt-2 px-1 text-xs text-on-surface-variant">
          Separate names with commas to add several at once.
        </p>
      </div>

      <SavedGroups />

      {people.length === 0 ? (
        <div
          data-testid="people-empty-state"
          className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-outline-variant py-8 text-center"
        >
          <span className="material-symbols-outlined mb-1 text-2xl text-outline">group</span>
          <p className="text-sm font-semibold text-on-surface">No one added yet</p>
          <p className="text-sm text-on-surface-variant">
            Everyone you add here can be given items on the receipt.
          </p>
        </div>
      ) : (
        <section aria-label="People in this split" className="space-y-3">
          <div className="flex flex-wrap items-center gap-y-1">
            <h2 className="basis-full section-label sm:mr-3 sm:basis-auto">
              People in this split{' '}
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1.5 align-[1px] text-xs font-semibold text-on-surface-variant tabular-nums">
                {people.length}
              </span>
            </h2>
            <div className="-mx-3 -my-1.5 flex flex-1 flex-wrap items-center sm:my-0 sm:-mr-3 sm:ml-0">
              <SaveGroupForm />
              <button
                type="button"
                onClick={removeAllPeople}
                className="ml-auto min-h-11 rounded-xl px-3 text-sm font-medium text-outline transition-colors hover:bg-error-container/60 hover:text-error"
              >
                Remove all
              </button>
            </div>
          </div>
          <div data-testid="people-list" className="flex flex-wrap gap-2">
            {people.map((person, index) => (
              <button
                key={person.id}
                type="button"
                data-testid={`person-chip-${person.id}`}
                disabled={leavingIds.includes(person.id)}
                onClick={() => startRemoval(person.id)}
                onAnimationEnd={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    event.animationName === 'shrink-out'
                  ) {
                    finishRemoval(person.id);
                  }
                }}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full border border-surface-container-highest bg-surface-container-lowest pr-3 pl-1.5 text-sm font-semibold text-on-surface transition hover:border-outline-variant active:scale-95',
                  leavingIds.includes(person.id)
                    ? 'motion-safe:animate-shrink-out'
                    : 'motion-safe:animate-person-in',
                )}
              >
                <PersonAvatar name={person.name} colorIndex={index} className="h-7 w-7 text-xs" />
                {person.name}
                <span className="material-symbols-outlined !text-sm leading-none text-on-surface-variant">
                  close
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
