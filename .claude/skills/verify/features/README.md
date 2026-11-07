# Split verification map

This directory is the maintained source for verifying what a Split user can do. Read this index before driving the app, then use the matching feature file as the recipe. The harness is `.claude/skills/verify/scripts/verify.mjs` (see [../SKILL.md](../SKILL.md)).

## Baseline preconditions

- Launch with `.claude/skills/verify/scripts/verify.mjs launch` and require `ready: <url>`.
- Run `.claude/skills/verify/scripts/verify.mjs doctor` and require exit 0.
- Every `run` opens a fresh browser context, so a journey starts with no people, one empty receipt, and the People step showing.
- Never drive a dev server this kit did not launch.

## Driving conventions

- Move between steps with the bottom bar (`wizard-continue-btn`, `wizard-back-btn`), as users do.
- Reach a populated split by loading a test split from the header menu (`workspace-menu-btn`, then `workspace-preset-<id>`). Never write the stores or `localStorage` directly.
- Prefer `data-testid` handles, then role and accessible name. Ids inside handles such as `claim-item-<id>` are random per run.
- Use the `phone` viewport unless the feature differs on wide screens. Then run both.

## Proof and skip reporting

- A step's screenshot shows the action. An assertion on visible text, the ARIA tree, the saved draft, the clipboard, or a downloaded file shows the result.
- Changes to the summary need the downloaded PNG read as well as the screen.
- Report an entry point you could not reach with the command you ran and the precondition that was missing. Do not report it as verified through a different path.
- Each sub-feature below is marked **proven by `<journey>`** or **not yet driven**. A not-yet-driven recipe lists handles read from source. Expect to fix it the first time you run it, and update this map when you do.

## Test splits

| Id                   | Label           | People              | Receipts                                      |
| -------------------- | --------------- | ------------------- | --------------------------------------------- |
| `lunch-for-three`    | Lunch for 3     | Alice, Bob, Charlie | 1, 4 items, 10% service, 9% GST, total $47.48 |
| `dinner-for-twelve`  | Dinner for 12   | 12                  | 1                                             |
| `bali-trip-for-five` | Bali trip for 5 | 5                   | 3, all in IDR                                 |

## Features

- [People](./people.md) covers adding people, removing them, and saved groups.
- [Receipt entry](./receipt-entry.md) covers typing items, charges, currency, and scanning with Gemini.
- [Assign items](./assign-items.md) covers By person and By item assignment, shares, and splitting leftovers.
- [Summary and export](./summary-export.md) covers the per-person cards, the overview, copying text, saving the image, and PayNow.
- [Workspace menu and persistence](./workspace-menu.md) covers test splits, file import and export, and surviving a reload.
