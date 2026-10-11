# Split Workspace Architecture

Pragmatic React layering, not strict MVVM. Repo-level structure lives in [AGENTS.md](../AGENTS.md); this covers how `features/split-workspace` is organised inside.

Two conventions that follow from it: a feature component may select from its feature store directly when that keeps ownership local and avoids prop-drilling, and stores live under their owning feature — never a top-level `src/stores`. Keep each `index.ts` barrel shallow.

## Layers

`stores` own canonical editable state → `logic` holds pure transforms → `hooks` compose state for a screen and run async workflows → `components` render.

- `useReceiptStore`, `useCurrencyStore` — source of truth for people, receipts, active receipt, payer mobile, exchange rates.
- `logic/split/` — receipt pricing, charge calculation, and per-person allocation. These rules belong to the workspace feature.
- `logic/exchangeRates.ts` — rate selection and currency conversion. Storage guards and persisted workspace types also stay in the feature.
- `useReceiptSplit` — reads canonical state, returns active/consolidated/per-receipt splits and reconciliation.
- `logic/summaryView.ts` — pure transform from split data plus summary controls into a screen-facing summary view.
- `logic/summaryBreakdown.ts` / `logic/summaryOverview.ts` — the per-person breakdown (shared with the PNG export) and the React-only who-had-what overview, both resolved from the summary view.
- `logic/buildSummaryExportPayload.ts` — pure mapping from the summary model into the export payload.

## Steps

Steps live in `components/steps/`. A step stays a flat file until it grows private collaborators, then becomes a folder holding its entry component, its step-private hooks, and its step-private UI. Hooks in those folders are still hook-layer; the folder is a locality boundary, not a new layer.

- `PeopleStep.tsx` — reads a small store slice directly; no step hook needed.
- `AssignStep/` — the Items screen: pick a person, tap what they had. Every receipt is on one page as its own section, and a "n items left" chip filters down to what nobody has yet. Renders from `resolveClaimView` (`logic/claim.ts`), a person-first view over the canonical `EditableItem.assignment`; the step itself holds only whether that filter is on. Every change goes through `applyAssignmentCommand`: ticking an item, the − / + share stepper, and typing an amount or percent into the share (`logic/itemShare.ts`). A share can leave part of an item unassigned (`assignment.unassignedWeight`), which keeps the item counted as left. The wizard owns `activePersonId`; `resolveClaimContinue` decides whether the bottom bar moves to the next person, splits what is left evenly, or opens the summary.
- `ReceiptStep/` — renders from `useReceiptStepModel`, delegates scan and OCR-patching workflows to `useReceiptImport`.
- `SummaryStep/` — renders from `useSummaryModel`, delegates export and share to `useSummaryExport`. The component owns only `activeTab`, `showDetails`, `showBaseCurrency`, and `mode` (By person or Overview).
- `WorkspaceMenu` — the header's three-dot menu. It saves the whole workspace as a `.json` file (`exportDraftToJson`), reads one back (`logic/workspaceTransfer.ts`), and loads the test splits in `logic/presetWorkspaces.ts`. Anything that would replace entered work asks first, then `useWizard.handleLoadWorkspace` swaps the store and lands on Items.
- `components/shared/` — reused across steps: receipt tabs, charge panels, selectors, field and avatar primitives.

## Summary data flow

`receiptStore`/`currencyStore` → `useReceiptSplit` → `resolveSummaryView` → `useSummaryModel` → `buildSummaryExportPayload` → `useSummaryExport` → `SummaryStep`

Editing is keyed by `activeReceiptId`, but summary rendering follows `activeTab`, not the editor's active receipt. QR generation stays inside `useSummaryModel`: summary-specific derived data with side effects.

`shared/types/summaryBreakdown.ts` defines the breakdown consumed by both the workspace UI and the sharing canvas. The workspace derives this data from canonical state. The sharing feature consumes the contract without importing workspace hooks or logic. Both renderers use the shared person-color palette.

Corrective discounts use `logic/reconciliation.ts` to search for the closest total after rounded service charge and tax. The solver and the split engine share the charge evaluator in `logic/split/charges.ts`. When a receipt's printed total is higher than its items and charges, the gap can be added as the receipt's `roundingInput`, which the split adds after tax.
