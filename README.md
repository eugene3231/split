# Split (React + Tailwind + Google Gemini)

[![codecov](https://codecov.io/github/eugene3231/split/graph/badge.svg?token=CZ39ES2EU9)](https://codecov.io/github/eugene3231/split)

https://split-receipt.netlify.app/

Ever paid the full bill and had to figure out who owes what — when everyone ordered different things, some dishes were shared, and others weren't? Split uses Google Gemini to split costs at the line-item level.

Scan a receipt, assign items, and share the result — no accounts or invites needed.

<img width="100%" alt="Screenshot 2026-03-22 at 11-43-58 split" src="https://github.com/user-attachments/assets/d7e76e8e-f8ba-4faf-8a06-3893b5d18096" />

## Key Features

- **Receipt scanning** — scan a receipt image using Google Gemini to auto-detect line items, taxes, and service charge
- **Flexible item assignment** — assign items to one person or split equally across selected people, with per-item discount support
- **Manual overrides** — edit any extracted item or charge before finalising
- **Per-person breakdown** — view each person's total with a full item, taxes, and service charge breakdown
- **Auto-save** — progress is saved to localStorage so nothing is lost on refresh
- **Multi-currency** — each receipt can use a different currency, with live exchange rates and a toggle to view totals in SGD
- **PayNow QR** — enter your PayNow mobile number and per-person QR codes are generated for instant payment (also embedded in exported images)
- **Shareable summary** — export as an image or text summary to send to your group chat for easy bill collection

## Stack

- Vite + React + TypeScript
- Zustand for state management
- Tailwind CSS v4
- Gemini API (`generateContent`) for receipt extraction

## Architecture

- `src/pages` contains route shells only.
- `src/features/<name>` owns each capability end to end: components, hooks, stores, logic, feature-scoped API helpers, and reusable UI within that feature.
- `src/shared` is only for primitives reused across multiple features.
- Default rule: start local to a feature, promote to `shared` only after real cross-feature reuse appears.
- Stores live under the feature that owns the state. There is no top-level `src/stores`.

Current feature ownership:

- `features/split-workspace` owns the bill-splitting workflow, wizard, receipt state, Gemini settings state, currency state, and summary/export wiring.
- `features/receipt-scanner` owns Gemini OCR analysis, parsing, scan lifecycle state, loading messages, and scan orchestration.
- `features/payments` owns generic QR generation plus the PayNow adapter.
- `features/sharing` owns exported image/text generation.

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Start app:

```bash
pnpm dev
```

3. Open the Vite URL and use the app.

4. In `Scan Receipt Image`:

- Enter your Gemini API key
- Select model
- Optional: enable `Remember API key for this browser session`

## Mock receipt

Use the `Load Mock Receipt` button in the UI to populate sample items and charges instantly to test out how it works

## Notes

- In this setup, Gemini is called directly from the browser.
- API key is never persisted to localStorage. If enabled, it is stored only in `sessionStorage` for the current browser session.
- Consider routing through a dedicated backend so API keys are not exposed client-side.
- OCR extraction can still be imperfect; users are able to edit items/amounts before finalizing.
- Draft fields reset when a new receipt image is uploaded.
- Internal helpers are private by default; feature entrypoints should be preferred over deep imports.
