import { getPersonColor } from '@shared/utils/personColors';
import { cn } from '@shared/utils/cn';
import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';

export function PeopleStep() {
  const { people, peopleInput, setPeopleInput, addPeopleFromInput, removePerson } = useReceiptStore(
    useShallow((state) => ({
      people: state.people,
      peopleInput: state.peopleInput,
      setPeopleInput: state.setPeopleInput,
      addPeopleFromInput: state.addPeopleFromInput,
      removePerson: state.removePerson,
    })),
  );

  return (
    <div className="space-y-5">
      {/* Header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="font-headline mb-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Who's Splitting?
        </h1>
        <p className="text-lg text-on-surface-variant">Add everyone who's part of this bill.</p>
      </div>

      {/* Header — mobile */}
      <div className="mb-2 md:hidden">
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
          Who's Splitting?
        </h1>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Add everyone who's part of this bill.
        </p>
      </div>

      {/* Input card */}
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
            className="flex-1 rounded-xl border-none bg-surface-container px-4 py-3 text-base text-on-surface outline-none placeholder:text-outline focus:ring-0"
          />
          <button
            type="submit"
            data-testid="people-add-btn"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 py-3 font-bold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
        <p className="mt-2 px-1 text-[10px] font-medium text-on-surface-variant/70">
          Tip: Input multiple names with commas
        </p>
      </div>

      {/* People list or empty state */}
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
        <div data-testid="people-list" className="flex flex-wrap gap-2">
          {people.map((person, index) => {
            const color = getPersonColor(index);
            return (
              <button
                key={person.id}
                type="button"
                data-testid={`person-chip-${person.id}`}
                onClick={() => removePerson(person.id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition hover:opacity-75 active:scale-95',
                  color.lightBg,
                  color.border,
                  color.accent,
                )}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color.avatarBg }}
                />
                {person.name}
                <span className="material-symbols-outlined !text-sm leading-none">close</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status */}
      {people.length > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />
          {people.length} {people.length === 1 ? 'person' : 'people'} added
        </div>
      )}
    </div>
  );
}
