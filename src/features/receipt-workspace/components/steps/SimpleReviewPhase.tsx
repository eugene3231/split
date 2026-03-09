import type { EditableItem, Person } from '../../../../shared/types'

type Props = {
  items: EditableItem[]
  people: Person[]
  onEditItem: (index: number) => void
}

export function SimpleReviewPhase({ items, people, onEditItem }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-slate-800/40 p-4">
      <p className="text-sm font-semibold text-slate-200">Review Assignments</p>
      {items.map((item, index) => {
        const selectedPeople = people
          .filter((person) => item.assignment.personIds.includes(person.id))
          .map((person) => person.name)
        const allAssigned = selectedPeople.length > 0

        return (
          <article
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="space-y-0.5 text-sm">
              <p className="font-medium text-slate-200">
                {item.name || `Item ${index + 1}`}
              </p>
              <p className={`text-xs ${allAssigned ? 'text-slate-400' : 'text-amber-400'}`}>
                {allAssigned
                  ? `Split among: ${selectedPeople.join(', ')}`
                  : 'No people selected'}
              </p>
            </div>
            <button
              type="button"
              data-testid="wizard-edit-btn"
              onClick={() => onEditItem(index)}
              className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
            >
              Edit
            </button>
          </article>
        )
      })}
    </div>
  )
}
