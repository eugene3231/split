# Testing Guide

Every feature and bug fix ships with tests.

## Unit vs integration

**Unit tests** cover one function, store action, or hook in isolation — fast, with pinpoint failures.

**Integration tests** cover cross-step workflow behaviour and end-to-end state flow across multiple stores, hooks, and features. They catch what unit tests miss: persistence drift, export regressions, a hook returning stale data after a store mutation.

## Where tests live

| Type                      | Location                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Unit / component          | Co-located with the file under test                         |
| Step-private hooks and UI | Inside the step folder                                      |
| Page-level integration    | Co-located with the page when that is the clearest boundary |
| Cross-feature integration | `src/tests/integration/`                                    |

`src/tests/setup.ts` is the shared setup entrypoint.

## What to test

**Always:**

- Pure functions in `logic/` — one `it` per distinct behaviour
- Store actions
- Hooks that contain real logic

**Write an integration test when:**

- A new hook reads from more than one store
- A flow spans multiple store actions (scan → assign → split)
- A workflow crosses feature boundaries (persistence, export/share, currency, receipt scanning)
- A bug came from store/hook wiring — put the regression test at that same boundary

**Don't default to testing:**

- Pure rendering with no meaningful behaviour — test the logic underneath instead
- Implementation details — assert on outputs and observable state only
- The real model API — mock it at the module boundary

## Patterns

Name tests after the scenario, not the function:

```ts
it('allocates equal split remainders deterministically', () => { ... });  // ✅
it('computeSplit works', () => { ... });                                  // ❌
```

Assert concrete values, so a failure is readable without chasing a variable:

```ts
expect(split.subtotalCents).toBe(1000); // ✅
expect(split.subtotalCents).toBe(total); // ❌
```

Assert on actions, visible states, aria/state attributes, and meaningful outputs. Exact copy is only worth asserting when that wording is the contract; broad snapshots of interactive screens break on harmless tweaks.

## Mocking

Reset stores in `beforeEach` via `useXxxStore.setState(...)`. Mock external APIs at the module boundary, and browser APIs like `URL.createObjectURL` or `navigator.clipboard` as needed. In isolated component tests, mock the step-private hook rather than recreating full store wiring.

```ts
const { analyzeReceiptWithGemini: mockOcr } = vi.hoisted(() => ({
  analyzeReceiptWithGemini: vi.fn(),
}));

vi.mock('@features/receipt-scanner/api/geminiApi', async (importActual) => {
  const actual = await importActual<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: mockOcr };
});
```

Integration tests use the helpers in `src/tests/integration/testHelpers.ts` — `makePerson`, `makeItem`, `makeReceipt`, `seedStore`, `resetAllStores`, `sumValues` — with `resetAllStores` in `beforeEach`.

## Coverage

80% lines, functions, branches, statements. `pnpm test:coverage`.
