import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
  formatCurrencyFromCents,
  parseCurrencyToCents,
} from "../../../shared/logic/core/money";
import { computeSplit } from "../../../shared/logic/computation/split";
import { GlobalChargesSection } from "../../receipt-setup/components/GlobalChargesSection";
import { ReceiptImportPanel } from "../../receipt-import/components/ReceiptImportPanel";
import { ExportImageSection } from "../../split-export";
import { SummaryRow } from "../../split-summary/components/SummaryRow";
import { useReceiptUiStore } from "../../../shared/stores/receiptUiStore";
import { useReceiptWorkspaceStore } from "../store/receiptWorkspaceStore";
import { SimplePersonBreakdown } from "./SimplePersonBreakdown";
import {
  getAssignedItemsCount,
  getDetectedItemsCount,
  hasAnyValidReceiptItem,
  isSimpleItemAssigned,
  isStepValid,
} from "../logic/wizardValidation";
import { SimpleProgressHeader } from "./SimpleProgressHeader";
import {
  loadSimpleWizardState,
  saveSimpleWizardState,
} from "../logic/persistence";
import type { ItemsSubPhase, SimpleWizardStep } from "../types";
import { getPersonColor } from "../../../shared/utils/personColors";

export function SimpleWorkspace() {
  const {
    people,
    items,
    serviceCharge,
    gst,
    receiptTotalInput,
    addPeopleFromInput,
    removePerson,
    handleReceiptFileSelected,
    handleScanReceipt,
    handleLoadSimpleMockReceipt,
    addSimpleItem,
    removeItem,
    updateItem,
    normalizeItemsForSimpleMode,
    setServiceCharge,
    setGst,
    setReceiptTotalInput,
  } = useReceiptWorkspaceStore(
    useShallow((state) => ({
      people: state.people,
      items: state.items,
      serviceCharge: state.serviceCharge,
      gst: state.gst,
      receiptTotalInput: state.receiptTotalInput,
      addPeopleFromInput: state.addPeopleFromInput,
      removePerson: state.removePerson,
      handleReceiptFileSelected: state.handleReceiptFileSelected,
      handleScanReceipt: state.handleScanReceipt,
      handleLoadSimpleMockReceipt: state.handleLoadSimpleMockReceipt,
      addSimpleItem: state.addSimpleItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      normalizeItemsForSimpleMode: state.normalizeItemsForSimpleMode,
      setServiceCharge: state.setServiceCharge,
      setGst: state.setGst,
      setReceiptTotalInput: state.setReceiptTotalInput,
    })),
  );
  const split = useMemo(
    () => computeSplit({ people, items, serviceCharge, gst }),
    [people, items, serviceCharge, gst],
  );
  const receiptTotalCents = parseCurrencyToCents(receiptTotalInput);
  const reconciliationCents =
    receiptTotalCents === null
      ? null
      : receiptTotalCents - split.grandTotalCents;

  const [showDiscountIds, setShowDiscountIds] = useState<Set<string>>(
    new Set(),
  );
  const discountInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const isDiscountVisible = (item: {
    id: string;
    discountPercentInput: string;
  }) => showDiscountIds.has(item.id) || !!item.discountPercentInput;

  const handleShowDiscount = (itemId: string) => {
    setShowDiscountIds((prev) => new Set([...prev, itemId]));
    requestAnimationFrame(() => discountInputRefs.current.get(itemId)?.focus());
  };

  const handleHideDiscount = (itemId: string) => {
    updateItem(itemId, (current) => ({ ...current, discountPercentInput: "" }));
    setShowDiscountIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  };

  const [initialWizardState] = useState(() => loadSimpleWizardState());
  const [activeStepState, setActiveStep] = useState<SimpleWizardStep>(
    initialWizardState?.step ?? "people",
  );
  const [itemsSubPhaseState, setItemsSubPhase] = useState<ItemsSubPhase>(
    initialWizardState?.itemsSubPhase ?? "assign",
  );
  const [activeItemIndex, setActiveItemIndex] = useState(
    initialWizardState?.activeItemIndex ?? 0,
  );

  const peopleInput = useReceiptUiStore((state) => state.peopleInput);
  const setPeopleInput = useReceiptUiStore((state) => state.setPeopleInput);
  const geminiApiKeyInput = useReceiptUiStore(
    (state) => state.geminiApiKeyInput,
  );
  const setShowApiKeyModal = useReceiptUiStore(
    (state) => state.setShowApiKeyModal,
  );

  const detectedItemsCount = useMemo(
    () => getDetectedItemsCount(items),
    [items],
  );
  const assignedItemCount = useMemo(
    () => getAssignedItemsCount(items, people),
    [items, people],
  );

  const { activeStep, itemsSubPhase } = resolveWizardState(
    activeStepState,
    itemsSubPhaseState,
    items,
    people,
  );
  const safeActiveItemIndex = clampActiveItemIndex(
    activeItemIndex,
    items.length,
  );
  const activeItem = items[safeActiveItemIndex] ?? null;
  const validPeopleSet = useMemo(
    () => new Set(people.map((person) => person.id)),
    [people],
  );
  const activeItemAssigned = activeItem
    ? isSimpleItemAssigned(activeItem, validPeopleSet)
    : false;

  useEffect(() => {
    saveSimpleWizardState({
      step: activeStep,
      itemsSubPhase,
      activeItemIndex: safeActiveItemIndex,
    });
  }, [activeStep, itemsSubPhase, safeActiveItemIndex]);

  const canContinue =
    activeStep === "items"
      ? itemsSubPhase === "review" && isStepValid("items", { items, people })
      : isStepValid(activeStep, { items, people });

  const handleNext = () => {
    if (activeStep === "people") {
      if (!isStepValid("people", { items, people })) return;
      setActiveStep("receipt");
      if (!geminiApiKeyInput.trim()) setShowApiKeyModal(true);
      return;
    }

    if (activeStep === "receipt") {
      if (!isStepValid("receipt", { items, people })) return;
      normalizeItemsForSimpleMode();
      setItemsSubPhase("assign");
      setActiveItemIndex(0);
      setActiveStep("items");
      return;
    }

    if (activeStep === "items") {
      if (itemsSubPhase === "assign") {
        setItemsSubPhase("review");
        return;
      }
      if (!isStepValid("items", { items, people })) return;
      setActiveStep("final");
    }
  };

  const handleBack = () => {
    if (activeStep === "final") {
      setActiveStep("items");
      setItemsSubPhase("review");
      return;
    }

    if (activeStep === "items") {
      if (itemsSubPhase === "review") {
        setItemsSubPhase("assign");
        return;
      }
      setActiveStep("receipt");
      return;
    }

    if (activeStep === "receipt") {
      setActiveStep("people");
    }
  };

  const handlePeopleSubmit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    addPeopleFromInput(peopleInput);
  };

  const handleTogglePersonOnActiveItem = (
    personId: string,
    checked: boolean,
  ) => {
    if (!activeItem) return;

    updateItem(activeItem.id, (currentItem) => {
      const currentIds = new Set(currentItem.assignment.personIds);
      if (checked) currentIds.add(personId);
      else currentIds.delete(personId);

      return {
        ...currentItem,
        assignment: {
          mode: "equal",
          personId: "",
          personIds: Array.from(currentIds),
        },
      };
    });
  };

  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-4"
      data-testid="simple-wizard"
    >
      <SimpleProgressHeader
        activeStep={activeStep}
        context={{
          detectedItemsCount,
          activeItemIndex: safeActiveItemIndex,
          assignedItemCount,
        }}
      />

      {/* Main card */}
      <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-5 shadow-xl shadow-black/25 backdrop-blur-sm">
        {/* ── STEP 1: PEOPLE ── */}
        {activeStep === "people" ? (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-slate-100">Add People</h2>
            <form onSubmit={handlePeopleSubmit} className="space-y-2">
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
                  onChange={(event) => setPeopleInput(event.target.value)}
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
                  const color = getPersonColor(index);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => removePerson(person.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-75 active:scale-95 ${color.lightBg} ${color.border} ${color.accent}`}
                    >
                      {person.name} ×
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {/* ── STEP 2: RECEIPT ── */}
        {activeStep === "receipt" ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100">Add Receipt</h2>
            <ReceiptImportPanel
              onReceiptFileSelected={handleReceiptFileSelected}
              onScanReceipt={handleScanReceipt}
              onLoadMockReceipt={handleLoadSimpleMockReceipt}
              hideModelInAdvancedSettings
              enableCameraCapture
              showLoadMockButton={false}
            />

            {hasAnyValidReceiptItem(items) ? (
              <div className="space-y-4">
                <GlobalChargesSection
                  serviceCharge={serviceCharge}
                  onServiceChargeChange={setServiceCharge}
                  gst={gst}
                  onGstChange={setGst}
                  receiptTotalInput={receiptTotalInput}
                  onReceiptTotalInputChange={setReceiptTotalInput}
                />

                {/* Card 3: Items */}
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">
                      Items
                    </p>
                    <button
                      type="button"
                      onClick={addSimpleItem}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="divide-y divide-slate-700/40">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={item.name}
                              onChange={(event) =>
                                updateItem(item.id, (current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                              placeholder="Item name"
                              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
                            />
                            <input
                              value={item.amountInput}
                              onChange={(event) =>
                                updateItem(item.id, (current) => ({
                                  ...current,
                                  amountInput: event.target.value,
                                }))
                              }
                              inputMode="decimal"
                              placeholder="Amount"
                              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
                            />
                          </div>
                          {isDiscountVisible(item) ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  if (el)
                                    discountInputRefs.current.set(item.id, el);
                                  else
                                    discountInputRefs.current.delete(item.id);
                                }}
                                value={item.discountPercentInput}
                                onChange={(event) =>
                                  updateItem(item.id, (current) => ({
                                    ...current,
                                    discountPercentInput: event.target.value,
                                  }))
                                }
                                inputMode="decimal"
                                placeholder="Discount %"
                                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-sky-400/70 transition focus:ring-2"
                              />
                              <button
                                type="button"
                                onClick={() => handleHideDiscount(item.id)}
                                className="text-xs text-slate-500 transition hover:text-slate-300 hover:underline"
                              >
                                Remove discount
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleShowDiscount(item.id)}
                              className="text-xs text-slate-500 transition hover:text-slate-300 hover:underline"
                            >
                              + Add discount
                            </button>
                          )}
                        </div>

                        {/* ✕ remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove item"
                          className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <svg
                            width="14"
                            height="14"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-500">
                Scan a receipt first, then verify the charges and items before
                continuing.
              </p>
            )}
          </div>
        ) : null}

        {/* ── STEP 3: ASSIGN ITEMS ── */}
        {activeStep === "items" ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100">Assign Items</h2>

            {itemsSubPhase === "assign" ? (
              <div className="space-y-4 rounded-xl border border-white/8 bg-slate-800/40 p-4">
                {activeItem ? (
                  <>
                    <p className="text-xs font-medium text-slate-500">
                      Item {safeActiveItemIndex + 1} of {items.length}
                    </p>

                    {/* Active item card */}
                    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
                      <p className="font-semibold text-slate-100">
                        {activeItem.name || "Untitled item"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {(() => {
                          const cents = parseCurrencyToCents(
                            activeItem.amountInput,
                          );
                          return cents === null
                            ? "Invalid amount"
                            : formatCurrencyFromCents(cents);
                        })()}
                      </p>
                    </div>

                    <p className="text-xs text-slate-400">
                      Split equally among:
                    </p>

                    {/* Pill toggle buttons */}
                    <div className="flex flex-wrap gap-2">
                      {people.map((person, index) => {
                        const isSelected =
                          activeItem.assignment.personIds.includes(person.id);
                        const color = getPersonColor(index);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              handleTogglePersonOnActiveItem(
                                person.id,
                                !isSelected,
                              )
                            }
                            onDoubleClick={() => {
                              if (!activeItem) return;
                              updateItem(activeItem.id, (currentItem) => ({
                                ...currentItem,
                                assignment: {
                                  mode: "equal",
                                  personId: "",
                                  personIds: [person.id],
                                },
                              }));
                            }}
                            className={[
                              "rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-95",
                              isSelected
                                ? `${color.bg} ${color.text} shadow-sm`
                                : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                            ].join(" ")}
                          >
                            {person.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Select all / none ghost links */}
                    <div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!activeItem) return;
                            updateItem(activeItem.id, (currentItem) => ({
                              ...currentItem,
                              assignment: {
                                mode: "equal",
                                personId: "",
                                personIds: people.map((p) => p.id),
                              },
                            }));
                          }}
                          disabled={people.length === 0}
                          className="text-xs text-slate-500 underline underline-offset-2 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!activeItem) return;
                            updateItem(activeItem.id, (currentItem) => ({
                              ...currentItem,
                              assignment: {
                                mode: "equal",
                                personId: "",
                                personIds: [],
                              },
                            }));
                          }}
                          disabled={people.length === 0}
                          className="text-xs text-slate-500 underline underline-offset-2 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Select none
                        </button>
                      </div>
                      <span className="text-xs text-slate-600">
                        Double-click to assign only that person
                      </span>
                    </div>

                    <p
                      className={
                        activeItemAssigned
                          ? "text-xs text-emerald-400"
                          : "text-xs text-amber-400"
                      }
                    >
                      {activeItemAssigned
                        ? "Item assigned ✓"
                        : "Select at least one person for this item."}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveItemIndex((current) =>
                            Math.max(0, current - 1),
                          )
                        }
                        disabled={safeActiveItemIndex === 0}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveItemIndex((current) =>
                            Math.min(items.length - 1, current + 1),
                          )
                        }
                        disabled={safeActiveItemIndex >= items.length - 1}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next →
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemsSubPhase("review")}
                        className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/15"
                      >
                        Review Assignments
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    No items available yet.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-white/8 bg-slate-800/40 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Review Assignments
                </p>
                {items.map((item, index) => {
                  const selectedPeople = people
                    .filter((person) =>
                      item.assignment.personIds.includes(person.id),
                    )
                    .map((person) => person.name);
                  const allAssigned = selectedPeople.length > 0;

                  return (
                    <article
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="space-y-0.5 text-sm">
                        <p className="font-medium text-slate-200">
                          {item.name || `Item ${index + 1}`}
                        </p>
                        <p
                          className={`text-xs ${allAssigned ? "text-slate-400" : "text-amber-400"}`}
                        >
                          {allAssigned
                            ? `Split among: ${selectedPeople.join(", ")}`
                            : "No people selected"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveItemIndex(index);
                          setItemsSubPhase("assign");
                        }}
                        className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                      >
                        Edit
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* ── STEP 4: FINAL ── */}
        {activeStep === "final" ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-100">Split Result</h2>
            <p className="text-xs text-slate-500">
              Review each person's total, check the receipt difference, then
              share.
            </p>

            <ExportImageSection
              people={people}
              split={split}
              serviceCharge={serviceCharge}
              gst={gst}
              reconciliationCents={reconciliationCents}
            />

            <article className="overflow-hidden rounded-xl border border-white/8 bg-slate-900 shadow-lg shadow-black/20">
              <div className="border-b border-sky-500/50 bg-sky-500/15 px-4 py-3">
                <p className="text-sm font-bold text-slate-100">Total</p>
                <p className="text-lg font-bold text-sky-300">
                  {formatCurrencyFromCents(split.grandTotalCents)}
                </p>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={formatCurrencyFromCents(split.subtotalCents)}
                />
                <SummaryRow
                  label={
                    serviceCharge.enabled
                      ? `Service Charge (${serviceCharge.mode === "percent" ? serviceCharge.percentInput + "%" : "amount"})`
                      : "Service Charge (off)"
                  }
                  value={formatCurrencyFromCents(split.serviceChargeCents)}
                />
                <SummaryRow
                  label={
                    gst.enabled
                      ? `GST / Tax (${gst.mode === "percent" ? gst.percentInput + "%" : "amount"})`
                      : "GST / Tax (off)"
                  }
                  value={formatCurrencyFromCents(split.gstCents)}
                />
                <SummaryRow
                  label="Grand Total"
                  value={formatCurrencyFromCents(split.grandTotalCents)}
                  emphasized
                />
                {reconciliationCents !== null ? (
                  <SummaryRow
                    label="Receipt Difference"
                    value={formatCurrencyFromCents(reconciliationCents)}
                    tone={reconciliationCents === 0 ? "ok" : "warn"}
                  />
                ) : null}
              </div>
            </article>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-200">
                Per-person breakdown
              </p>
              <SimplePersonBreakdown
                people={people}
                split={split}
                serviceCharge={serviceCharge}
                gst={gst}
              />
            </div>

            {split.unassignedItemCount > 0 ? (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-300">
                {split.unassignedItemCount} item(s) are unassigned and not
                included in person totals.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={activeStep === "people"}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {activeStep !== "final" ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={
              !canContinue &&
              !(activeStep === "items" && itemsSubPhase === "assign")
            }
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {activeStep === "people"
              ? "Continue →"
              : activeStep === "receipt"
                ? "Continue to Assign →"
                : itemsSubPhase === "assign"
                  ? "Review Items →"
                  : "See Split Result →"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function clampActiveItemIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return Math.min(Math.max(0, index), itemCount - 1);
}

function resolveWizardState(
  activeStep: SimpleWizardStep,
  itemsSubPhase: ItemsSubPhase,
  items: ReturnType<typeof useReceiptWorkspaceStore.getState>["items"],
  people: ReturnType<typeof useReceiptWorkspaceStore.getState>["people"],
): {
  activeStep: SimpleWizardStep;
  itemsSubPhase: ItemsSubPhase;
} {
  if (activeStep === "final" && !isStepValid("items", { items, people })) {
    return { activeStep: "items", itemsSubPhase: "assign" };
  }

  if (activeStep === "items" && !isStepValid("receipt", { items, people })) {
    return { activeStep: "receipt", itemsSubPhase };
  }

  if (activeStep === "receipt" && !isStepValid("people", { items, people })) {
    return { activeStep: "people", itemsSubPhase };
  }

  return { activeStep, itemsSubPhase };
}
