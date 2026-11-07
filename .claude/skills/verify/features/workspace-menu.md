# Workspace menu and persistence

The header's three-dot menu loads a ready-made test split, saves the whole split to a `.json` file, and reads one back. Separately, the split saves itself to the browser on every change, so a reload or a closed tab loses nothing.

## Sub-features

- `menu-test-split` loads a test split and lands on Items. **Proven by `test-split-summary`.**
- `persist-reload` keeps people, receipts, assignments, and the current step across a reload. **Proven by `test-split-summary` and `manual-split`.**
- `menu-replace-confirm` asks before a load replaces entered work. **Not yet driven.**
- `menu-export-file` downloads the split as `.json`. **Not yet driven.**
- `menu-import-file` reads a `.json` export back, and rejects a file that is not one. **Not yet driven.**

## How to get to it (user POV)

- Choose the `Split menu` button (three dots) at the right of the header, on any step.
- Persistence needs no action. Reload the tab.

## Driving it with verify.mjs

Preconditions:

- None for loading into an empty split. To see the confirm, add a person first.

- **Test split.** Run `page.getByTestId('workspace-menu-btn').click()` and `page.getByTestId('workspace-preset-lunch-for-three').click()`. The Items step shows `Truffle Fries`, and the bottom bar reads `Next: Bob`.
- **Replace confirm.** With people already entered, load a test split. A dialog titled `Replace this split?` appears. `Replace split` confirms, and Cancel keeps the current split.
- **Export file.** Run `Promise.all([page.waitForEvent('download'), page.getByTestId('workspace-export-btn').click()])` after opening the menu. The download is JSON with `people` and `receipts`.
- **Import file.** Run `page.getByTestId('workspace-import-input').setInputFiles(<path to an export>)`. The split is replaced and the app lands on Items. A non-export file shows `That file isn't a Split export.` inside the menu.
- **Reload.** Run `page.reload()`. The same step and totals render.
- **Proof.** `storage()['split:receipt-draft:v1']` before and after, plus the step screenshot after reload.

## Gotchas

- The menu is a Radix dropdown in a portal. Find its items by test id from `page`, not from inside the trigger.
- The import input is visually hidden. Call `setInputFiles` on it directly rather than clicking `Import from file`, which opens a native picker that Playwright cannot drive.
- `Reset split` on the summary clears people and receipts but keeps saved groups, which live under their own key.
