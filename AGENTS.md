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

## Components

Prefer composable slots over a wide prop API — `<Card.Header>` rather than `hasImage`, `showBorder`, `footer`. Keep components small enough to need no explanatory comment, guard with early returns, and collocate state as low as it will go. Once data and actions cross more than about two layers, reach for composition, context, or a feature store rather than threading props further.

Extract a hook when the same stateful logic appears in two components, when the logic warrants its own test file, or when you're wrapping a browser API. Name them `use[Noun]`.

## TypeScript

`interface` for object shapes, `type` for unions and intersections. `unknown` with narrowing rather than `any`. `ComponentProps<typeof X>` to extend or wrap an existing component. Named exports for components, and delete dead code rather than commenting it out.

Examples, and the `useEffect` anti-patterns in full: [docs/REACT-TYPESCRIPT.md](docs/REACT-TYPESCRIPT.md).

## Styling

Merge classes with `cn()`. Design tokens go in the `@theme` block in `src/index.css`; reach for `style={{}}` only where Tailwind cannot. Extract a component once a class list repeats or hides a real UI concept.

## Tests

Every feature and bug fix ships with tests: [docs/TESTING.md](docs/TESTING.md).

## Receipt scanning

The scan prompt, response schema, model provider, or charge detection: [docs/RECEIPT-SCANNING.md](docs/RECEIPT-SCANNING.md).

## Domain language

Assignment, share weight, unassigned item — terms to use and to avoid: [CONTEXT.md](CONTEXT.md).
