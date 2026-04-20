# Testing Guide

## Rule

Every new feature or bug fix must ship with tests. No exceptions.

---

## Unit vs integration

**Unit tests** test one function, store action, or hook in isolation. Fast, pinpoint failures.

**Integration tests** test cross-step workflow behaviour and end-to-end state flow across multiple stores, hooks, and features — they catch bugs unit tests miss (e.g. persistence drift, export regressions, or a hook returning stale data after a store mutation).

---

## What to test

**Always test:**

- Pure functions in `logic/` — one `it` per distinct behaviour
- Store actions
- Hooks that contain real logic

**Write an integration test when:**

- A new hook reads from more than one store
- A new flow spans multiple store actions (e.g. scan → assign → split)
- A workflow crosses feature boundaries (e.g. persistence, export/share, currency, or receipt scanning)
- A bug was caused by store/hook wiring — add a regression test

**Don't default to testing:**

- Pure rendering with no meaningful behaviour — prefer testing the underlying logic instead
- Implementation details — assert on outputs and observable state only
- The real Gemini API — mock `analyzeReceiptWithGemini` at the module boundary in `@features/receipt-scanner/api/geminiApi`

---

## Where tests live

| Type        | Location                            |
| ----------- | ----------------------------------- |
| Unit        | Co-located with the file under test |
| Integration | `src/tests/integration/`            |

---

## Patterns

### Naming

Name tests after the scenario, not the function:

```ts
// ✅
it('allocates equal split remainders deterministically', () => { ... });
// ❌
it('computeSplit works', () => { ... });
```

### Expected values

Use concrete values so failures are immediately readable:

```ts
expect(split.subtotalCents).toBe(1000); // ✅
expect(split.subtotalCents).toBe(total); // ❌ — requires chasing `total`
```

### Store tests

Reset stores in `beforeEach` via `useXxxStore.setState(...)`. Mock external calls with `vi.hoisted` + `vi.mock`:

```ts
const { analyzeReceiptWithGemini: mockOcr } = vi.hoisted(() => ({
  analyzeReceiptWithGemini: vi.fn(),
}));

vi.mock('@features/receipt-scanner/api/geminiApi', async (importActual) => {
  const actual = await importActual<typeof import('@features/receipt-scanner/api/geminiApi')>();
  return { ...actual, analyzeReceiptWithGemini: mockOcr };
});
```

### Integration tests

Use the helpers in `src/tests/integration/testHelpers.ts` — `makePerson`, `makeItem`, `makeReceipt`, `seedStore`, `resetAllStores`, `sumValues`. Call `resetAllStores` in `beforeEach`.

---

## Coverage target

80% lines, functions, branches, statements. Run `pnpm test:coverage` to check.
