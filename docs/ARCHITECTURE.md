# Split Workspace Architecture

Pragmatic React layering, not strict MVVM. Repo-level structure lives in [AGENTS.md](../AGENTS.md); this covers how `features/split-workspace` is organised inside.

Two conventions that follow from it: a feature component may select from its feature store directly when that keeps ownership local and avoids prop-drilling, and stores live under their owning feature — never a top-level `src/stores`. Keep each `index.ts` barrel shallow.

## Layers

`stores` own canonical editable state → `logic` holds pure transforms → `hooks` compose state for a screen and run async workflows → `components` render.

- `useReceiptStore`, `useCurrencyStore` — source of truth for people, receipts, active receipt, payer mobile, exchange rates.
- `useReceiptSplit` — reads canonical state, returns active/consolidated/per-receipt splits and reconciliation.
- `logic/summaryView.ts` — pure transform from split data plus summary controls into a screen-facing summary view.
- `logic/buildSummaryExportPayload.ts` — pure mapping from the summary model into the export payload.

## Steps

Steps live in `components/steps/`. A step stays a flat file until it grows private collaborators, then becomes a folder holding its entry component, its step-private hooks, and its step-private UI. Hooks in those folders are still hook-layer; the folder is a locality boundary, not a new layer.

- `PeopleStep.tsx` — reads a small store slice directly; no step hook needed.
- `AssignStep.tsx` — reads a focused store slice; assignment rules live in shared `logic/`.
- `ReceiptStep/` — renders from `useReceiptStepModel`, delegates scan, mock-receipt, and OCR-patching workflows to `useReceiptImport`.
- `SummaryStep/` — renders from `useSummaryModel`, delegates export and share to `useSummaryExport`. The component owns only `activeTab`, `showDetails`, and `showBaseCurrency`.
- `components/shared/` — reused across steps: receipt tabs, charge panels, selectors, field and avatar primitives.

## Summary data flow

`receiptStore`/`currencyStore` → `useReceiptSplit` → `resolveSummaryView` → `useSummaryModel` → `buildSummaryExportPayload` → `useSummaryExport` → `SummaryStep`

Editing is keyed by `activeReceiptId`, but summary rendering follows `activeTab`, not the editor's active receipt. QR generation stays inside `useSummaryModel`: summary-specific derived data with side effects.
