---
name: verify
description: Drive the Split bill-splitting web app in a real Chromium the way a user does, and capture proof (screenshots, ARIA snapshots, the exported PNG, clipboard text, saved localStorage, a Playwright trace). Use to prove a UI change works, to reproduce a UI bug before fixing it, or whenever a playbook asks for the project driver skill.
---

# Verify Split

Split is a browser-only React app served by Vite. There is no backend. All state lives in `localStorage`, so every drive runs in a fresh browser context and starts from an empty split. The kit is one script, `.claude/skills/verify/scripts/verify.mjs`, plus journey files in `journeys/`. Run every command from the repo root.

The feature map in [features/README.md](features/README.md) lists what users can do and how to drive each one. Read the matching feature file before you drive it.

## Launch

```bash
pnpm install                                  # once per checkout
pnpm exec playwright install chromium         # once per machine, a no-op when cached
.claude/skills/verify/scripts/verify.mjs launch
```

`launch` starts Vite on a free port on `127.0.0.1` with `--strictPort`, writes `.verify/instance.json` (pid, port, url, git head), and logs to `.verify/vite.log`. It prints `ready: <url>` only after a headless Chromium loaded the page and found `[data-testid="workspace"]`, so ready means the app rendered, not just that the port answered. If an instance from this checkout is already live, `launch` says so and starts nothing.

Each checkout gets its own port and its own `.verify/` dir, so two worktrees can verify side by side. Never point the kit at a dev server you did not launch with it.

## Doctor

```bash
.claude/skills/verify/scripts/verify.mjs doctor
```

Read-only. Exits 0 when the recorded Vite pid is alive, owns the recorded port, has this checkout as its cwd, serves `index.html`, and compiles `src/main.tsx`. It also reports whether `HEAD` moved since launch. That line is informational, because Vite serves the working tree and picks up edits without a restart. Run doctor first whenever a drive fails in a way that looks environmental.

## Drive

```bash
.claude/skills/verify/scripts/verify.mjs run <journey> [--viewport phone|desktop] [--headed]
```

`<journey>` is a file name in `journeys/` (with or without `.mjs`) or a path to any `.mjs` file. `phone` is 390x844 and is the default, because the app is mobile-first. `desktop` is 1280x900, which is past the `lg` breakpoint where the summary adds the "Who owes what" list. The process exits 0 only if the journey passed with no uncaught page errors.

Shipped journeys, both proven:

- `manual-split` adds two people, types two receipt items, assigns them By person, checks the summary totals and the saved draft.
- `test-split-summary` loads the `Lunch for 3` test split from the header menu, walks to the summary, checks each card's total, copies the text summary, saves the PNG, and reloads to prove persistence.

To prove a change, write a new journey (or a scratch one outside the repo) that does what a user would do. A journey is a module whose default export receives:

| Name                                 | What it is                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `page`                               | The Playwright `Page`, already on the app with the workspace rendered.                                       |
| `step(label, fn)`                    | Runs one user action, logs `ok`/`FAIL`, and takes a full-page screenshot after it. Wrap every action in one. |
| `shot(name)`, `aria(name, locator?)` | Extra screenshot, or an ARIA snapshot saved as `<name>.aria.yml`.                                            |
| `save(name, text)`                   | Writes any text artifact into the evidence dir.                                                              |
| `storage()`                          | All `localStorage` keys, JSON-parsed. The draft is `split:receipt-draft:v1`.                                 |
| `assert`                             | `node:assert/strict`.                                                                                        |
| `evidenceDir`, `url`                 | Where artifacts go, and the app URL.                                                                         |

```js
export default async function ({ page, step, assert }) {
  await step('load Lunch for 3', async () => {
    await page.getByTestId('workspace-menu-btn').click();
    await page.getByTestId('workspace-preset-lunch-for-three').click();
    assert.match(await page.getByTestId('wizard-continue-btn').innerText(), /^Next: Bob/);
  });
}
```

Selectors, in order of preference:

1. `data-testid`. The app has many: `people-input`, `people-add-btn`, `receipt-add-item-btn`, `wizard-continue-btn`, `wizard-back-btn`, `grand-total-card`, `export-copy-text-btn`, `export-save-image-btn`, `workspace-menu-btn`, `workspace-preset-<id>`, `claim-item-toggle-<itemId>`, and more (`grep -rho 'data-testid=[^ >]*' src`).
2. Role and accessible name: `getByRole('checkbox', { name: 'Laksa' })` for an item row on the Items step, `getByRole('radio', { name: 'Overview' })`, `getByRole('dialog', { name: 'Gemini API key' })`.
3. Placeholder text, for the item-name field only (`getByPlaceholder('Item name')`).

Ids such as `claim-item-<id>` are random per run, so reach those rows by their accessible name, not by a hardcoded id.

## Evidence

Each run writes to `.verify/evidence/<timestamp>-<journey>-<viewport>/`:

- `NN-<step>.png` is a full-page screenshot after each step, and `NN-failure.png` is the one taken when a step throws.
- `run.json` holds the pass/fail, each step with its time and screenshot, console errors, page errors, and every request that left the app's origin.
- `trace.zip` opens with `pnpm exec playwright show-trace <path>` and has DOM snapshots and a filmstrip.
- Whatever the journey saved, such as `*.aria.yml`, `clipboard.txt`, or a downloaded `export-*.png`.

Proof standards:

- Drive the real user path: clicks, typing, menus, the bottom bar. Never set Zustand stores or `localStorage` directly to reach a state. Load a test split from the menu instead.
- Capture the action and the result. The per-step screenshots do the first. An assertion on the visible text or ARIA tree does the second.
- Check side effects alongside the screen. Read the saved draft with `storage()`, open the downloaded PNG, and read the clipboard.
- Read the exported PNG yourself (it is an image file) when the change touches the summary. Screen and PNG are drawn by two renderers (see `docs/EXPORT-PARITY.md`), so a passing screen proves nothing about the image.
- The only external calls are Google Fonts, `open.er-api.com` for exchange rates, and Gemini for scanning. Rates fall back to built-in values when offline. Mock Gemini with `page.route('https://generativelanguage.googleapis.com/**', …)`, since it is a paid external API behind one `fetch`. Do not mock anything inside the app.

## Cleanup

```bash
.claude/skills/verify/scripts/verify.mjs cleanup
```

Stops the Vite process group the kit started (by recorded pid, never by name), then deletes `.verify/instance.json` and `.verify/vite.log`. Evidence in `.verify/evidence/` is kept. `.verify/` is gitignored. Run cleanup after a failed attempt too, so no port stays bound. Browsers close at the end of every `run`, so there is nothing else to stop.

## Helpers

- `scripts/verify.mjs` provides `launch`, `doctor`, `run`, and `cleanup`, as shown above. It is executable and needs Node 24 (`.nvmrc`) and the repo's `playwright` dev dependency.
- `journeys/*.mjs` are the proven journeys, to copy from when writing a new one.
