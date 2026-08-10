---
paths:
  - 'src/**/*.{ts,tsx}'
---

# React and TypeScript conventions

Prefer composition over configuration: composable slots (`<Card.Header>`) over a wide prop API (`hasImage`, `showBorder`, `footer`). Keep components small enough that they need no explanatory comment, use early returns for guard clauses, and collocate state as low as it will go.

Before writing a `useEffect`, check whether the value can be derived during render, handled in an event handler, or passed as an initial state value instead.

Conventions, examples, and the effect anti-patterns in full: [docs/REACT-TYPESCRIPT.md](../../docs/REACT-TYPESCRIPT.md).
