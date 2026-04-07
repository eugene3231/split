import type { FormEvent } from 'react';
import type { Person } from '@shared/types';

type PeopleSetupSectionProps = {
  peopleInput: string;
  onPeopleInputChange: (value: string) => void;
  onPeopleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  people: Person[];
  onRemovePerson: (personId: string) => void;
};

export function PeopleSetupSection({
  peopleInput,
  onPeopleInputChange,
  onPeopleSubmit,
  people,
  onRemovePerson,
}: PeopleSetupSectionProps) {
  return (
    <>
      <form onSubmit={onPeopleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-slate-200" htmlFor="people-input">
          People (type names, separated by comma)
        </label>
        <div className="flex gap-2">
          <input
            id="people-input"
            value={peopleInput}
            onChange={(event) => onPeopleInputChange(event.target.value)}
            placeholder="Alice, Bob, Charlie"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {people.length === 0 ? (
          <p className="text-sm text-slate-400">No people added yet.</p>
        ) : (
          people.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onRemovePerson(person.id)}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              title="Remove person"
            >
              {person.name} ×
            </button>
          ))
        )}
      </div>
    </>
  );
}
