# Split (React + Tailwind + Google Gemini)

https://split-receipt.netlify.app/

Ever paid the full bill and had to figure out who owes what — when everyone ordered different things, some dishes were shared, and others weren't? Split uses Google Gemini to split costs at the line-item level. 

Scan a receipt, assign items, and share the result — no accounts or invites needed.

<img width="100%" alt="Screenshot 2026-03-07 at 19-00-44 split" src="https://github.com/user-attachments/assets/61748992-d4c1-4b10-b004-355736b98db6" />

## Key Features

- **Receipt scanning** — scan a receipt image using Google Gemini to auto-detect line items, taxes, and service charge
- **Flexible item assignment** — assign items to one person or split equally across selected people, with per-item discount support
- **Manual overrides** — edit any extracted item or charge before finalising
- **Per-person breakdown** — view each person's total with a full item, taxes, and service charge breakdown
- **Auto-save** — progress is saved to localStorage so nothing is lost on refresh
- **Shareable summary** — export as an image or text summary to send to your group chat for easy bill collection

## Stack

- Vite + React + TypeScript
- Zustand for state management
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
