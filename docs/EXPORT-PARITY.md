# Summary / Export Parity

Two renderers show the same per-person breakdown:

- React — `src/features/split-workspace/components/steps/SummaryStep/PersonBreakdownCard.tsx`
- PNG export — `src/features/sharing/logic/receiptSplitImageLight.ts`, plus `receiptSplitImageLightHelpers.ts` and `receiptSplitImageHelpers.ts`

Both render the breakdown resolved by `src/features/split-workspace/logic/summaryBreakdown.ts`.

## The rule

Review every user-visible change to one renderer against the other and against the shared breakdown logic. Keep them in sync for header structure, avatar treatment, labels, totals, receipt sub-cards, charge rows, currency-conversion copy, QR placement, and empty states.

When a change belongs in only one renderer, say so in a comment at the change site so the asymmetry reads as intentional rather than drift.

Add or extend a test on the shared expectation whenever you touch either side.

## Renderers stay dumb

Row selection, labels, totals, receipt sections, currency-conversion metadata, QR references, and empty states belong in `summaryBreakdown.ts`. The React and canvas adapters only compose and format what it resolves.

## Naming

Name things after the user-facing **breakdown** concept, following what is already there: `resolveSummaryBreakdown()`, `resolvePersonBreakdowns()`, `SummaryBreakdown`, `PersonBreakdown`, `ReceiptBreakdownSection`, `BreakdownItemRow`, `BreakdownChargeRow` — rather than card/view-model wording like `buildPersonSummaryCardModels`, `getPersonCards`, or `makeRows`.
