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

| What                                | On screen                                                                | In the PNG                                                                 | Why                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Exchange rate on a person's card    | Under each person's total                                                | Once, in the grand total band; a person's header gives only the `≈` amount | Side by side in one image, the same rate would repeat on every card |
| A name too long for the card header | The total wraps under the name                                           | The name is cut with an ellipsis                                           | The image card is a fixed 760px wide                                |
| A long item name on a card          | Wraps for as many lines as it needs                                      | Wraps to two lines, then an ellipsis                                       | A row in the image has a fixed height per line                      |
| PayNow code                         | A button that downloads the code, pushed to the bottom of the card       | The code alone, lined up along the bottom of the row of cards              | A PNG cannot be clicked; cards in a row share one height            |
| People row of the overview          | Pinned under the app bar while the page scrolls                          | Drawn once at the top                                                      | The image shows the whole table at once                             |
| A long item name in the overview    | Clamped to two lines on a phone, unclamped above that                    | One line, cut with an ellipsis                                             | A row in the image has one fixed height                             |
| Who owes what list                  | Beside the By person cards from 1024px wide, each name jumps to its card | Not drawn                                                                  | The image shows every card at once                                  |

## Overview columns

Every amount in a person's column, the person's name above it included, ends on one right edge in both renderers. A share pill reaches past that edge by its own padding, so the figure inside it lines up with the plain figures below.

## Charge rows

Settled on 2026-11-04: charges are upright and grey in all four renderers, never italic. On a person's card a discount amount is green, `text-secondary` on screen and `SUCCESS` in `canvas/theme.ts` for the PNG; keep the two the same colour. The overview table shows every charge in grey, discount included.

## Naming

Name things after the user-facing **breakdown** concept, following what is already there: `resolveSummaryBreakdown()`, `SummaryBreakdown`, `PersonBreakdown`, `ReceiptBreakdownSection`, `BreakdownRow`, `BreakdownItemRow`, `BreakdownChargeRow`. Avoid card or view-model wording such as `buildPersonSummaryCardModels`, `getPersonCards` or `makeRows`.
