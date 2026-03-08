# Project Overview

## What Is This?

**Split** is a browser-only bill-splitting app that uses Google Gemini's vision AI to scan receipts and automatically divide costs between people.

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
- **Zustand** — State management (`receiptWorkspaceStore` for receipt data, `receiptUiStore` for UI state)
- **Zod** — Schema validation for Gemini API responses
- **Vitest + Testing Library** — Unit testing

## Repository Structure

```
src/
  features/
    item-assignment/       # UI for assigning items to people
    receipt-import/        # Gemini API integration and OCR parsing
    receipt-setup/         # Add people, configure global charges
    receipt-workspace/     # Central store (Zustand), Simple/Advanced workspace UIs
    split-summary/         # Per-person breakdown display and export (PNG/text)
  pages/
    ReceiptSplitterPage.tsx          # Root page component
    hooks/useReceiptSplitterController.ts
  shared/
    types.ts               # Core types: Person, EditableItem, ChargeState, SplitResult
    constants.ts           # Defaults, Gemini model IDs, storage keys
    logic/
      computation/         # computeSplit() and charge calculation engine
      assignment/          # Item assignment utilities
      core/                # ID generation, money parsing/formatting
    stores/                # receiptUiStore (Gemini API key, scan state, UX mode)
    utils/                 # personColors (per-person colour palette)
```

**Key files:**
- `src/features/receipt-workspace/store/receiptWorkspaceStore.ts` — Central state
- `src/features/receipt-import/logic/ocr.ts` — Gemini API call
- `src/shared/logic/computation/split.ts` — Split calculation engine
- `src/shared/types.ts` — All core types

## Best Practices
- Recompute as much of the data that needs to be displayed as much as possible e.g. in shared/logic/computation/split.ts
- Design the components in the way that they are as dumb as possible as they should just render what is given to them without any computation logic as much as possible


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

### Use `useReducer` for complex state transitions
When state has multiple sub-values or next state depends on previous, prefer `useReducer` over multiple `useState` calls.

---

## Avoiding useEffect

`useEffect` is often a code smell. Before reaching for it, ask: *can this be derived, event-driven, or handled in the render cycle?*

### ❌ Common useEffect anti-patterns to avoid

**Syncing state to state** — derive it instead:
```tsx
// ❌
const [firstName, setFirstName] = useState('');
const [fullName, setFullName] = useState('');
useEffect(() => { setFullName(`${firstName} ${lastName}`); }, [firstName]);

// ✅
const fullName = `${firstName} ${lastName}`;
```

**Fetching on mount with no abstraction** — use a data-fetching library:
```tsx
// ❌ Fragile, no loading/error handling, race conditions
useEffect(() => { fetch('/api/data').then(r => r.json()).then(setData); }, []);

// ✅ Use TanStack Query, SWR, or a loader pattern (React Router, Next.js)
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
```

**Responding to events** — use event handlers:
```tsx
// ❌
useEffect(() => { if (submitted) { processForm(); } }, [submitted]);

// ✅
function handleSubmit() { processForm(); }
```

**Initialising state from props** — set it in the initial value:
```tsx
// ❌
const [value, setValue] = useState('');
useEffect(() => { setValue(props.initialValue); }, [props.initialValue]);

// ✅
const [value, setValue] = useState(props.initialValue);
```

### ✅ When useEffect IS appropriate
- Subscribing to external systems (WebSockets, browser APIs, third-party libraries)
- Running imperative DOM manipulations that can't be expressed declaratively
- Synchronising with non-React systems (analytics, logging on mount)

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

export function cn(...inputs) { return twMerge(clsx(inputs)); }

// Usage
<div className={cn('px-4 py-2', isActive && 'bg-blue-500', className)} />
```

### Avoid inline style for things Tailwind can handle
```tsx
// ❌
<div style={{ marginTop: '16px' }} />

// ✅
<div className="mt-4" />
```

### Define design tokens in `tailwind.config`
Don't scatter magic values. Use the config for colours, spacing, fonts, breakpoints.

### Keep class lists readable — extract components early
If a class list is getting long (>6–8 classes), it's a sign the element should become its own component or use `cva` for variants.

### Use `cva` for variant-driven components
```tsx
import { cva } from 'class-variance-authority';

const button = cva('rounded font-medium transition', {
  variants: {
    intent: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      ghost:   'bg-transparent text-blue-600 hover:bg-blue-50',
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-base',
    },
  },
  defaultVariants: { intent: 'primary', size: 'md' },
});
```

---

## Data Fetching

- Use **TanStack Query** or **SWR** for server state — not `useState` + `useEffect`
- Use **React Router loaders** or **Next.js** `getServerSideProps`/RSC for route-level data
- Colocate query definitions near the components that use them
- Separate server state (remote data) from client state (UI state)

---

## Performance

### Prefer stable references
Define functions and objects outside components when they don't depend on props/state.

### Virtualise long lists
For lists over ~100 items, use `@tanstack/react-virtual` or a similar solution.

---

## TypeScript

- Prefer `interface` for object shapes, `type` for unions/intersections
- Avoid `any` — use `unknown` with type narrowing if the type is truly dynamic
- Type component props explicitly; don't rely on inference from defaultProps
- Use `ComponentProps<typeof X>` to extend or wrap existing component types

---

## File & Folder Structure

```
src/
  components/       # Shared, reusable UI components
  features/         # Feature-scoped components, hooks, utils
  hooks/            # Shared custom hooks
  logic/            # Testable logic, preferably pure functions.
  types/            # Shared TypeScript types
```

Co-locate tests, stories, and styles with the component they belong to.

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
