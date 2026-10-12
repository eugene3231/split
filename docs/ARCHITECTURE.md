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
- `logic/reconciliation.ts` — `resolveReconciliation(receipt, people)` checks a receipt against its printed total and returns the gap plus the fix as a receipt patch (rounding when the printed total is higher, a pre-tax discount when it is lower). The receipt step and the summary both render that and write the fix with `patchReceipt`.
- `logic/summaryView.ts` — pure transform from split data plus summary controls into a screen-facing summary view.
- `logic/summaryBreakdown.ts` / `logic/summaryOverview.ts` — the per-person breakdown and the who-had-what overview, both resolved from the summary view and each with a PNG export.

## Steps

Steps live in `components/steps/`. A step stays a flat file until it grows private collaborators, then becomes a folder holding its entry component, its step-private hooks, and its step-private UI. Hooks in those folders are still hook-layer; the folder is a locality boundary, not a new layer.

- `PeopleStep.tsx` — reads a small store slice directly; no step hook needed.
- `AssignStep/` — the Items screen: pick a person, tap what they had. Every receipt is on one page as its own section, and a "n items left" chip filters down to what nobody has yet. Renders from `resolveClaimView` (`logic/claim.ts`), a person-first view over the canonical `EditableItem.assignment`; the step itself holds only whether that filter is on. Every change goes through `applyAssignmentCommand`: ticking an item, the − / + share stepper, and typing an amount or percent into the share (`logic/itemShare.ts`). An item's assignment is `{ shares, unassignedShare }`: share weights by person id, built only through `makeAssignment` (`logic/assignment.ts`) so each split has one stored form. A share can leave part of an item unassigned (`assignment.unassignedShare`), which keeps the item counted as left. The wizard owns `activePersonId`; `resolveClaimContinue` decides whether the bottom bar moves to the next person, splits what is left evenly, or opens the summary.
- `ReceiptStep/` — reads the active receipt from `useReceiptStore` and writes through its actions, delegates scan and OCR-patching workflows to `useReceiptImport`.
- `SummaryStep/` — renders from `useSummaryModel`, delegates export and share to `useSummaryExport`, whose image follows `mode`. The component owns only `activeTab`, `showDetails`, `showBaseCurrency`, and `mode` (By person or Overview).
- `WorkspaceMenu` — the header's three-dot menu. It saves the whole workspace as a `.json` file (`exportDraftToJson`), reads one back (`logic/workspaceTransfer.ts`), and loads the test splits in `logic/presetWorkspaces.ts`. Anything that would replace entered work asks first, then `useWizard.handleLoadWorkspace` swaps the store and lands on Items.
- `components/shared/` — reused across steps: receipt tabs, charge panels, selectors, field and avatar primitives.

## Summary data flow

`receiptStore`/`currencyStore` → `useSplits` → `resolveSummaryView` → `useSummaryModel` → `useSummaryExport` → `SummaryStep`

Editing is keyed by `activeReceiptId`, but summary rendering follows `activeTab`, not the editor's active receipt. The wizard opens the summary only once every priced item is assigned (`isStepValid('items')`), so nothing downstream of `resolveSummaryView` handles unassigned items or an empty people list. QR generation stays inside `useSummaryModel`: summary-specific derived data with side effects.

`shared/types/summaryBreakdown.ts` defines the breakdown consumed by both the workspace UI and the sharing canvas. The workspace derives this data from canonical state. The sharing feature consumes the contract without importing workspace hooks or logic. Both renderers use the shared person-color palette.

Corrective discounts use `logic/reconciliation.ts` to search for the closest total after rounded service charge and tax. The solver and the split engine share the charge evaluator in `logic/split/charges.ts`. When a receipt's printed total is higher than its items and charges, the gap can be added as the receipt's `roundingInput`, which the split adds after tax.
