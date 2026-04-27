import { useShallow } from 'zustand/shallow';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { PersonAvatar } from '@features/split-workspace/components/shared/PersonAvatar';

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
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      {/* Headline */}
      <div>
        <h1 className="font-display text-4xl leading-tight font-medium tracking-tight text-ink sm:text-5xl md:text-6xl">
          Who's <span className="font-display italic">eating?</span>
        </h1>
        <p className="mt-2 text-base text-ink2">Add everyone at the table. We'll do the math.</p>
      </div>

      {/* Input card */}
      <div className="flex items-center gap-3 rounded-[24px] bg-cream py-2 pr-2 pl-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addPeopleFromInput(peopleInput);
          }}
          className="flex flex-1 items-center gap-3"
        >
          <input
            id="new-people-input"
            data-testid="people-input"
            value={peopleInput}
            onChange={(e) => setPeopleInput(e.target.value)}
            placeholder="Type a name…"
            className="flex-1 border-none bg-transparent py-3 text-base text-ink outline-none placeholder:text-ink2/50 focus:ring-0"
          />
          <button
            type="submit"
            data-testid="people-add-btn"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </button>
        </form>
      </div>
      <p className="mt-1 px-1 text-[11px] text-ink2/60">
        Comma-separated works too — "Alice, Bob, Charlie"
      </p>

      {/* People list or empty state */}
      {people.length === 0 ? (
        <div
          data-testid="people-empty-state"
          className="flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-cream-dim py-14 text-center"
        >
          <span className="material-symbols-outlined text-3xl text-ink2/40">group</span>
          <p className="text-sm font-medium text-ink2">No one added yet.</p>
        </div>
      ) : (
        <div data-testid="people-list">
          <p className="mb-3 text-xs font-semibold tracking-widest text-ink2 uppercase">
            Party of {people.length} →
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {people.map((person, index) => {
              return (
                <button
                  key={person.id}
                  type="button"
                  data-testid={`person-chip-${person.id}`}
                  onClick={() => removePerson(person.id)}
                  className="relative flex flex-col gap-3 rounded-[20px] bg-cream p-4 text-left transition-colors hover:bg-cream-dim active:scale-95"
                >
                  <PersonAvatar name={person.name} colorIndex={index} size="md" />
                  <span className="font-display text-lg leading-tight font-medium text-ink">
                    {person.name}
                  </span>
                  <span
                    className="absolute top-3 right-3 text-lg leading-none text-ink2/40"
                    aria-hidden
                  >
                    ×
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
