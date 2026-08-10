---
paths:
  - 'src/features/split-workspace/components/steps/SummaryStep/**/*.{ts,tsx}'
  - 'src/features/sharing/logic/**/*.ts'
  - 'src/features/split-workspace/logic/summaryBreakdown.ts'
---

# Summary / export parity

`PersonBreakdownCard.tsx` (React) and `receiptSplitImageLight.ts` (canvas) render the same breakdown through different technologies, so nothing catches it when they diverge — no type error, no failing test, just an exported PNG that stops matching the screen. A user-visible change to one has to land in the other.

@../../docs/EXPORT-PARITY.md
