import { getPersonColor } from '@shared/utils/personColors';
import type { Person } from '@shared/types';
import { cn } from '@shared/utils/cn';

type Props = {
  people: Person[];
  peopleInput: string;
  onPeopleInputChange: (value: string) => void;
  onPeopleSubmit: (event: { preventDefault(): void }) => void;
  onRemovePerson: (id: string) => void;
};

export function PeopleStep({
  people,
  peopleInput,
  onPeopleInputChange,
  onPeopleSubmit,
  onRemovePerson,
}: Props) {
  return (
    <div className="space-y-5">
      {/* Header — desktop */}
      <div className="mb-6 hidden md:block">
        <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-on-surface tracking-tight mb-2">
          Who's Splitting?
        </h1>
        <p className="text-on-surface-variant text-lg">Add everyone who's part of this bill.</p>
      </div>

      {/* Header — mobile */}
      <div className="mb-2 md:hidden">
        <h1 className="text-xl font-extrabold font-headline text-on-surface tracking-tight">
          Who's Splitting?
        </h1>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Add everyone who's part of this bill.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-[0_8px_24px_rgba(25,28,29,0.06)]">
        <form onSubmit={onPeopleSubmit} className="flex gap-3">
          <input
            id="new-people-input"
            data-testid="people-input"
            value={peopleInput}
            onChange={(e) => onPeopleInputChange(e.target.value)}
            placeholder="Names, e.g. Alice, Bob"
            className="flex-1 px-4 py-3 bg-surface-container rounded-xl border-none focus:ring-0 text-on-surface placeholder:text-outline outline-none text-base"
          />
          <button
            type="submit"
            data-testid="people-add-btn"
            className="px-4 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-xl active:scale-95 transition-transform flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>
        <p className="mt-2 text-[10px] text-on-surface-variant/70 font-medium px-1">
          Tip: Input multiple names with commas
        </p>
      </div>

      {/* People list or empty state */}
      {people.length === 0 ? (
        <div
          data-testid="people-empty-state"
          className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-outline-variant/30 rounded-2xl text-center gap-3"
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
                onClick={() => onRemovePerson(person.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold transition hover:opacity-75 active:scale-95',
                  color.lightBg,
                  color.border,
                  color.accent,
                )}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
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
          <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0" />
          {people.length} {people.length === 1 ? 'person' : 'people'} added
        </div>
      )}
    </div>
  );
}
