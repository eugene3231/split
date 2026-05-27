# Split

[![codecov](https://codecov.io/github/eugene3231/split/graph/badge.svg?token=CZ39ES2EU9)](https://codecov.io/github/eugene3231/split)

https://split-receipt.netlify.app/

Snap a photo of your bill and Split reads every line item — including tax, charges, and the total. Shared a dish? Split it between whoever had some. Didn't touch the wine? Don't pay for it.

Scan a receipt, assign items, and share the result via image or text — no accounts or invites needed.

<img width="100%" alt="Screenshot 2026-03-22 at 11-43-58 split" src="https://github.com/user-attachments/assets/d7e76e8e-f8ba-4faf-8a06-3893b5d18096" />

## Key Features

- **Receipt scanning** — scan a receipt image using Google Gemini to auto-detect line items, taxes, and service charge
- **Manual user overrides** — edit any extracted item or charge before finalizing
- **Flexible item assignment** — assign items to one person, split equally, or split by custom share weights (e.g. 2:1) across selected people, with per-item discount support
- **Per-person breakdown** — view each person's total with a full item, taxes, and service charge breakdown
- **Auto-save** — progress is saved to localStorage so nothing is lost on refresh
- **Multi-currency** — each receipt can use a different currency, with live exchange rates and a toggle to view totals in SGD
- **PayNow QR** — enter your PayNow mobile number and per-person QR codes are generated for instant payment (also embedded in exported images)
- **Shareable summary** — export as an image or text summary to send to your group chat for easy bill collection

## Stack

- Vite + React + TypeScript
- Zustand for state management
- Tailwind CSS v4
- Google Gemini API (`generateContent`) for receipt extraction

## Architecture

Project structure, feature ownership, and split-workspace layering live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Testing

Testing conventions, layout, and mocking guidance live in [docs/TESTING.md](docs/TESTING.md).

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
- Currently there is no dedicated backend, future work will include integrating with one to allow persistent API key management per user.
- OCR extraction is largely correct but users are still able to edit items/amounts before finalizing.
- Draft fields reset when a new receipt image is uploaded.
