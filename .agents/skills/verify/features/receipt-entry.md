# Receipt entry

The Receipt step is where a user records what was on the bill: items and prices, charges such as service charge and GST, the receipt's currency, and the printed total to check against. Items can be typed by hand or read from a photo by Gemini.

## Sub-features

- `receipt-items` types item names and prices, and adds more rows. **Proven by `manual-split`.**
- `receipt-charges` turns charges on or off and sets them as a percent or an amount. **Not yet driven.**
- `receipt-currency` changes the receipt currency. **Not yet driven.**
- `receipt-printed-total` enters the printed total and shows the reconciliation notice when it differs. **Not yet driven.**
- `receipt-multi` adds a second receipt as a tab. **Not yet driven.**
- `receipt-scan` uploads a photo and fills items and charges from Gemini. **Proven by `receipt-scan`.**

## How to get to it (user POV)

- From People with at least one person, choose the bottom-bar continue button.
- From any step, choose `Step 2: Receipt` in the step nav.

## Driving it with verify.mjs

Preconditions:

- At least one person exists (add them on People, or load a test split).
- The first visit opens the `Gemini API key` dialog. Close it with `page.getByRole('dialog', { name: 'Gemini API key' }).getByRole('button', { name: 'Skip' }).click()` unless you are scanning.

- **Type items.** A new receipt starts with one blank row. Fill it with `page.getByPlaceholder('Item name').last().fill('Laksa')` and `page.getByRole('textbox', { name: 'Price' }).last().fill('12.00')`. Add the next row with `page.getByTestId('receipt-add-item-btn').click()`. The Items count beside the heading goes up and the totals panel updates.
- **Charges.** Each charge is a `switch` named after it (for example `Service Charge`). Its value field is named `<label> percent` or `<label> amount`, and `<label> as an amount` and `<label> as a percent` flip the mode.
- **Currency.** Run `page.getByRole('combobox', { name: 'Receipt currency' }).selectOption('IDR')` (a native `select`). Prices re-render with that currency's symbol.
- **Printed total.** Run `page.getByTestId('receipt-total-input').fill('20.00')`. A reconciliation notice appears when it differs from the computed total.
- **Another receipt.** Run `page.getByRole('button', { name: 'Add receipt' }).click()` (`receipt-add-receipt-btn`). A new tab appears in the `Receipts` tab list.
- **Scan.** Copy `journeys/receipt-scan.mjs`. It answers Gemini with `page.route('https://generativelanguage.googleapis.com/**', …)` and a body `{ candidates: [{ content: { parts: [{ text: JSON.stringify(receipt) }] } }] }`, where `receipt` matches `geminiReceiptSchema` in `src/features/receipt-scanner/logic/gemini-schema.ts`. In the dialog, fill `getByRole('textbox', { name: 'API key', exact: true })` with any string and choose `Save`. Upload with `getByTestId('receipt-file-input').setInputFiles({ name, mimeType, buffer })`, then click `scan-receipt-btn`. `scan-shimmer` shows until the route answers, then the item rows hold the scanned items and each detected charge shows `Detected via <source>`.
- **Proof.** `aria('receipt', page.getByTestId('wizard-step-panel'))` and `storage()['split:receipt-draft:v1'].receipts`.

## Gotchas

- New receipts start with Service Charge 10% and GST 9% switched on. $15.00 of items totals $17.99, not $15.00.
- The `Gemini API key` dialog covers the step on first visit and blocks every click until closed.
- The Gemini key is stored in `sessionStorage` only, so a fresh run never has one.
- Never scan against the real Gemini API from a journey. It needs the user's key and costs money.
- `getByPlaceholder('AIza…')` and `getByLabel('API key')` both failed in past runs (a typed `…` never matches, and the label also matches the dialog's name). Use the exact textbox name above.
- The draft keeps prices as text in `amountInput` (`'6.50'`), not as numbers.
- Make the fixture's `total` equal subtotal plus its charges, or the reconciliation notice appears.
