---
paths:
  - 'src/features/receipt-scanner/**/*.ts'
---

# Receipt scanning

The prompt stays minimal — the response schema does the constraining, so tighten the schema before reaching for prose. Never trust the model's own flags: charge detection is normalized after parsing. Tests mock the API module at its boundary rather than hitting the network.

Full pipeline and the reasoning behind it: [docs/RECEIPT-SCANNING.md](../../docs/RECEIPT-SCANNING.md).
