# Summary and export

The Summary step shows what everyone owes, as one card per person or as an overview table. The user can copy a text summary, save or preview a PNG, add a PayNow number so the cards carry QR codes, and switch currency display.

## Sub-features

- `summary-cards` shows each person's total and their item lines By person. **Proven by `test-split-summary`.**
- `summary-copy-text` copies a text summary with every person and the total. **Proven by `test-split-summary`.**
- `summary-save-image` downloads a PNG of the current view. **Proven by `test-split-summary`.**
- `summary-overview` switches to the who-had-what table. **Not yet driven.**
- `summary-detail` switches each card between `Totals`, `Their items`, and `All items`. **Not yet driven.**
- `summary-paynow` adds a PayNow number and shows QR codes on cards and in the PNG. **Not yet driven.**
- `summary-wide-list` shows the "Who owes what" list beside the cards from 1024px wide. **Not yet driven.**

## How to get to it (user POV)

- From Items once every priced item is assigned, choose `See summary` in the bottom bar.
- Choose `Step 4: Summary` in the step nav once it is reachable.

## Driving it with verify.mjs

Preconditions:

- Every priced item is assigned. Load `lunch-for-three` and walk `Next: Bob`, `Next: Charlie`, `See summary`, as `test-split-summary` does.

- **Cards.** `grand-total-card` holds the total (`$47.48` for Lunch for 3). Each card is a level-3 heading with the person's name followed by `Total` and the amount, so assert on `page.getByRole('main').last().ariaSnapshot()`.
- **Copy text.** Run `page.getByTestId('export-copy-text-btn').click()`, then read `navigator.clipboard.readText()` in the page. The run grants clipboard permissions.
- **Save image.** Run `Promise.all([page.waitForEvent('download'), page.getByTestId('export-save-image-btn').click()])` and `download.saveAs(join(evidenceDir, ...))`. Read the saved PNG and compare it with the screen.
- **Overview.** Run `page.getByRole('radio', { name: 'Overview' }).click()`. The table scrolls in `overview-table-scroll`, with the people row in `overview-pinned-people`.
- **Detail.** Run `page.getByRole('radio', { name: 'Totals' }).click()` inside the `Show on each card` group.
- **PayNow.** Choose the `PayNow` button on the grand total card and type a number such as `9123 4567`. The card shows `PayNow QR codes ready`.
- **Wide list.** Run with `--viewport desktop`. The `person-total-<personId>` entries appear only there.
- **Proof.** The `summary` ARIA snapshot, `clipboard.txt`, and the downloaded `export-*.png`.

## Gotchas

- `person-total-<id>` exists only at 1024px and wider. On `phone`, read totals from the cards.
- Screen and PNG are drawn by separate renderers. A matching screen does not prove the PNG. Read the image. Intended differences are listed in `docs/EXPORT-PARITY.md`.
- The text summary formats a total as `Name: $14.99`, one line per person, after the receipt total.
- The exported file name carries the date (`split-lunch-08-11-2026.png`), so do not hardcode it.
