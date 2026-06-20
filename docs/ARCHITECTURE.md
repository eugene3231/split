# Split Workspace Architecture

This feature uses pragmatic React layering rather than strict MVVM.

## High-Level Structure

- `src/pages`
  Route and page shells only. They assemble feature entry components rather than owning feature logic.

- `src/features/<feature>`
  Primary unit of ownership. Each feature keeps its own components, hooks, logic, stores, and feature-scoped services or API helpers together.

- `src/shared`
  Cross-feature logic and utilities only. Code should start inside a feature and move here only after real reuse across features appears.

- `src/tests` and `src/test`
  Test support and test suites. `src/tests/integration` currently holds cross-component and cross-hook integration coverage.

Within that repo structure, `features/split-workspace` uses the layering and step conventions described below.

## Principles

- `stores/` own canonical editable state.
- `logic/` owns pure transforms and domain calculations.
- `hooks/` compose store state for a screen and handle async workflows.
- `components/` render UI and keep only small local presentation state.
- Derived state stays derived. Do not create stores for summary views, splits, or export payloads.
- Colocate step-private hooks and components under that step's folder once a step grows collaborators.

## Layer Responsibilities

- `useReceiptStore` and `useCurrencyStore`
  Source of truth for people, receipts, active receipt, payer mobile, and exchange rates.

- `useReceiptSplit`
  Reads canonical state and exposes split-domain results:
  active receipt split, consolidated split, per-receipt splits, and reconciliation.

- `logic/summaryView.ts`
  Pure transform from split data plus summary controls into a screen-facing summary view.

- `useReceiptStepModel`
  Receipt-screen data contract.
  It reads store state plus `useReceiptSplit` and returns the active receipt state needed to render `ReceiptStep`.

- `useReceiptImport`
  Receipt-screen workflow controller.
  It handles scan/import flows, mock receipt loading, and patching OCR results back into the store.

- `useSummaryModel`
  The summary screen data contract.
  It reads store state, composes `useReceiptSplit`, resolves the current summary view from `activeTab`, and generates QR data for the summary screen.

- `logic/buildSummaryExportPayload.ts`
  Pure mapping from the summary model into the payload expected by export rendering.

- `useSummaryExport`
  Handles export and share workflows, busy/error/copied state, and preview URL lifecycle.

- `SummaryStep`
  Thin view component.
  It owns only local UI controls such as `activeTab`, `showDetails`, and `showBaseCurrency`, then renders from the summary hooks.

- `components/steps/<StepName>/`
  Physical colocation area for a step entry component and any step-private hooks/components.
  Hooks stored here are still part of the hook layer conceptually; they are colocated for locality, not because they became components.

## Step Structure

- `components/steps/PeopleStep.tsx`
  Small direct-store step. Stays flat until it grows private collaborators.

- `components/steps/AssignStep.tsx`
  Focused store-driven step. Still flat; assignment rules live in shared `logic/`.

- `components/steps/ReceiptStep/`
  Owns `ReceiptStep.tsx`, `useReceiptStepModel.ts`, `useReceiptImport.ts`, and step-private UI like `ReceiptImportActions.tsx`.

- `components/steps/SummaryStep/`
  Owns `SummaryStep.tsx`, `useSummaryModel.ts`, `useSummaryExport.ts`, and summary-private UI like `PersonBreakdownCard.tsx`, `SummaryTabs.tsx`, and export controls.

- `components/shared/`
  Holds components genuinely reused across steps, such as receipt tabs, charge panels, selectors, and small field/avatar primitives.

## Step Data Flow

- `PeopleStep`
  Reads a small store slice directly and renders it. No dedicated step hook is needed today.

- `ReceiptStep`
  Renders from `useReceiptStepModel` and delegates scan/import workflows to `useReceiptImport`.
  Step-private receipt import UI is colocated under `ReceiptStep/`.

- `AssignStep`
  Still reads a focused store slice directly, while assignment rules live in pure `logic/` helpers.

- `SummaryStep`
  Renders from `useSummaryModel` and delegates export/share workflows to `useSummaryExport`.
  Step-private summary display and export UI is colocated under `SummaryStep/`.

## Data Flow

The intended flow is:

`receiptStore / currencyStore`
-> `useReceiptSplit`
-> `resolveSummaryView`
-> `useSummaryModel`
-> `buildSummaryExportPayload`
-> `useSummaryExport`
-> `SummaryStep`

## Practical Notes

- Editing is keyed by `activeReceiptId`.
- Summary rendering is keyed by `activeTab`.
- Summary derivation should follow `activeTab`, not the editor's active receipt.
- QR generation stays inside `useSummaryModel` because it is summary-specific derived data with side effects.

## Rough Feel

The codebase should feel like:

`stores as source of truth -> logic as pure transforms -> hooks as feature composition/orchestration -> components as views`

That is the target direction for new work in this feature.
