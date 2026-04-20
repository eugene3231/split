# Project Overview

## What Is This?

**Split** is a browser-only, no backend, no auth bill-splitting app that uses Google Gemini's vision AI to scan receipts and automatically divide costs between people.

**User workflow:**

1. **Add people** — Enter names for everyone splitting the bill
2. **Scan receipt** — Upload a receipt image; Gemini extracts line items, tax, and service charges
3. **Assign items** — Assign each item to one or more people (equal split or custom)
4. **View summary** — See each person's itemized total including their share of tax/service/discounts
5. **Export/share** — Download as a PNG image or copy a text summary

**Key features:**

- Gemini-powered OCR (no backend — calls Gemini directly from the browser)
- Per-item discounts and global charges (tax, service charge, global discount)
- Multi-currency receipts with exchange rate conversion (base currency: SGD)
- PayNow QR code generation per person so they can pay directly from the summary screen
- Auto-save to localStorage — progress persists across page refreshes
- Export as PNG or share/copy text summary for group chats

## Tech Stack

- **React 19 + TypeScript + Vite** — UI framework and build tooling
- **Tailwind CSS 4** — Utility-first styling
- **Zustand** — State management (split into `receiptStore`, `scanStore`, `geminiStore`, `currencyStore`)
- **Zod** — Schema validation for Gemini API responses
- **Vitest + Testing Library** — Unit testing

## Best Practices

- Prefer recomputing derived data (e.g. in `shared/logic/computation/split.ts`) over storing it
- Keep route shells thin. Feature components may own feature-local store selection when that reduces prop-drilling and keeps ownership local.

## Architecture Rules

- **`pages/`** contains route entrypoints only. No workflow logic, step logic, or feature-owned hooks.
- **`features/<name>/`** owns the full implementation of a capability: components, hooks, logic, stores, state access, persistence, and feature-scoped UI.
- **`shared/`** contains only primitives reused across **multiple features**. "Used by multiple pages in one workflow" does not qualify.
- Default rule: start local to a feature, then promote to `shared/` only after real cross-feature reuse.
- Stores live under their owning feature, not in a top-level `src/stores`.

## Repository Structure

```
src/
  features/
    workspace/             # Full bill-splitting workflow: wizard, steps, stores, persistence
      components/          # Workspace UI (steps/, shared/ UI components)
      hooks/               # useWizard, useReceiptSplitterController, useReceiptSplit, etc.
      logic/               # wizardState, wizardValidation, summaryView, persistence + storage helpers
      stores/              # receiptStore, geminiStore, currencyStore
      api/                 # exchangeRateApi
      types.ts             # WizardStep, ItemsSubPhase, WizardProgressContext
      index.ts             # Public entrypoint (Workspace, GeminiApiKeyModal)
    receipt-scanner/       # Gemini OCR: API call, parsing, scan state, loading ticker, scan orchestration
      hooks/               # useLoadingTicker
      logic/               # ocr payload application, gemini-schema, itemMapper, loadingMessages, geminiModel
      services/            # scanReceipt orchestration
      stores/              # scanStore
      index.ts             # Public entrypoint
    payments/              # QR generation and PayNow adapter
      qr/logic/            # Generic QR rendering/data-url helpers
      paynow/logic/        # paynow (mobile normalisation, payload), paynowQr (PayNow adapter)
      index.ts             # Public entrypoint
    split-results/         # Split export (PNG/text) — logic only, no legacy components
  pages/
    ReceiptSplitterPage.tsx  # Thin route shell — imports from @features/workspace
  shared/
    types.ts               # Core types: Person, EditableItem, ChargeState, SplitResult
    constants.ts           # App-wide defaults only
    logic/
      computation/         # computeSplit() and charge calculation engine
      assignment/          # Item assignment utilities
      core/                # ID generation, money parsing/formatting, exchange rates
    utils/
      personColors.ts      # Per-person colour palette
```

**Key files:**

- `src/features/workspace/stores/receiptStore.ts` — Workspace state (people, receipts, items, assignments)
- `src/features/receipt-scanner/stores/scanStore.ts` — Per-receipt scan state (loading, errors, warnings)
- `src/features/workspace/stores/geminiStore.ts` — API key, model selection, modal visibility
- `src/features/workspace/stores/currencyStore.ts` — Exchange rate fetching and caching (base currency: SGD)
- `src/features/payments/index.ts` — Payments feature public API (generic QR helpers + PayNow adapter)
- `src/shared/logic/core/exchangeRates.ts` — Currency conversion helpers
- `src/features/receipt-scanner/api/geminiApi.ts` — Gemini API call + response parsing entrypoint
- `src/features/receipt-scanner/services/scanReceipt.ts` — Scan orchestration and scan-state transitions
- `src/features/receipt-scanner/logic/gemini-schema.ts` — Zod schema (constrains Gemini output + validates response)
- `src/shared/logic/computation/split.ts` — Split calculation engine
- `src/shared/types.ts` — All core types

## Gemini Integration

Models are defined in `src/features/receipt-scanner/constants.ts`

The prompt is intentionally minimal — the response schema does the heavy lifting. Gemini's controlled generation (`responseSchema` in `generationConfig`) constrains the model to return exactly the right JSON shape.

The Zod schema in `gemini-schema.ts` serves dual purpose: converted to JSON Schema for the API request, and used again to validate the parsed response. Most fields are nullable so the model returns `null` rather than hallucinate. `stripUnsupportedSchemaFields` removes keys (`$schema`, `additionalProperties`) that Zod emits but Gemini's API rejects.

Charge detection (`enabled`, `amount`, `percent`, `confidence`, `source`) is normalized after parsing — `enabled` is inferred true if `amount` or `percent` is non-zero, regardless of what the model returned.

---

# React + Tailwind Best Practices

## Core Philosophy

Prefer simple, readable, and predictable code. Favour data-down, actions-up. Keep components small and focused.

---

## State Management

### Prefer derived state over stored state

```tsx
// ❌ Avoid — redundant state that must be kept in sync
const [items, setItems] = useState([...]);
const [count, setCount] = useState(0);

// ✅ Prefer — derive count from items
const [items, setItems] = useState([...]);
const count = items.length;
```

### Collocate state as low as possible

Don't lift state higher than necessary. If only one component needs it, keep it there.

---

## Avoiding useEffect

`useEffect` is often a code smell. Before reaching for it, ask: _can this be derived, event-driven, or handled in the render cycle?_

### ❌ Common useEffect anti-patterns to avoid

**Syncing state to state** — derive it instead:

```tsx
// ❌
const [firstName, setFirstName] = useState('');
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName]);

// ✅
const fullName = `${firstName} ${lastName}`;
```

**Responding to events** — use event handlers:

```tsx
// ❌
useEffect(() => {
  if (submitted) {
    processForm();
  }
}, [submitted]);

// ✅
function handleSubmit() {
  processForm();
}
```

**Initializing state from props** — set it in the initial value:

```tsx
// ❌
const [value, setValue] = useState('');
useEffect(() => {
  setValue(props.initialValue);
}, [props.initialValue]);

// ✅
const [value, setValue] = useState(props.initialValue);
```

### ✅ When useEffect IS appropriate

- Subscribing to external systems (WebSockets, browser APIs, third-party libraries)
- Running imperative DOM manipulations that can't be expressed declaratively
- Synchronizing with non-React systems (analytics, logging on mount)
- **Cleanup only** — the effect body does nothing; only the returned cleanup function runs

### Deriving side-effectful values (e.g. object URLs)

When a value requires a side effect to produce (e.g. `URL.createObjectURL`) but logically derives from a prop/state, use `useMemo` to compute it and a paired `useEffect` for cleanup. Do **not** call `setState` inside an effect body, and do **not** read/write `ref.current` during render — both are lint errors in this codebase.

```tsx
// ✅ useMemo derives the value; useEffect handles cleanup only
const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

useEffect(() => {
  return () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };
}, [previewUrl]);
```

```tsx
// ❌ setState inside effect body — lint error (react-hooks/set-state-in-effect)
useEffect(() => {
  setPreviewUrl(file ? URL.createObjectURL(file) : null);
}, [file]);

// ❌ Refs during render — lint error (react-hooks/refs)
const urlRef = useRef<string | null>(null);
urlRef.current = file ? URL.createObjectURL(file) : null; // in render body
```

---

## Components

### Keep components small and single-purpose

If a component needs a long comment explaining what it does, it should probably be split.

### Prefer composition over configuration

```tsx
// ❌ Prop-drilling configuration
<Card title="Hello" footer="Bye" hasImage showBorder />

// ✅ Composable slots
<Card>
  <Card.Header>Hello</Card.Header>
  <Card.Body><img /></Card.Body>
  <Card.Footer>Bye</Card.Footer>
</Card>
```

### Use early returns for guard clauses

```tsx
// ✅
if (!user) return <LoginPrompt />;
if (isLoading) return <Spinner />;
return <Dashboard user={user} />;
```

### Avoid prop drilling beyond 2 levels

Use composition, context, or a state manager instead.

---

## Tailwind Usage

### Use `cn()` for conditional classes

Always merge classes with a utility like `clsx` + `tailwind-merge`:

```tsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn('px-4 py-2', isActive && 'bg-blue-500', className)} />;
```

### Avoid inline style for things Tailwind can handle

```tsx
// ❌
<div style={{ marginTop: '16px' }} />

// ✅
<div className="mt-4" />
```

### Define design tokens in `@theme`

Tailwind v4 uses CSS `@theme` blocks — don't scatter magic values, define colors, spacing, and fonts there.

### Keep class lists readable — extract components early

If a class list is getting long (>6–8 classes), it's a sign the element should become its own component.

---

## Performance

### Prefer stable references

Define functions and objects outside components when they don't depend on props/state.

---

## TypeScript

- Prefer `interface` for object shapes, `type` for unions/intersections
- Avoid `any` — use `unknown` with type narrowing if the type is truly dynamic
- Type component props explicitly; don't rely on inference from defaultProps
- Use `ComponentProps<typeof X>` to extend or wrap existing component types

---

## File & Folder Structure

- `features/` — domain features, each with `components/`, `hooks/`, `logic/`, `index.ts`
- `pages/` — page-level orchestration; `components/workspace/` contains the wizard steps and shared UI
- `shared/` — cross-cutting logic, hooks, stores, and types used across features and pages

Co-locate tests with the file they test. Use `logic/` for pure functions, `hooks/` for stateful abstractions.

---

## Custom Hooks

Extract logic into a custom hook when:

- The same stateful logic is needed in 2+ components
- A component's logic is complex enough to warrant its own test file
- You're encapsulating a browser API or side effect

Name hooks `use[Noun]` (e.g. `useMediaQuery`, `useLocalStorage`).

---

## General

- Delete dead code — don't comment it out
- Prefer named exports for components (easier to refactor/search)
- Keep `index.ts` barrel files shallow — deep barrels slow down builds

---

# Testing

See [TESTING.md](./TESTING.md) for the full testing guide, patterns, and examples.

**Short version:** test logic (pure functions, store actions, hooks), skip components. Every new feature must ship with tests.
