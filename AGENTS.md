# Split

Browser-only bill-splitting app: scan a receipt with a vision model, assign items to people, show each person's total, export as PNG or text. No backend, no auth — state lives in Zustand stores and persists to `localStorage`. Run commands with `pnpm`.

## Where code goes

- `pages/` — route shells only. No workflow logic, step logic, or feature-owned hooks.
- `features/<name>/` — one capability, whole: components, hooks, logic, stores, persistence, UI.
- `shared/` — only primitives already reused by two or more features. Holds true cross-feature types, logic, constants, and utilities.

Layering, step structure, and summary data flow: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Derive, don't store

Recompute splits, summaries, and export payloads from canonical store state instead of keeping a second copy in a store or in `useState`.

Same rule in components: derive during render. `react-hooks/set-state-in-effect` and `react-hooks/refs` are errors here, so a value needing a side effect comes from `useMemo` with cleanup-only `useEffect`. Add `useMemo`/`useCallback` for a measured problem, not on reflex.

## Summary / export parity

`PersonBreakdownCard.tsx` and `receiptSplitImageLight.ts` render the same breakdown through different technologies, so they drift silently. Read [docs/EXPORT-PARITY.md](docs/EXPORT-PARITY.md) before changing either.

## Styling

Merge classes with `cn()`. Design tokens go in the `@theme` block in `src/index.css`; reach for `style={{}}` only where Tailwind cannot. Extract a component once a class list repeats or hides a real UI concept.

## Tests

Every feature and bug fix ships with tests: [docs/TESTING.md](docs/TESTING.md).

## Receipt scanning

The scan prompt, response schema, model provider, or charge detection: [docs/RECEIPT-SCANNING.md](docs/RECEIPT-SCANNING.md).

## Domain language

Assignment, share weight, unassigned item — terms to use and to avoid: [CONTEXT.md](CONTEXT.md).
