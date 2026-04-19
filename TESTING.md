# Testing Guide

## Rule

Every new feature or bug fix must ship with tests. No exceptions.

---

## Unit vs integration

**Unit tests** test one function, store action, or hook in isolation. Fast, pinpoint failures.

**Integration tests** test that multiple stores and hooks wire together correctly — they catch bugs unit tests miss (e.g. a hook returning stale data after a store mutation).

---

## What to test

**Always test:**

- Pure functions in `logic/` — one `it` per distinct behaviour
- Store actions
- Hooks that contain real logic

**Write an integration test when:**

- A new hook reads from more than one store
- A new flow spans multiple store actions (e.g. scan → assign → split)
- A bug was caused by store/hook wiring — add a regression test

**Don't test:**

- Component rendering — test the logic the component calls instead
- Implementation details — assert on outputs and observable state only
- The Gemini API — mock `analyzeReceiptWithGemini` at the module boundary

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

vi.mock('@features/receipt-scanner/logic/ocr', async (importActual) => {
  const actual = await importActual<typeof import('@features/receipt-scanner/logic/ocr')>();
  return { ...actual, analyzeReceiptWithGemini: mockOcr };
});
```

### Integration tests

Use the helpers in `src/tests/integration/testHelpers.ts` — `makePerson`, `makeItem`, `makeReceipt`, `seedStore`, `resetAllStores`, `sumValues`. Call `resetAllStores` in `beforeEach`.

---

## Coverage target

80% lines, functions, branches, statements. Run `pnpm test:coverage` to check.
