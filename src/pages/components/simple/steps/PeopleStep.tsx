import { getPersonColor } from '@shared/utils/personColors'
import type { Person } from '@shared/types'

type Props = {
  people: Person[]
  peopleInput: string
  onPeopleInputChange: (value: string) => void
  onPeopleSubmit: (event: { preventDefault(): void }) => void
  onRemovePerson: (id: string) => void
}

export function PeopleStep({
  people,
  peopleInput,
  onPeopleInputChange,
  onPeopleSubmit,
  onRemovePerson,
}: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-slate-100">Add People</h2>
      <form onSubmit={onPeopleSubmit} className="space-y-2">
        <label
          className="block text-xs font-medium text-slate-400"
          htmlFor="simple-people-input"
        >
          Who is splitting this bill?
        </label>
        <div className="flex gap-2">
          <input
            id="simple-people-input"
            value={peopleInput}
            onChange={(event) => onPeopleInputChange(event.target.value)}
            placeholder="Alice, Bob, Charlie"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.98]"
          >
            Add
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {people.length === 0 ? (
          <p className="text-sm text-slate-500">No people added yet.</p>
        ) : (
          people.map((person, index) => {
            const color = getPersonColor(index)
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onRemovePerson(person.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-75 active:scale-95 ${color.lightBg} ${color.border} ${color.accent}`}
              >
                {person.name} ×
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
