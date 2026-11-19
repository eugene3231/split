# Assign items

The Items step is where a user says who had what. By person, they pick a person and tick what that person had. By item, they open an item and tick everyone who shared it. Shares can be uneven, and whatever is left can be split evenly at the end.

## Sub-features

- `assign-by-person` ticks items for one person, then moves to the next with `Next: <name>`. **Proven by `manual-split` and `test-split-summary`.**
- `assign-by-item` opens an item and ticks everyone who shared it. **Not yet driven.**
- `assign-shares` sets an uneven share with the stepper or by typing an amount or percent. **Not yet driven.**
- `assign-split-leftovers` splits every item still left evenly, after a confirm dialog. **Not yet driven.**

## How to get to it (user POV)

- From Receipt with at least one priced item, choose the bottom-bar continue button (`Who had what`).
- Loading a test split from the header menu lands here directly.

## Driving it with verify.mjs

Preconditions:

- People and at least one priced item exist, or a test split is loaded.

- **By person.** The rail `getByRole('group', { name: 'Whose items' })` holds one button per person, with the active one `aria-pressed`. Tick an item with `page.getByRole('checkbox', { name: 'Laksa', exact: true }).click()`. The bottom bar reads `Next: <name>` until the last person, then `See summary`, or `Split N left evenly` when items are still left.
- **By item.** Switch with `page.getByRole('radio', { name: 'By item' }).click()`. Open a row with its `item-claim-toggle-<itemId>` checkbox, tick people, and go on with `item-claim-next-<itemId>`.
- **Shares.** On the active person's item, the stepper and share field sit on the second line (`claim-item-actions-<itemId>`).
- **Split leftovers.** With items left, choose the bottom bar `Split N left evenly`. A dialog lists them in `split-leftovers-list`. Confirming assigns them and the bar moves on.
- **Proof.** `storage()['split:receipt-draft:v1'].receipts[n].items[m].assignment.shares` maps person ids to weights. Map ids to names through `draft.people`.

## Gotchas

- Item rows are Radix checkboxes. `getByRole('button', { name: 'Laksa' })` finds nothing.
- The bottom bar's label changes after each tick. Wait for the label you expect before clicking, as the shipped journeys do with `waitForFunction`.
- An item other people already have in full stays in the list but fades. It is still clickable.
- Uneven shares are set By person only.
