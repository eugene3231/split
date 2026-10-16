# Split Workspace Architecture

Pragmatic React layering, not strict MVVM. Repo-level structure lives in [AGENTS.md](../AGENTS.md); this covers how `features/split-workspace` is organised inside.

Two conventions that follow from it: a feature component may select from its feature store directly when that keeps ownership local and avoids prop-drilling, and stores live under their owning feature — never a top-level `src/stores`. Keep each `index.ts` barrel shallow.

## Layers

`stores` own canonical editable state → `logic` holds pure transforms → `hooks` compose state for a screen and run async workflows → `components` render.

- `useReceiptStore`, `useCurrencyStore` — source of truth for people, receipts, active receipt, payer mobile, exchange rates. `useReceiptStore` loads the saved draft when its module loads and saves on every change, so it always holds at least one receipt (`receipts` is typed non-empty). Its actions take a receipt id; `patchReceipt` carries plain field edits and `updateItems` rewrites a receipt's items in one go.
- `logic/split/` — receipt pricing, charge calculation, and per-person allocation. These rules belong to the workspace feature. `computeSplit(receipt, people)` returns a `SplitResult`: an `Amounts` (subtotal, the four charges by `ChargeKind`, total) for each person with their item lines, and the same for the receipt as their sum. Anything that lists charges loops over `CHARGE_KINDS`. `allocate` shares cents between weights by position; `allocateCents` is the same for people and breaks ties by person id.
- `logic/exchangeRates.ts` — rate selection and currency conversion. Every currency a receipt can be in is one row of `CURRENCIES` in `shared/constants.ts` (symbol, fallback rate, whether it is written in whole units); `CurrencyCode` is derived from it, so adding a currency is one line. Amounts are converted through `BASE_CURRENCY`, which is also what PayNow is paid in.
- `logic/jsonStorage.ts` — every value kept in browser storage is read through a zod schema (`jsonStorage(kind, key, schema)`); each storage module owns its schema. `logic/draftStorage.ts` reads version 2 and 3 drafts and always writes version 3.
- `useSplits` — every split the workspace shows, from `deriveSplits(people, receipts, exchangeRates)`: each receipt paired with its split (`ReceiptSplit`), and all of them added up in the base currency. `deriveSplits` keeps its last result, so the components that read it in one render share one computation. Receipt totals for checking against a printed total are a separate calculation, `computeReceiptTotals`, because they count unassigned items as shared.
- `logic/reconciliation.ts` — `resolveReconciliation(receipt, people)` checks a receipt against its printed total and returns the gap plus the fix as a receipt patch (rounding when the printed total is higher, a pre-tax discount when it is lower). `ReconciliationNotice` shows it on the receipt step and on the summary, and the fix is written with `patchReceipt`.
- `summary/` — everything the summary step shows, as one folder instead of a slice of each layer, because its parts change together. See "Summary" below.

## Steps

Steps live in `components/steps/`, apart from the summary. A step stays a flat file until it grows private collaborators, then becomes a folder holding its entry component, its step-private hooks, and its step-private UI. Hooks in those folders are still hook-layer; the folder is a locality boundary, not a new layer.

- `PeopleStep.tsx` — reads a small store slice directly; no step hook needed.
- `AssignStep/` — the Items screen: pick a person, tap what they had. Every receipt is on one page as its own section, whose header counts what is left. Renders from `resolveClaimView` (`logic/claim.ts`), a person-first view over the canonical `EditableItem.assignment`; the step itself holds no state. An item other people already have in full (`takenByOthers`) stays in place but recedes, and only the active person's items open a second line with their share controls. Every change goes through `applyAssignmentCommand`: ticking an item, the − / + share stepper, and typing an amount or percent into the share (`logic/itemShare.ts`). An item's assignment is `{ shares, unassignedShare }`: share weights by person id, built only through `makeAssignment` (`logic/assignment.ts`) so each split has one stored form. A share can leave part of an item unassigned (`assignment.unassignedShare`), which keeps the item counted as left. The wizard owns `activePersonId`; `resolveClaimContinue` decides whether the bottom bar moves to the next person, splits what is left evenly, or opens the summary. Splitting what is left first lists it (`listItemsLeft`) in `SplitLeftoversDialog`, and only splits once confirmed.
- `ReceiptStep/` — reads the active receipt from `useReceiptStore` and writes through its actions, delegates scan and OCR-patching workflows to `useReceiptImport`.
- `WorkspaceMenu` — the header's three-dot menu. It saves the whole workspace as a `.json` file (`exportDraftToJson`), reads one back (`logic/workspaceTransfer.ts`), and loads the test splits in `logic/presetWorkspaces.ts`. Anything that would replace entered work asks first, then `useWizard.handleLoadWorkspace` swaps the store and lands on Items.
- `components/shared/` — reused across steps: receipt tabs, charge panels, selectors, field and avatar primitives.

## Summary

`summary/` holds the step's entry component, its hooks, and both ways each view is drawn.

- `summaryView.ts` — `resolveSummaryView` turns the splits and the summary's controls into one `SummaryView`: the receipts in view, each with its amounts as displayed and in the base currency, and their total. A receipt's own tab is the one-receipt case of the same shape (`scope: 'one'`).
- `breakdown/` — the By person view. `resolveSummaryBreakdown` decides what each person's card holds, as a body of receipt totals, receipt sections or an empty message, with each section a list of rows. `PersonBreakdownCard.tsx` renders it; `personBreakdownImage.ts` draws it for the PNG from the layout in `personBreakdownLayout.ts`.
- `overview/` — the who-had-what table. `resolveSummaryOverview` lists every row of every section; `OverviewTable.tsx` and `overviewImage.ts` render them.
- `canvas/` — the colours, fonts and drawing helpers both images use.
- `shareSplit.ts` — the text summary, native share and the image download.
- `useSummaryModel` composes the view, the breakdown, the overview, reconciliation and the PayNow codes. `useSummaryExport` saves, previews and shares; its image follows `mode`. `SummaryStep` owns only `activeTab`, `detail`, `showBaseCurrency` and `mode` (By person or Overview).

`receiptStore`/`currencyStore` → `useSplits` → `resolveSummaryView` → `resolveSummaryBreakdown` / `resolveSummaryOverview` → screen and PNG

Editing is keyed by `activeReceiptId`, but summary rendering follows `activeTab`, not the editor's active receipt. The wizard opens the summary only once every priced item is assigned (`isStepValid('items')`), so nothing downstream of `resolveSummaryView` handles unassigned items or an empty people list. QR generation stays inside `useSummaryModel`: summary-specific derived data with side effects.

Row order and content are decided once and both renderers walk the same rows; styling is not shared. [EXPORT-PARITY.md](EXPORT-PARITY.md) says what is guaranteed and lists the differences that are meant.

Corrective discounts use `logic/reconciliation.ts` to search for the closest total after rounded service charge and tax. The solver and the split engine share the charge evaluator in `logic/split/charges.ts`. When a receipt's printed total is higher than its items and charges, the gap can be added as the receipt's `roundingInput`, which the split adds after tax.
