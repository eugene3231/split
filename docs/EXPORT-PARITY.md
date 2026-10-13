# Summary / Export Parity

Each summary view is drawn twice: in React on screen, and on a canvas for the exported PNG. Both live in `src/features/split-workspace/summary/`, each pair in one folder with the data it draws.

| View      | Folder       | Decides the rows      | Screen                    | PNG                                                            |
| --------- | ------------ | --------------------- | ------------------------- | -------------------------------------------------------------- |
| By person | `breakdown/` | `summaryBreakdown.ts` | `PersonBreakdownCard.tsx` | `personBreakdownImage.ts`, sized by `personBreakdownLayout.ts` |
| Overview  | `overview/`  | `summaryOverview.ts`  | `OverviewTable.tsx`       | `overviewImage.ts`, sized by `overviewLayout.ts`               |

## What the code guarantees

- **Which rows appear, and in what order.** `resolveSummaryBreakdown` and `resolveSummaryOverview` return each card and each table section as a list of rows (`BreakdownRow`, `OverviewRow` in each folder's `types.ts`). Both renderers walk that list. Neither chooses whether a heading, a rule, a charge, an empty message or a PayNow code is there.
- **Every kind of row is handled in both.** The renderers `switch` on `row.kind`. A new kind fails `pnpm typecheck` in the screen component, the canvas layout and the canvas drawing until each one handles it.
- **The wording of amounts.** `breakdown/breakdownFormat.ts` formats the `—` for an item a person had none of, the sign on a charge, and the `≈` and rate lines. Both card renderers call it.
- **The image is drawn where it was measured.** `layoutCard` places everything in a card once. The image is sized from that layout and drawn from the same object.

So a change to what a card or the table contains is made in `summaryBreakdown.ts` or `summaryOverview.ts`, with a test beside it, and both renderers follow.

## What is still checked by hand

Styling: fonts, weights, colours, spacing, and how text that is too long is cut. Nothing compares the screen with the PNG.

When you change how one renderer looks, open the other and make the matching change. If the change belongs in one renderer only, say so in a comment at the spot, starting `React only:` or `Image only:`, and add a row to the table below.

## Differences that are meant

| What                                | On screen                                                          | In the PNG                                                                 | Why                                                                 |
| ----------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Charge rows on a person's card      | Label and amount in grey italics, the same for every charge        | Upright, with a discount amount in green (`#16a34a`)                       | Not settled. Kept as found on 2026-10-13; see the next section      |
| Exchange rate on a person's card    | Under each person's total                                          | Once, in the grand total band; a person's header gives only the `≈` amount | Side by side in one image, the same rate would repeat on every card |
| A name too long for the card header | The total wraps under the name                                     | The name is cut with an ellipsis                                           | The image card is a fixed 760px wide                                |
| A long item name on a card          | Wraps for as many lines as it needs                                | Wraps to two lines, then an ellipsis                                       | A row in the image has a fixed height per line                      |
| PayNow code                         | A button that downloads the code, pushed to the bottom of the card | The code alone, lined up along the bottom of the row of cards              | A PNG cannot be clicked; cards in a row share one height            |
| People row of the overview          | Pinned under the app bar while the page scrolls                    | Drawn once at the top                                                      | The image shows the whole table at once                             |
| A share in the overview, on a phone | A dot in the person's colour, with the amount for screen readers   | The amount in a tinted pill                                                | The image has room for every amount                                 |
| A long item name in the overview    | Clamped to two lines on a phone, unclamped above that              | One line, cut with an ellipsis                                             | A row in the image has one fixed height                             |

## Open: charge row styling

The two renderers disagree on charge rows and nobody has decided which is right. The overview table already uses grey italics for charges in both of its renderers, so today three of the four agree with the screen card.

To settle it later:

1. Pick the treatment. Grey italics everywhere makes all four renderers agree and needs no new colour. Upright with a green discount makes a saving easier to spot, and needs a design token for the green in `src/index.css` and a contrast check against the section background.
2. Decide whether the overview table follows. It shows the same charges.
3. Change the renderer that loses: `Row` in `PersonBreakdownCard.tsx`, or `drawChargeRow` in `personBreakdownImage.ts`.
4. Delete the `React only:` and `Image only:` comments on those two, and the first row of the table above.
5. Compare the exported PNG and the screen before and after. The canvas drawing has no tests, so a browser capture is the check.

## Naming

Name things after the user-facing **breakdown** concept, following what is already there: `resolveSummaryBreakdown()`, `SummaryBreakdown`, `PersonBreakdown`, `ReceiptBreakdownSection`, `BreakdownRow`, `BreakdownItemRow`, `BreakdownChargeRow`. Avoid card or view-model wording such as `buildPersonSummaryCardModels`, `getPersonCards` or `makeRows`.
