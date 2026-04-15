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
- Simple mode (4-step wizard) and Advanced mode (more granular control)
- Per-item discounts and global charges (tax, service charge, global discount)
- Auto-save to localStorage — progress persists across page refreshes
- Export as PNG or text summary for sharing in group chats

## Tech Stack

- **React 19 + TypeScript + Vite** — UI framework and build tooling
- **Tailwind CSS 4** — Utility-first styling
- **Zustand** — State management (`receiptStore` for all receipt data and actions)
- **Zod** — Schema validation for Gemini API responses
- **Vitest + Testing Library** — Unit testing

## Best Practices

- Prefer recomputing derived data (e.g. in `shared/logic/computation/split.ts`) over storing it
- Keep components dumb — they should render what they're given, not compute it

## Repository Structure

```
src/
  features/
    receipt-scanner/       # Gemini API integration, OCR parsing, scan UI
    split-results/         # Split export (PNG/text) — logic only, no legacy components
  pages/
    ReceiptSplitterPage.tsx          # Root page component
    types.ts                         # Wizard-specific types (SimpleWizardStep etc.)
    components/
      workspace/
        Workspace.tsx                # Main workspace (4-step wizard)
        TopAppBar.tsx
        BottomNav.tsx
        ProgressIndicator.tsx
        GeminiApiKeyModal.tsx
        shared/                      # Reusable UI components
        steps/                       # One component per wizard step/phase
    hooks/
      useReceiptSplitterController.ts  # Init, persistence
      useSimpleWizard.ts               # Wizard step/phase state machine
    logic/
      persistence.ts       # Wizard state save/load (localStorage)
      wizardState.ts       # Step resolution logic
      wizardValidation.ts  # Per-step validation
  shared/
    types.ts               # Core types: Person, EditableItem, ChargeState, SplitResult
    constants.ts           # Defaults, Gemini model IDs, storage keys
    api/
      storage.ts           # localStorage read/write helpers
    hooks/
      useDraftPersistence.ts  # Auto-saves receipt state to localStorage
      useReceiptSplit.ts      # Derives split result and reconciliation helpers
    logic/
      computation/         # computeSplit() and charge calculation engine
      assignment/          # Item assignment utilities
      core/                # ID generation, money parsing/formatting
    stores/
      receiptStore.ts      # Central Zustand store: all receipt data and actions
    utils/
      personColors.ts      # Per-person colour palette
```

**Key files:**

- `src/shared/stores/receiptStore.ts` — Central Zustand store
- `src/features/receipt-scanner/logic/ocr.ts` — Gemini API call
- `src/features/receipt-scanner/logic/gemini-schema.ts` — Zod schema (constrains Gemini output + validates response)
- `src/shared/logic/computation/split.ts` — Split calculation engine
- `src/shared/types.ts` — All core types

## Gemini Integration

Models are defined in src/shared/constants.ts

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
- `pages/` — page-level orchestration; `components/` split into `advanced/` and `simple/` sub-folders
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
