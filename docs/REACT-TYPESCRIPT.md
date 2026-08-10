# React and TypeScript Conventions

[AGENTS.md](../AGENTS.md) carries the rules that apply to every edit — derive rather than store, and the two `react-hooks` lint errors. This is the detail behind them, plus the component and TypeScript conventions.

## Components

**Prefer composition over configuration.** A wide prop API is the default instinct; composable slots keep it smaller and clearer.

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

Small focused prop APIs are still fine — this is a heuristic, not a rule.

Keep components small and single-purpose: if a component needs a long comment explaining what it does, split it. Use early returns for guard clauses. Avoid prop drilling beyond about two levels — reach for composition, context, or a feature store when data and actions crossing layers start obscuring ownership.

## State

Derive rather than store, and collocate state as low as it will go. If only one component needs it, keep it there.

```tsx
// ❌ Redundant state that must be kept in sync
const [items, setItems] = useState([...]);
const [count, setCount] = useState(0);

// ✅ Derive
const [items, setItems] = useState([...]);
const count = items.length;
```

## useEffect

Treat it as a tool with a high misuse rate. Before reaching for it, ask whether the value can be derived, handled by an event handler, or set during render.

```tsx
// ❌ Syncing state to state          → ✅ derive it
useEffect(() => setFullName(`${first} ${last}`), [first]);
const fullName = `${first} ${last}`;

// ❌ Responding to an event          → ✅ do it in the handler
useEffect(() => {
  if (submitted) processForm();
}, [submitted]);
function handleSubmit() {
  processForm();
}

// ❌ Initializing state from a prop  → ✅ use the initial value
useEffect(() => setValue(props.initialValue), [props.initialValue]);
const [value, setValue] = useState(props.initialValue);
```

It is the right tool for subscribing to external systems (WebSockets, browser APIs, third-party libraries), imperative DOM work that can't be expressed declaratively, synchronizing with non-React systems, and cleanup-only effects where the body does nothing.

For a value that logically derives from props or state but needs a side effect to produce, `useMemo` computes it and a paired `useEffect` cleans it up. `react-hooks/set-state-in-effect` and `react-hooks/refs` are errors in this repo, so neither `setState` in an effect body nor ref access during render will pass lint.

```tsx
// ✅
const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

useEffect(() => {
  return () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };
}, [previewUrl]);
```

## Custom hooks

Extract a hook when the same stateful logic is needed in two or more components, when a component's logic is complex enough to warrant its own test file, or when you're encapsulating a browser API or side effect. Name them `use[Noun]` — `useMediaQuery`, `useLocalStorage`.

## TypeScript

- `interface` for object shapes, `type` for unions and intersections
- Avoid `any`; use `unknown` with narrowing when a type is genuinely dynamic
- Type component props explicitly
- `ComponentProps<typeof X>` to extend or wrap an existing component's types

## General

Delete dead code rather than commenting it out. Prefer named exports for components — easier to refactor and search.
