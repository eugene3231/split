# People

The People step is where a user lists everyone sharing the bill. They can add several names at once, remove someone by tapping their chip, and save the list as a named group to reuse later.

## Sub-features

- `people-add` adds one or more people from a comma-separated entry. **Proven by `manual-split`.**
- `people-remove` removes a person by tapping their chip, or everyone with `Remove all`. **Not yet driven.**
- `people-group-save` saves the current people as a named group. **Not yet driven.**
- `people-group-load` loads a saved group back in. **Not yet driven.**

## How to get to it (user POV)

- Open the app. A new split starts on the People step, titled "Who's splitting the bill?".
- From any later step, choose `Back` in the bottom bar, or `Step 1: People` in the step nav.

## Driving it with verify.mjs

Preconditions:

- A fresh run with no people. `people-empty-state` is visible.

- **Add.** Type names and submit. Run `page.getByTestId('people-input').fill('Dana, Eli')` and `page.getByTestId('people-add-btn').click()`. `people-list` holds one button per name.
- **Remove one.** Tap a chip. Run `page.getByTestId('people-list').getByRole('button', { name: /Dana/ }).click()`. The chip animates out and is gone from `people-list`.
- **Remove all.** Run `page.getByRole('button', { name: 'Remove all' }).click()`. `people-empty-state` returns.
- **Save group.** Run `page.getByTestId('save-group-btn').click()`, `page.getByTestId('save-group-name-input').fill('Housemates')`, and `page.getByTestId('save-group-submit').click()`. The `saved-groups` section lists `Housemates`, and `storage()['split:saved-groups:v1']` has it.
- **Load group.** After `Remove all`, run `page.getByTestId('saved-groups').getByRole('button', { name: /Housemates/ }).click()`. The same names are back in `people-list`.
- **Proof.** `aria('people', page.getByTestId('wizard-step-panel'))` and `storage()['split:receipt-draft:v1'].people`.

## Gotchas

- The add button shows only an icon below the `sm` breakpoint. Use its test id, not the text `Add`.
- `Continue` stays disabled with no people. Asserting the label alone proves nothing.
- Saved groups live in their own key, `split:saved-groups:v1`, and outlive `Reset split`.
