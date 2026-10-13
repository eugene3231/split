---
paths:
  - 'src/features/split-workspace/summary/**/*.{ts,tsx}'
---

# Summary / export parity

Each summary view is drawn twice, in React and on a canvas for the PNG. What rows a view holds is decided once, in `summaryBreakdown.ts` or `summaryOverview.ts`, and both renderers walk that list, so change content there. How a row looks is still two separate pieces of code that nothing compares: a styling change to one renderer has to be made in the other, or marked `React only:` / `Image only:` and listed in the doc.

@../../docs/EXPORT-PARITY.md
