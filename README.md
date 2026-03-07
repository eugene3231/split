# Split (React + Tailwind + Google Gemini)

https://split-receipt.netlify.app/

Ever paid the full bill and then struggled to calculate exactly how much each person owes, especially when everyone ordered different items?

Split uses Google Gemini to scan receipt images and split costs at the line-item level, so each person pays for exactly what they ordered and you know precisely how much to collect from everyone.

<img width="2926" height="3458" alt="Screenshot 2026-03-07 at 19-00-44 split" src="https://github.com/user-attachments/assets/61748992-d4c1-4b10-b004-355736b98db6" />

## What it does

- Manually add people (no invites/accounts)
- Scan a receipt with Google Gemini GAI extraction
- Auto-detect line items, GST/tax, and service charge
- Override GST/service toggles and values manually
- Assign each line item to one person or equal-split across selected people
- Select all / select none members per item when in equal-split mode
- Apply percentage discount on each line item
- Autosave line items, charges, and final split snapshot to localStorage
- Show final per-person payable amount with item, service, and GST breakdown
- Generate a single sharable image to send to your group chat for bill collection

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
