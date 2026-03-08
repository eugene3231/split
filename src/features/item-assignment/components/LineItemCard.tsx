import type { AssignmentMode, ChargeState, EditableItem, Person } from '../../../shared/types'
import { formatCurrencyFromCents } from '../../../shared/logic/core/money'
import { isItemAssigned, pickDefaultPersonId } from '../../../shared/logic/assignment/items'
import { resolveDiscountedAmountCents } from '../../../shared/logic/computation/pricing'

type LineItemCardProps = {
  item: EditableItem
  itemIndex: number
  people: Person[]
  peopleSet: Set<string>
  onRemoveItem: (itemId: string) => void
  onUpdateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void
  globalDiscount?: ChargeState
}

export function LineItemCard({
  item,
  itemIndex,
  people,
  peopleSet,
  onRemoveItem,
  onUpdateItem,
  globalDiscount,
}: LineItemCardProps) {
  const itemAssigned = isItemAssigned(item, peopleSet)
  const itemNetAmountCents = resolveDiscountedAmountCents(item)

  return (
    <article className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">Item {itemIndex + 1}</p>
        <button
          type="button"
          onClick={() => onRemoveItem(item.id)}
          className="text-xs text-rose-300 hover:text-rose-200"
        >
          Remove
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={item.name}
          onChange={(event) =>
            onUpdateItem(item.id, (currentItem) => ({
              ...currentItem,
              name: event.target.value,
            }))
          }
          placeholder="Item name"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={item.amountInput}
            onChange={(event) =>
              onUpdateItem(item.id, (currentItem) => ({
                ...currentItem,
                amountInput: event.target.value,
              }))
            }
            inputMode="decimal"
            placeholder="Amount"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          />
          <input
            value={item.discountPercentInput}
            onChange={(event) =>
              onUpdateItem(item.id, (currentItem) => ({
                ...currentItem,
                discountPercentInput: event.target.value,
              }))
            }
            inputMode="decimal"
            placeholder="Discount %"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-400">
          Net after discount:{' '}
          {itemNetAmountCents === null ? '$0.00' : formatCurrencyFromCents(itemNetAmountCents)}
        </p>
        {globalDiscount?.enabled ? (
          <span
            data-testid="global-discount-badge"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
          >
            {globalDiscount.mode === 'percent'
              ? `+${globalDiscount.percentInput || '0'}% whole-bill discount`
              : 'Whole-bill discount applied'}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={item.assignment.mode}
          onChange={(event) => {
            const nextMode = event.target.value as AssignmentMode
            onUpdateItem(item.id, (currentItem) => {
              if (nextMode === 'single') {
                return {
                  ...currentItem,
                  assignment: {
                    mode: 'single',
                    personId: pickDefaultPersonId(people, currentItem.assignment.personId),
                    personIds: currentItem.assignment.personIds,
                  },
                }
              }

              return {
                ...currentItem,
                assignment: {
                  mode: 'equal',
                  personId: currentItem.assignment.personId,
                  personIds:
                    currentItem.assignment.personIds.length > 0
                      ? currentItem.assignment.personIds
                      : people.map((person) => person.id),
                },
              }
            })
          }}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
        >
          <option value="single">Single person</option>
          <option value="equal">Equal split</option>
        </select>
        <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          {itemAssigned ? 'Assigned' : 'Needs assignment'}
        </div>
      </div>

      {item.assignment.mode === 'single' ? (
        <select
          value={item.assignment.personId}
          onChange={(event) =>
            onUpdateItem(item.id, (currentItem) => ({
              ...currentItem,
              assignment: {
                ...currentItem.assignment,
                personId: event.target.value,
              },
            }))
          }
          disabled={people.length === 0}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Select person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateItem(item.id, (currentItem) => ({
                  ...currentItem,
                  assignment: {
                    ...currentItem.assignment,
                    personIds: people.map((person) => person.id),
                  },
                }))
              }
              disabled={people.length === 0}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateItem(item.id, (currentItem) => ({
                  ...currentItem,
                  assignment: {
                    ...currentItem.assignment,
                    personIds: [],
                  },
                }))
              }
              disabled={people.length === 0}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select none
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {people.length === 0 ? (
              <p className="text-xs text-slate-400">Add people before splitting.</p>
            ) : (
              people.map((person) => {
                const isChecked = item.assignment.personIds.includes(person.id)

                return (
                  <label
                    key={person.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) =>
                        onUpdateItem(item.id, (currentItem) => ({
                          ...currentItem,
                          assignment: {
                            ...currentItem.assignment,
                            personIds: event.target.checked
                              ? Array.from(
                                  new Set([...currentItem.assignment.personIds, person.id]),
                                )
                              : currentItem.assignment.personIds.filter(
                                  (existingId) => existingId !== person.id,
                                ),
                          },
                        }))
                      }
                    />
                    {person.name}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </article>
  )
}
