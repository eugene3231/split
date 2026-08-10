# Receipt Scanning

`src/features/receipt-scanner/` owns scanning end to end: the model call, the response schema, and scan orchestration. The model is called straight from the browser, so there is no backend to hold a key — the user supplies one, and it reaches `sessionStorage` at most, never `localStorage`.

- **Structured output over prompting.** The prompt stays deliberately minimal; the response schema constrains the model to the exact JSON shape. When extraction is wrong, tighten the schema before reaching for prose.
- **One Zod schema, two jobs.** It is converted to JSON Schema for the request, then used again to validate what comes back. Keep most fields nullable so the model returns `null` rather than hallucinating a value.
- **Normalize after parsing.** Charge detection (`enabled`, `amount`, `percent`, `confidence`, `source`) is derived once the response is parsed: `enabled` is inferred true when `amount` or `percent` is non-zero, whatever the model returned.
- **Tests never hit the network.** Mock the API module at its boundary.
