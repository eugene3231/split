---
paths:
  - '**/*.test.{ts,tsx}'
  - 'src/tests/**/*.ts'
---

# Testing

Co-locate unit tests with the file under test, and step-private tests inside the step folder. Cross-feature integration tests go in `src/tests/integration/`, using the helpers in `testHelpers.ts` with `resetAllStores` in `beforeEach`.

Mock external APIs at the module boundary — never the real model API. Assert on outputs, observable state, and stable UI contracts rather than exact copy.

Patterns, examples, and the coverage target: [docs/TESTING.md](../../docs/TESTING.md).
