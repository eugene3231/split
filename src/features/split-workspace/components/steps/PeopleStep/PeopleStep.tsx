import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { StepHeader } from '@features/split-workspace/components/shared/StepHeader';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';
import { SavedGroups } from './SavedGroups';
import { SaveGroupForm } from './SaveGroupForm';

export function PeopleStep() {
  const { people, peopleInput, setPeopleInput, addPeopleFromInput, removePerson, removeAllPeople } =
    useReceiptStore(
      useShallow((state) => ({
        people: state.people,
        peopleInput: state.peopleInput,
        setPeopleInput: state.setPeopleInput,
        addPeopleFromInput: state.addPeopleFromInput,
        removePerson: state.removePerson,
        removeAllPeople: state.removeAllPeople,
      })),
    );

  return (
    <div className="space-y-5">
      <StepHeader
        title="Who's Splitting?"
        description="Add everyone who's part of this bill."
        className="mb-6"
      />

      <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-[0_8px_24px_rgba(25,28,29,0.06)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addPeopleFromInput(peopleInput);
          }}
          className="flex gap-3"
        >
          <input
            id="new-people-input"
            data-testid="people-input"
            value={peopleInput}
            onChange={(e) => setPeopleInput(e.target.value)}
            placeholder="Names, e.g. Alice, Bob"
            className="min-w-0 flex-1 rounded-xl border-none bg-surface-container px-4 py-3 text-base text-on-surface outline-none placeholder:text-outline focus:ring-0"
          />
          <button
            type="submit"
            data-testid="people-add-btn"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
        <p className="mt-2 px-1 text-xs font-medium text-on-surface-variant/70">
          Tip: Input multiple names with commas
        </p>
      </div>

      <SavedGroups />

      {people.length === 0 ? (
        <div
          data-testid="people-empty-state"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant/30 py-14 text-center"
        >
          <span className="material-symbols-outlined text-3xl text-outline">group</span>
          <p className="text-sm font-semibold text-on-surface-variant">No one added yet.</p>
          <p className="text-sm text-outline">Type names above to get started.</p>
        </div>
      ) : (
        <section aria-label="People in this split" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface-variant">
              People in this split <span className="ml-1 text-outline">{people.length}</span>
            </h2>
            <button
              type="button"
              onClick={removeAllPeople}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              Remove all
            </button>
          </div>
          <div data-testid="people-list" className="flex flex-wrap gap-2">
            {people.map((person, index) => (
              <button
                key={person.id}
                type="button"
                data-testid={`person-chip-${person.id}`}
                onClick={() => removePerson(person.id)}
                className="flex items-center gap-2 rounded-full border border-surface-container-highest bg-surface-container-lowest py-1 pr-2.5 pl-1 text-sm font-semibold text-on-surface transition hover:border-outline-variant active:scale-95"
              >
                <PersonAvatar name={person.name} colorIndex={index} size="sm" />
                {person.name}
                <span className="material-symbols-outlined !text-sm leading-none text-on-surface-variant">
                  close
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end">
            <SaveGroupForm />
          </div>
        </section>
      )}
    </div>
  );
}
