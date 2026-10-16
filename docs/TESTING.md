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

For a rule that must hold on every bill, such as every cent being handed out or each person's charges adding up to their total, write a [fast-check](https://fast-check.dev) property next to the examples, as in `split.properties.test.ts`. Generated receipts reach corners a hand-picked one misses. Keep an example test for each specific amount a person should pay: a property cannot tell a wrong split from a right one when both add up.

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

Integration tests use the helpers in `src/tests/integration/testHelpers.ts` — `makePerson`, `makeItem`, `makeReceipt`, `seedStore`, `resetAllStores`, `reloadWorkspace`, `sumValues` — with `resetAllStores` in `beforeEach`. The receipt store reads its saved draft once, when the module loads, so a test that writes a draft to `localStorage` or simulates a page reload calls `reloadWorkspace` to make the store read it.

## Coverage

`pnpm test:coverage` counts components and hooks as well as logic. It leaves out the PNG renderers and `canvas/draw.ts`, which need a real canvas, and files with no code to run: types, constants and `index.ts` barrels. It fails below 90% lines, statements and functions, and 85% branches. These floors only catch a large loss, such as a module's tests deleted or a big feature added untested; they sit well under where the suite stands so ordinary changes never trip them.

The gate that applies to every change is Codecov, on pull requests. It fails a change that drops project coverage more than one point below its base, or that covers less than 85% of its own changed lines. That check moves with the suite, so the vitest floors rarely need changing.

Coverage counts lines run, not lines checked. A test that runs code without asserting the result raises coverage and catches nothing, so meet these gates with tests that assert exact values.
