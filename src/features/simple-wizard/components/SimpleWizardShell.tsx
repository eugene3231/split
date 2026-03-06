import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { ChargeState, EditableItem, Person, SplitResult } from '../../../shared/types'
import { formatCurrencyFromCents, parseCurrencyToCents } from '../../../shared/logic/core/money'
import { GlobalChargesSection } from '../../receipt-setup/components/GlobalChargesSection'
import { ReceiptImportPanel } from '../../receipt-import/components/ReceiptImportPanel'
import { FinalSplitPanel } from '../../split-summary/components/FinalSplitPanel'
import { useReceiptUiStore } from '../../../shared/stores/receiptUiStore'
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
  hasAnyValidReceiptItem,
  isSimpleItemAssigned,
  isStepValid,
} from '../logic/wizardValidation'
import { WizardProgressHeader } from './WizardProgressHeader'
import { loadSimpleWizardState, saveSimpleWizardState } from '../logic/persistence'
import type { ItemsSubPhase, SimpleWizardStep } from '../types'

type SimpleWizardShellProps = {
  people: Person[]
  items: EditableItem[]
  serviceCharge: ChargeState
  gst: ChargeState
  receiptTotalInput: string
  split: SplitResult
  reconciliationCents: number | null
  onAddPeople: (rawInput: string) => void
  onRemovePerson: (personId: string) => void
  onReceiptFileSelected: (file: File | null) => void
  onScanReceipt: () => void
  onLoadMockReceipt: () => void
  onAddSimpleItem: () => void
  onRemoveItem: (itemId: string) => void
  onUpdateItem: (itemId: string, updater: (item: EditableItem) => EditableItem) => void
  onNormalizeItemsForSimpleMode: () => void
  onServiceChargeChange: (next: ChargeState) => void
  onGstChange: (next: ChargeState) => void
  onReceiptTotalInputChange: (value: string) => void
  exportSection: ReactNode
}

export function SimpleWizardShell({
  people,
  items,
  serviceCharge,
  gst,
  receiptTotalInput,
  split,
  reconciliationCents,
  onAddPeople,
  onRemovePerson,
  onReceiptFileSelected,
  onScanReceipt,
  onLoadMockReceipt,
  onAddSimpleItem,
  onRemoveItem,
  onUpdateItem,
  onNormalizeItemsForSimpleMode,
  onServiceChargeChange,
  onGstChange,
  onReceiptTotalInputChange,
  exportSection,
}: SimpleWizardShellProps) {
  const [initialWizardState] = useState(() => loadSimpleWizardState())
  const [activeStepState, setActiveStep] = useState<SimpleWizardStep>(
    initialWizardState?.step ?? 'people',
  )
  const [itemsSubPhaseState, setItemsSubPhase] = useState<ItemsSubPhase>(
    initialWizardState?.itemsSubPhase ?? 'assign',
  )
  const [activeItemIndex, setActiveItemIndex] = useState(initialWizardState?.activeItemIndex ?? 0)

  const peopleInput = useReceiptUiStore((state) => state.peopleInput)
  const setPeopleInput = useReceiptUiStore((state) => state.setPeopleInput)

  const detectedItemsCount = useMemo(() => getDetectedItemsCount(items), [items])
  const assignedItemCount = useMemo(() => getAssignedItemsCount(items, people), [items, people])

  const { activeStep, itemsSubPhase } = resolveWizardState(
    activeStepState,
    itemsSubPhaseState,
    items,
    people,
  )
  const safeActiveItemIndex = clampActiveItemIndex(activeItemIndex, items.length)
  const activeItem = items[safeActiveItemIndex] ?? null
  const validPeopleSet = useMemo(() => new Set(people.map((person) => person.id)), [people])
  const activeItemAssigned = activeItem ? isSimpleItemAssigned(activeItem, validPeopleSet) : false

  useEffect(() => {
    saveSimpleWizardState({ step: activeStep, itemsSubPhase, activeItemIndex: safeActiveItemIndex })
  }, [activeStep, itemsSubPhase, safeActiveItemIndex])

  const canContinue =
    activeStep === 'items'
      ? itemsSubPhase === 'review' && isStepValid('items', { items, people })
      : isStepValid(activeStep, { items, people })

  const handleNext = () => {
    if (activeStep === 'people') {
      if (!isStepValid('people', { items, people })) {
        return
      }
      setActiveStep('receipt')
      return
    }

    if (activeStep === 'receipt') {
      if (!isStepValid('receipt', { items, people })) {
        return
      }
      onNormalizeItemsForSimpleMode()
      setItemsSubPhase('assign')
      setActiveItemIndex(0)
      setActiveStep('items')
      return
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'assign') {
        setItemsSubPhase('review')
        return
      }

      if (!isStepValid('items', { items, people })) {
        return
      }

      setActiveStep('final')
    }
  }

  const handleBack = () => {
    if (activeStep === 'final') {
      setActiveStep('items')
      setItemsSubPhase('review')
      return
    }

    if (activeStep === 'items') {
      if (itemsSubPhase === 'review') {
        setItemsSubPhase('assign')
        return
      }

      setActiveStep('receipt')
      return
    }

    if (activeStep === 'receipt') {
      setActiveStep('people')
    }
  }

  const handlePeopleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onAddPeople(peopleInput)
  }

  const handleTogglePersonOnActiveItem = (personId: string, checked: boolean) => {
    if (!activeItem) {
      return
    }

    onUpdateItem(activeItem.id, (currentItem) => {
      const currentIds = new Set(currentItem.assignment.personIds)
      if (checked) {
        currentIds.add(personId)
      } else {
        currentIds.delete(personId)
      }

      return {
        ...currentItem,
        assignment: {
          mode: 'equal',
          personId: '',
          personIds: Array.from(currentIds),
        },
      }
    })
  }

  return (
    <section className="space-y-4" data-testid="simple-wizard">
      <WizardProgressHeader
        activeStep={activeStep}
        context={{
          detectedItemsCount,
          activeItemIndex: safeActiveItemIndex,
          assignedItemCount,
        }}
      />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        {activeStep === 'people' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Add People</h2>
            <form onSubmit={handlePeopleSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-slate-200" htmlFor="simple-people-input">
                People involved
              </label>
              <div className="flex gap-2">
                <input
                  id="simple-people-input"
                  value={peopleInput}
                  onChange={(event) => setPeopleInput(event.target.value)}
                  placeholder="Alice, Ben, Cara"
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
                  >
                    {person.name} ×
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeStep === 'receipt' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Add Receipt</h2>
            <ReceiptImportPanel
              onReceiptFileSelected={onReceiptFileSelected}
              onScanReceipt={onScanReceipt}
              onLoadMockReceipt={onLoadMockReceipt}
              hideModelInAdvancedSettings
              enableCameraCapture
              showLoadMockButton
            />

            {hasAnyValidReceiptItem(items) ? (
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="font-medium">Verify Parsed Results</h3>
                <GlobalChargesSection
                  serviceCharge={serviceCharge}
                  onServiceChargeChange={onServiceChargeChange}
                  gst={gst}
                  onGstChange={onGstChange}
                  receiptTotalInput={receiptTotalInput}
                  onReceiptTotalInputChange={onReceiptTotalInputChange}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Items</p>
                    <button
                      type="button"
                      onClick={onAddSimpleItem}
                      className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:border-slate-500"
                    >
                      + Add Item
                    </button>
                  </div>

                  {items.map((item) => (
                    <article key={item.id} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          value={item.name}
                          onChange={(event) =>
                            onUpdateItem(item.id, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Item name"
                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
                        />
                        <input
                          value={item.amountInput}
                          onChange={(event) =>
                            onUpdateItem(item.id, (current) => ({
                              ...current,
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
                            onUpdateItem(item.id, (current) => ({
                              ...current,
                              discountPercentInput: event.target.value,
                            }))
                          }
                          inputMode="decimal"
                          placeholder="Discount %"
                          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400 transition focus:ring-2"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="text-xs text-rose-300 hover:text-rose-200"
                      >
                        Remove item
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                Scan a receipt first. Then verify charges and item details before continuing.
              </p>
            )}
          </div>
        ) : null}

        {activeStep === 'items' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Assign Items & Review</h2>
            {itemsSubPhase === 'assign' ? (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                {activeItem ? (
                  <>
                    <p className="text-sm font-medium">
                      Item {safeActiveItemIndex + 1} of {items.length}
                    </p>
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                      <p className="font-semibold text-slate-100">{activeItem.name || 'Untitled item'}</p>
                      <p className="text-xs text-slate-400">
                        {(() => {
                          const cents = parseCurrencyToCents(activeItem.amountInput)
                          return cents === null ? 'Invalid amount' : formatCurrencyFromCents(cents)
                        })()}
                      </p>
                    </div>
                    <p className="text-xs text-slate-300">Split equally and choose who is involved:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeItem) {
                            return
                          }

                          onUpdateItem(activeItem.id, (currentItem) => ({
                            ...currentItem,
                            assignment: {
                              mode: 'equal',
                              personId: '',
                              personIds: people.map((person) => person.id),
                            },
                          }))
                        }}
                        disabled={people.length === 0}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeItem) {
                            return
                          }

                          onUpdateItem(activeItem.id, (currentItem) => ({
                            ...currentItem,
                            assignment: {
                              mode: 'equal',
                              personId: '',
                              personIds: [],
                            },
                          }))
                        }}
                        disabled={people.length === 0}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Select none
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.map((person) => {
                        const isChecked = activeItem.assignment.personIds.includes(person.id)
                        return (
                          <label
                            key={person.id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) =>
                                handleTogglePersonOnActiveItem(person.id, event.target.checked)
                              }
                            />
                            {person.name}
                          </label>
                        )
                      })}
                    </div>
                    <p className={activeItemAssigned ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>
                      {activeItemAssigned
                        ? 'This item is assigned.'
                        : 'Select at least one person for this item.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveItemIndex((current) => Math.max(0, current - 1))}
                        disabled={safeActiveItemIndex === 0}
                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveItemIndex((current) => Math.min(items.length - 1, current + 1))}
                        disabled={safeActiveItemIndex >= items.length - 1}
                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemsSubPhase('review')}
                        className="rounded-md border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200"
                      >
                        Review Assignments
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">No items available yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-sm font-medium">Review Assignments</p>
                {items.map((item, index) => {
                  const selectedPeople = people
                    .filter((person) => item.assignment.personIds.includes(person.id))
                    .map((person) => person.name)

                  return (
                    <article key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{item.name || `Item ${index + 1}`}</p>
                        <p className="text-xs text-slate-400">
                          {selectedPeople.length > 0
                            ? `Split among: ${selectedPeople.join(', ')}`
                            : 'No people selected'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveItemIndex(index)
                          setItemsSubPhase('assign')
                        }}
                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}

        {activeStep === 'final' ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Split Result</h2>
            <p className="text-sm text-slate-400">
              Review each person&apos;s total, check the receipt difference, and share the split to get your $ back.
            </p>
            <FinalSplitPanel
              people={people}
              split={split}
              reconciliationCents={reconciliationCents}
              serviceCharge={serviceCharge}
              gst={gst}
              exportSection={exportSection}
              variant="embedded"
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={activeStep === 'people'}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>

        {activeStep !== 'final' ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue && !(activeStep === 'items' && itemsSubPhase === 'assign')}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {activeStep === 'people'
              ? 'Continue to Add Receipt'
              : activeStep === 'receipt'
                ? 'Continue to Assign Items'
                : itemsSubPhase === 'assign'
                  ? 'Review Items'
                  : 'Continue to Split Result'}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function clampActiveItemIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0
  }

  return Math.min(Math.max(0, index), itemCount - 1)
}

function resolveWizardState(
  activeStep: SimpleWizardStep,
  itemsSubPhase: ItemsSubPhase,
  items: EditableItem[],
  people: Person[],
): {
  activeStep: SimpleWizardStep
  itemsSubPhase: ItemsSubPhase
} {
  if (activeStep === 'final' && !isStepValid('items', { items, people })) {
    return {
      activeStep: 'items',
      itemsSubPhase: 'assign',
    }
  }

  if (activeStep === 'items' && !isStepValid('receipt', { items, people })) {
    return {
      activeStep: 'receipt',
      itemsSubPhase,
    }
  }

  if (activeStep === 'receipt' && !isStepValid('people', { items, people })) {
    return {
      activeStep: 'people',
      itemsSubPhase,
    }
  }

  return {
    activeStep,
    itemsSubPhase,
  }
}
