---
name: verify
description: Drive the Split bill-splitting web app in a real Chromium the way a user does, and capture proof (screenshots, ARIA snapshots, the exported PNG, clipboard text, saved localStorage, a Playwright trace). Use to prove a UI change works, to reproduce a UI bug before fixing it, to take before/after screenshots against main, or whenever a playbook asks for the project driver skill.
---

# Verify Split

Split is a browser-only React app served by Vite. There is no backend. All state lives in `localStorage`, so every drive runs in a fresh browser context and starts from an empty split. The kit is one script, `.agents/skills/verify/scripts/verify.mjs`, plus journey files in `journeys/`. Run every command from the repo root. The skill lives in `.agents/skills/verify/` so any harness can read it. `.claude/skills/verify` is a symlink to it, so edit the `.agents/` copy.

The feature map in [features/README.md](features/README.md) lists what users can do and how to drive each one. Read the matching feature file before you drive it.

## Launch

```bash
pnpm install                                  # once per checkout
pnpm exec playwright install chromium         # once per machine, a no-op when cached
.agents/skills/verify/scripts/verify.mjs launch
```

`launch` starts Vite on a free port on `127.0.0.1` with `--strictPort`, records it in `.verify/instances/head.json`, and logs to `.verify/head.vite.log`. It prints `ready: head <url>` only after a headless Chromium loaded the page and found `[data-testid="workspace"]`, so ready means the app rendered, not just that the port answered. If the instance is already live, `launch` says so and starts nothing.

Each checkout gets its own ports and its own `.verify/` dir, so worktrees can verify side by side. Never point the kit at a dev server you did not launch with it: port 5173 is often another project's Vite.

## Doctor

```bash
.agents/skills/verify/scripts/verify.mjs doctor
```

Read-only, and it needs nothing beyond Node, so it runs on macOS and Linux. For each launched instance it checks that the pid is alive, that the server on the port serves that instance's checkout through Vite's `/@fs/` route (a Vite from another checkout answers 403), that it serves `index.html`, and that it compiles `src/main.tsx`. It also reports whether `HEAD` moved since launch. That line is informational, because Vite serves the working tree and picks up edits without a restart. Run doctor first whenever a drive fails in a way that looks environmental.

## Drive

```bash
.agents/skills/verify/scripts/verify.mjs run <journey> [--on head|base] [--viewport phone|desktop|wide|<W>x<H>] [--offline] [--headed]
```

- `<journey>` is a file name in `journeys/` (with or without `.mjs`) or a path to any `.mjs` file. Scratch journeys can live outside the repo.
- `phone` (default) is 390x844 at 2x scale with touch, as on a phone, so screenshots are 780px wide. `desktop` is 1280x900 and `wide` is 1440x900. Any `<W>x<H>` works, such as `1024x768` for the `lg` breakpoint's edge.
- `--offline` aborts every request that leaves the app except Google Fonts. Exchange rates then use the built-in fallback, so two runs see the same numbers. Use it for every screenshot comparison.
- Actions time out after 8 seconds, not Playwright's 30. A timeout almost always means a wrong selector, not a slow app.
- The process exits 0 only if the journey passed with no uncaught page errors.

Shipped journeys, all proven:

- `manual-split` adds two people, types two receipt items, assigns them By person, and checks the summary totals and the saved draft.
- `test-split-summary` loads `Lunch for 3` from the header menu, walks to the summary, checks each card's total, copies the text summary, saves the PNG, and reloads to prove persistence.
- `receipt-scan` saves a Gemini key, uploads a photo, answers Gemini with a fixture through `page.route`, and checks the request, the filled items, the detected charges, and the saved draft.
- `separate-profiles` opens a second browser profile beside the first and proves each keeps its own saved split. Copy it for any flow with two people on two devices.

To prove a change, write a journey that does what a user would do. A journey is a module whose default export receives:

| Name                                        | What it is                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `page`                                      | The Playwright `Page`, already on the app with the workspace rendered.                                           |
| `step(label, fn)`                           | Runs one user action, logs `ok`/`FAIL`, and takes a full-page screenshot after it. Wrap every action in one.     |
| `shot(name, page?)`, `aria(name, locator?)` | Extra screenshot (of another profile's page if given), or an ARIA snapshot saved as `<name>.aria.yml`.           |
| `profile()`                                 | Opens a second person: a new browser profile with empty storage, on the app. Returns its `Page`.                 |
| `save(name, text)`                          | Writes any text artifact into the evidence dir.                                                                  |
| `storage(page?)`                            | All `localStorage` keys, JSON-parsed, for the main page or the given one. The draft is `split:receipt-draft:v1`. |
| `assert`, `evidenceDir`, `url`              | `node:assert/strict`, where artifacts go, and the app URL.                                                       |

```js
export default async function ({ page, step, assert }) {
  await step('load Lunch for 3', async () => {
    await page.getByTestId('workspace-menu-btn').click();
    await page.getByTestId('workspace-preset-lunch-for-three').click();
    assert.match(await page.getByTestId('wizard-continue-btn').innerText(), /^Next: Bob/);
  });
}
```

Selectors, in order of preference. Look the handle up before writing it (`grep -rho 'data-testid=[^ >]*' src`, or an `aria()` snapshot of the screen); guessed selectors were the most common cause of failed runs.

1. `data-testid`: `people-input`, `people-add-btn`, `receipt-add-item-btn`, `wizard-continue-btn`, `wizard-back-btn`, `wizard-step-nav-<step>` (desktop) and `wizard-step-nav-mobile-<step>`, `grand-total-card`, `export-copy-text-btn`, `export-save-image-btn`, `workspace-menu-btn`, `workspace-preset-<id>`.
2. Role and accessible name: `getByRole('checkbox', { name: 'Laksa' })` for an item row on the Items step, `getByRole('radio', { name: 'Overview' })`, `getByRole('dialog', { name: 'Gemini API key' })`.
3. Placeholder text, for the item-name field only (`getByPlaceholder('Item name')`).

Ids such as `claim-item-<id>` are random per run, so reach those rows by their accessible name.

## Before and after

```bash
.agents/skills/verify/scripts/verify.mjs launch --base        # or --base <ref>
.agents/skills/verify/scripts/verify.mjs run <journey> --on base --offline
.agents/skills/verify/scripts/verify.mjs run <journey> --on head --offline
```

`--base` with no ref fetches `origin/main` and serves `git merge-base HEAD origin/main`, the commit this branch left main at. Local `main` is often stale, so never pass `main`. It checks that commit out as a detached worktree outside the repo (so this checkout's Vitest and ESLint never see it), installs its dependencies, and serves it as the `base` instance beside `head`. Evidence folders end in `-base` or `-head`.

Run the same journey at the same viewport on both. When the user asks for before/after images, cover every screen the change touches at `phone` and `desktop`, and the exported PNG if the summary changed. One screen at one size was not enough the last time. A regression proof is a journey that fails on `base` and passes on `head`.

## Evidence

Each run writes to `.verify/evidence/<timestamp>-<journey>-<viewport>-<head|base>/`:

- `NN-<step>.png` is a full-page screenshot after each step, and `NN-failure.png` is the one taken when a step throws. Before each shot the kit moves the pointer off the page, waits for web fonts, and ends CSS animations, so no hover fill, fallback font, or half-faded card gets in.
- `run.json` holds the pass/fail, each step with its time and screenshot, console errors, page errors, and every request that left the app's origin.
- `trace.zip` opens with `pnpm exec playwright show-trace <path>` and has DOM snapshots and a filmstrip.
- Whatever the journey saved, such as `*.aria.yml`, `clipboard.txt`, or a downloaded `export-*.png`.

Proof standards:

- Drive the real user path: clicks, typing, menus, the bottom bar. Never set Zustand stores or `localStorage` directly to reach a state. Load a test split from the menu instead.
- Capture the action and the result. The per-step screenshots do the first. An assertion on the visible text or ARIA tree does the second.
- Check side effects alongside the screen. Read the saved draft with `storage()`, open the downloaded PNG, and read the clipboard.
- Read the exported PNG yourself when the change touches the summary. Screen and PNG are drawn by two renderers (see `docs/EXPORT-PARITY.md`), so a passing screen proves nothing about the image.
- Look at the screenshots you cite. A run that passed can still show a broken layout.
- Claim only what a file in the evidence folder shows. Name that folder in the report.
- Never commit screenshots. If one belongs in a PR, give the user its path; they upload it by hand.
- The only external calls are Google Fonts, `open.er-api.com` for exchange rates, and Gemini for scanning. Mock Gemini with `page.route('https://generativelanguage.googleapis.com/**', …)`, since it is a paid API behind one `fetch`. Never call the real one. Do not mock anything inside the app.

## When a run fails

1. Open `NN-failure.png` and the failing step in `run.json`. Most failures are the journey's fault: a wrong selector, or a step the app added (a dialog, an extra person to walk).
2. If `doctor` fails, fix the environment first: `cleanup`, then `launch`.
3. If the kit, a journey, or the feature map was wrong, fix it in the same change and add the lesson to the feature file's `Gotchas` (or to the list below if it is about the kit). The next agent should not hit it again.
4. Never weaken an assertion to make a journey pass. If the app is wrong, that is the finding.

## Gotchas

- `innerText` includes icon names and avatar initials: the continue button reads `Next: Bob\narrow_forward`, and a person chip includes the initial and `close`. Match with `/^Next: Bob/` or `includes`, or assert on the ARIA tree.
- Going from People to Receipt opens the `Gemini API key` dialog on first visit, and it blocks every click. Choose `Skip` unless you are scanning.
- Loading a test split over entered work opens `Replace this split?`. Confirm with `Replace split`.
- The By person flow walks every person before `See summary` (`Next: Bob`, `Next: Charlie`, then `See summary`).
- Full-page screenshots draw sticky bars (app bar, bottom bar) where they sat in the viewport, which can be mid-page. That is the capture, not a layout bug.
- A three-person split hides wasted space on wide screens. To judge desktop layout, also load `Dinner for 12`.

## Cleanup

```bash
.agents/skills/verify/scripts/verify.mjs cleanup
```

Stops every Vite process group the kit started (by recorded pid, never by name), deletes the instance records and logs, and removes the base worktree. Evidence in `.verify/evidence/` is kept, and `.verify/` is gitignored. Run cleanup after a failed attempt too, so no port stays bound. Running it twice is safe. Browsers close at the end of every `run`.

## Helpers

- `scripts/verify.mjs` provides `launch`, `doctor`, `run`, and `cleanup`, as shown above. It is executable and needs Node 24 (`.nvmrc`), `pnpm`, and the repo's `playwright` dev dependency.
- `journeys/*.mjs` are the proven journeys, to copy from when writing a new one.
