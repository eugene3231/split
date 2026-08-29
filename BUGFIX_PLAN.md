# Plan: Bugfix Batch — Wizard Gate, Scan Integrity, Input Handling

**Created**: 2026-08-29 | **Effort**: ~5h | **Complexity**: Medium

Five verified bugs, fixed as five independent commits (red-first tests per commit). Found by manual audit + agent sweep; every finding verified against source before inclusion.

---

## 1. Objective

**Goal**: Fix the five high/medium-severity bugs found in the 2026-08-29 bug hunt without regressing the 506-test suite.

**Why**: One bug silently drops money from the final bill (wizard gate), one can overwrite user data mid-flight (stale scan), one leaks API keys into URLs, and two break basic input handling (rename keyboard, file re-selection).

**Success**:

- The wizard cannot reach Summary while any receipt has a detected-but-unassigned item, through any path
- A scan that resolves after its receipt file was swapped/removed applies nothing and leaves no stale feedback
- The Gemini key never appears in a URL
- Spaces are typeable in receipt/summary tab renames; Enter in a rename input does not select the tab
- Re-selecting the same photo after removing it re-fires the file input
- `pnpm prepush` green; each commit ships with its own tests

---

## 2. Background — verified bugs

### Bug 1 — Wizard gate inconsistency (highest impact)

Two definitions of "ready for Summary" disagree in multi-receipt flows:

| Site                                                | Validates               |
| --------------------------------------------------- | ----------------------- |
| `canReachFinal` — `useWizard.ts:58`                 | **all** receipts' items |
| `canContinue` review branch — `useWizard.ts:52`     | **active** receipt only |
| `handleNext` review guard — `useWizard.ts:127`      | **active** receipt only |
| `resolveWizardState` eviction — `wizardState.ts:16` | **active** receipt only |

**Exploit path**: 2 receipts; receipt 1 fully assigned and active; receipt 2 has an item with a valid amount but no selected people. Click **"Review All"** (AssignStep.tsx:116 — no validation) → Review shows receipt 2's unassigned row, but Continue is enabled (it only checked receipt 1) → `handleNext` (useWizard.ts:127) passes → Summary. On Summary: the TopAppBar's Summary button renders **disabled** (`stepReachability.final === false`) while standing on Summary; the excluded item appears only as a 40%-opacity "—" row; no unassigned warning exists anywhere in the web UI (only in the exported PNG, `receiptSplitImageLight.ts:190`); grand total is short by that item's amount. `resolveWizardState` cannot evict because it re-checks the active receipt only.

### Bug 2 — Stale scan result overwrites a receipt whose file was swapped mid-scan

`useReceiptImport.ts:27-54`: `handleScanReceipt` captures `receipt.receiptFile` at click, awaits Gemini (no AbortController anywhere), then only verifies the receipt still _exists_ — not that its file is unchanged — before `patchReceipt` overwrites items/charges/total with the old photo's OCR data. `scanReceipt.ts:39` also re-adds warnings after the file-change handler called `clearScanFeedback`.

### Bug 3 — Gemini API key in URL query string

`geminiApi.ts:49`: `...:generateContent?key=${apiKey}`. The endpoint supports the `x-goog-api-key` header; query-string keys are captured by proxies, error reporters, and extensions.

### Bug 4 — Rename input keydowns bubble to the tab container

The rename input is nested inside a `role="button"` tab whose `onKeyDown` calls `preventDefault()` on Space/Enter. The input stops `click` propagation but not `keydown`:

- `ReceiptTabs.tsx:64-69` (container) vs `78-90` (input) — Space is untypeable ("Team Lunch" → "TeamLunch"); Enter commits _and_ re-selects the tab, which in AssignStep flips the sub-phase back to assign
- Same pattern in `SummaryTabs.tsx:53-58` vs `67-80`

### Bug 5 — File inputs never reset

`ReceiptImportActions.tsx:52-55`: `handleFileChange` never clears `e.target.value`; the `fileInputRef`/`cameraInputRef` (lines 19-20) are dead. Remove upload → re-pick the same file → no `change` event → silent no-op.

---

## 3. Approach

**Pattern**: One commit per bug, red-first tests, dependency-free order. Each fix is the minimal change that makes the gate/cleanup un-bypassable — no new machinery (no AbortController, no new stores).

**Key decisions**:

| Decision                              | Choice                                               | Rationale                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth for "final reachable" | `isStepValid('items', { items: allReceiptItems })`   | Already exists as `canReachFinal`; the other three sites are the drift                                                                                                                 |
| "Review All" entry validation         | Leave unvalidated                                    | Review is the diagnostic surface (red rows + "Edit" jump); the Continue button is the gate                                                                                             |
| Stale-scan detection                  | `File` object identity after the await               | `handleReceiptFileSelected` always replaces the object (new upload) or nulls it (X), so identity is a sufficient changed-file signal; 5 lines vs plumbing AbortSignal through 3 layers |
| Stale scan feedback                   | `clearScanFeedback` in the drop branch               | Wipes warnings re-added by `scanReceipt.ts:39`; `isScanning` is already false via `finishScan`                                                                                         |
| Rename keydown fix                    | `e.stopPropagation()` on all keydowns from the input | While editing, Enter/Space/Escape belong to the input; one line per file                                                                                                               |
| File input fix                        | `input.value = ''` after reading `files`             | Read before clearing; standard re-select-enabling pattern                                                                                                                              |
| Gemini key transport                  | `x-goog-api-key` request header                      | Documented by the endpoint; drops into the existing fetch headers                                                                                                                      |

---

## 4. Tasks

### Phase 1: Wizard gate (`fix(wizard)`)

**Task 1.1** — Red tests in `useWizard.test.ts`

- (a) 2 receipts; receipt 1 fully assigned, receipt 2 has a detected item with no selection → `setItemsSubPhase('review')` → `canContinue === false`
- (b) same state → `handleNext()` → `activeStep` still `'items'`
- (c) invariant: `canContinue === stepReachability.final` while in review
- (d) `resolveWizardState('final', 'review', activeItemsValid, allItemsWithUnassigned, people)` → `{ activeStep: 'items', itemsSubPhase: 'assign' }`
- (e) single-receipt regression: next-through-items, auto-advance, review→final unchanged
- Deps: None | Risk: Low

**Task 1.2** — `useWizard.ts` alignment

- Hoist `allReceiptItems` (memoized `receipts.flatMap(r => r.items)`) above `canContinue`
- `allItemsAssigned = isStepValid('items', { items: allReceiptItems, people })`
- Use in `canContinue` review branch (line 52), `handleNext` review guard (line 127), `canReachFinal` (line 58)
- Pass `allReceiptItems` into `resolveWizardState`
- Deps: 1.1 | Risk: Low-Medium (existing multi-receipt tests may encode old behavior — update deliberately)

**Task 1.3** — `wizardState.ts` eviction check

- Add `allItems: EditableItem[]` param; use it only in the `final` eviction check (line 16); keep `receipt`/`people` checks active-receipt-scoped; update the single caller
- Deps: 1.1 | Risk: Low

**Acceptance**: exploit path dead-ends at a disabled Continue button; TopAppBar consistent on Summary; `pnpm test` green.

### Phase 2: Stale scan guard (`fix(scan)`)

**Task 2.1** — Red tests, new `useReceiptImport.test.ts`

- Mock `@features/receipt-scanner`'s `scanReceipt` with a deferred promise (mirror the store/mocking setup of `useSummaryModel.test.ts`)
- Swap file A→B mid-flight → resolve → receipt items/charges unchanged, `clearScanFeedback` called
- Remove file (null) mid-flight → no patch applied
- No swap → patch applied (happy path)
- Deps: None | Risk: Low

**Task 2.2** — Identity check in `useReceiptImport.ts:handleScanReceipt`

- Capture `const scannedFile = receipt?.receiptFile ?? null` before the await
- After resolve: drop unless `currentReceipt && currentReceipt.receiptFile === scannedFile`; in the drop branch call `useScanStore.getState().clearScanFeedback(activeReceiptId)`
- Deps: 2.1 | Risk: Low

### Phase 3: Rename keydown (`fix(ui)`)

**Task 3.1** — Both inputs: `e.stopPropagation()` first in `onKeyDown`, then existing Enter/Escape handling — `ReceiptTabs.tsx` (input at 78-90), `SummaryTabs.tsx` (input at 67-80)

- Deps: None | Risk: Low

**Task 3.2** — Tests

- New `ReceiptTabs.test.tsx` + cases in `SummaryTabs.test.tsx`: Space is insertable; Enter commits without firing tab select/`onTabChange`; Escape cancels
- Deps: 3.1 | Risk: Low

### Phase 4: File input reset (`fix(receipt)`)

**Task 4.1** — `ReceiptImportActions.tsx:handleFileChange`: read `e.currentTarget.files?.[0]` → `input.value = ''` → `onReceiptFileSelected(file)` (read before clearing). Delete unused `fileInputRef`/`cameraInputRef`.

- Deps: None | Risk: Low

**Task 4.2** — Test in `ReceiptImportActions.test.tsx`: after firing `change`, `input.value === ''`. (jsdom cannot reproduce the browser's same-value dedupe; re-select flow gets a manual check.)

- Deps: 4.1 | Risk: Low

### Phase 5: Gemini key header (`fix(scanner)`)

**Task 5.1** — `geminiApi.ts:49-52`: strip `?key=${apiKey}` from the URL; add `'x-goog-api-key': apiKey` to fetch headers

- Deps: None | Risk: Low (endpoint-documented header)

**Task 5.2** — `geminiApi.test.ts`: assert header present on the request; `key=` nowhere in the URL

- Deps: 5.1 | Risk: Low

**Task 5.3** — Manual: one real scan with a valid key (unit mocks cannot prove server acceptance)

- Deps: 5.1 | Risk: Low

---

## 5. Verification

- Per commit: `pnpm test` — new tests red → green
- Final: `pnpm prepush` (eslint, `tsc --noEmit`, `tsc -b`, build, full vitest)
- Manual smoke (all five merged): full 2-receipt flow with mock scan —
  1. Bug 1 repro → Continue disabled in Review with receipt 2 dirty; assigning it re-enables
  2. Rename a receipt tab with spaces; Enter commits without switching tabs (Assign and Summary)
  3. Remove upload → re-select the same photo → file applies
  4. Swap the photo mid-scan → old scan results never land
  5. Real scan → request URL contains no key; scan succeeds

## 6. Out of scope (tracked separately)

Lower-severity findings from the same audit:

- `loadExchangeRates` accepts 0/negative rates (`exchangeRateStorage.ts:37`)
- Gemini items with `amount <= 0` dropped without a warning (`geminiApi.ts:142-144`)
- Tab switch mid-assign keeps stale item index (`AssignStep.tsx:107-110`)
- `share()` swallows non-abort errors with no feedback (`useSummaryExport.ts:85-88`)
- `reconciliationCents` accepted but never rendered by the image exporter (`receiptSplitImageLight.ts:26`)

Follow-up enhancements (not bugs): unassigned-items banner in SummaryStep web UI (the PNG already has one); AbortController plumbing for in-flight scans; skip scan-store entries for deleted receipts.
