# Split (React + Tailwind + Gemini)

Ever paid the full bill and then struggled to calculate exactly how much each person owes?

Split uses Google Gemini to scan receipt images and splits costs at the line-item level, so you can see precisely how much to collect from each person.

<img width="924" height="900" alt="Screenshot 2026-02-08 at 23-08-14 split" src="https://github.com/user-attachments/assets/c9b5f2f0-34c0-410c-94ae-f7a4b6b82a3b" />

## What it does

- Manually add people (no invites/accounts)
- Scan a receipt with Gemini vision extraction
- Auto-detect line items, GST/tax, and service charge
- Override GST/service toggles and values manually
- Assign each line item to one person or equal-split across selected people
- Select all / select none members per item when in equal-split mode
- Apply percentage discount on each line item
- Autosave line items, charges, and final split snapshot to localStorage
- Show final per-person payable amount with item, service, and GST breakdown

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Gemini API (`generateContent`) for receipt extraction

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
- Select model (`gemini-3-flash-preview`)
- Optional: enable `Remember API key for this browser session`

## Mock receipt

Use the `Load Mock Receipt` button in the UI to populate sample items and charges instantly to test out how it works

## Notes

- In this setup, Gemini is called directly from the browser.
- API key is never persisted to localStorage. If enabled, it is stored only in `sessionStorage` for the current browser session.
- To consider routing through your a dedicated backend so API keys are not exposed client-side.
- OCR extraction can still be imperfect; users are able to edit items/amounts before finalizing.
- Draft fields reset when a new receipt image is uploaded.

## Build

```bash
pnpm build
```
