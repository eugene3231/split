# Receipt Scanning

`src/features/receipt-scanner/` owns scanning end to end: the model call, the response schema, and scan orchestration. A key the user types is used straight from the browser and reaches `sessionStorage` at most, never `localStorage`. The scan server in `server/` holds a shared key for people who have none ([SERVER.md](SERVER.md)). The prompt and the parser live in `logic/scanPrompt.ts` and `logic/receiptParser.ts` so the browser and the server run the same ones.

- **Structured output over prompting.** The prompt stays deliberately minimal; the response schema constrains the model to the exact JSON shape. When extraction is wrong, tighten the schema before reaching for prose.
- **One Zod schema, two jobs.** It is converted to JSON Schema for the request, then used again to validate what comes back. Keep most fields nullable so the model returns `null` rather than hallucinating a value.
- **Normalize after parsing.** Charge detection (`enabled`, `amount`, `percent`, `confidence`, `source`) is derived once the response is parsed: `enabled` is inferred true when `amount` or `percent` is non-zero, whatever the model returned.
- **Tests never hit the network.** Mock the API module at its boundary.

## Choosing how to scan

`resolveScanTransport(key, apiUrl)` in `logic/scanTransport.ts` picks the route. A typed key always scans directly. With no key and `VITE_API_URL` set, the scan goes to the server. With neither, there is no way to scan and the app asks for a key. `scanReceipt` keeps one return type for both routes.

- **Passes.** `api/scanViaServer.ts` sends the photo with a device token kept in `localStorage` under `split.deviceToken`. With no token, or after a 401, it runs the Turnstile check once, mints a token through `api/deviceToken.ts`, and tries the scan once more. A second refusal becomes `unknown`.
- **Turnstile loads on demand.** `TurnstileCheck` shows the widget only while a mint is waiting, and adds the Cloudflare script then. It uses `VITE_TURNSTILE_SITE_KEY`. Local dev and previews use Cloudflare's always-pass test key `1x00000000000000000000AA`.
- **Errors.** The server's reply carries a `kind`. `ScanError` holds it, and `describeScanError` in `logic/scanError.ts` turns it into the sentence the user reads. Every kind except `bad-image` and `needs-device` calls `onNeedsKey`, which opens the key modal with that sentence. The status table in `src/shared/api/scan.ts` is used only when a reply has no readable body.
