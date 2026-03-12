# Code Review Playbook

Last updated: 2026-03-10

Use this playbook for default branch reviews in this repo.

The baseline review mode is:

- **Full sweep**
- **Exhaust the branch**
- **No implicit 3-finding cap**

The goal is not to find a few bugs quickly. The goal is to cover the changed behaviors and their adjacent code paths until no more meaningful findings remain after a targeted follow-up pass.

---

## 1. Review Standard

Every normal branch review must:

- map the changed surface before judging individual lines
- review by subsystem and behavior, not file order
- inspect adjacent callers/helpers/tests, not only edited lines
- check success, failure, retry, stale-data, and partial-success paths
- use tests and checks to confirm risk, not as proof that the change is correct
- report all meaningful findings found in the structured pass

Do not stop after the first 3 issues if the branch has not been exhausted.

---

## 2. Review Workflow

### Step 1: Map the changed surface

Start with:

```bash
git diff --stat
git diff
```

Build a change map grouped by subsystem:

- route/API changes
- persistence/storage changes
- state-management changes
- UI flow changes
- schema/type changes
- tests added or modified

Then identify adjacent code that can invalidate the change:

- callers of changed functions
- helpers they call
- normalizers and defaults
- retry/conflict logic
- loaders and persistence readers
- UI actions and refresh logic
- test stubs and smoke tests

### Step 2: Review each changed behavior

For each behavior, explicitly check:

- happy path
- failure path
- retry/concurrency path
- stale-data/race path
- migration/backward-compatibility path
- partial-success path
- client/server consistency path

### Step 3: Follow the behavior through the stack

For UI changes, trace:

- action trigger
- request layer
- optimistic/local state mutation
- refresh/reload path
- error display
- remount or cross-tab behavior

For server/storage changes, trace:

- validation
- normalization
- persistence ordering
- crash consistency
- derived metadata
- read-after-write behavior
- rebuild-from-disk or fallback behavior

### Step 4: Read one layer above and below the diff

Review must include at least one layer beyond the changed lines:

- who calls this?
- what does it call?
- what test should have failed if this regressed?

Unchanged but newly inconsistent code is in scope.

### Step 5: Use tests/checks as instruments

Run focused checks after suspicious areas are identified.

Good review checks include:

```bash
pnpm exec vitest run <targeted test files>
pnpm run check
```

Use tests to validate or sharpen findings, especially around:

- failed refresh after success
- write ordering failures
- duplicate submissions
- stale event / conflict handling
- fallback snapshot reads
- local state divergence after partial failure

Passing tests do not clear logic bugs.

---

## 3. Required Review Categories

Every default review must explicitly consider all of these:

### Correctness

- wrong conditions
- invalid assumptions
- stale values
- incorrect defaults
- broken merges between old and new logic

### Data Integrity

- write ordering
- orphaned files
- missing rollback
- version/state mismatches
- metadata that can drift from source of truth

### Concurrency / Race Conditions

- duplicate submits
- cross-tab interactions
- stale base event handling
- retry semantics
- local UI actions that race with server state

### Migration / Compatibility

- older saved data
- legacy presets/settings
- fallback behavior
- normalization gaps
- branches where new logic assumes data has already been migrated

### Feature Behavior / UX Consistency

- misleading toasts
- stale panels
- disabled states that do not match server behavior
- phantom pending/review states
- labels or copy that misdescribe actual state

### Client / Server Sync

- accepted on server but stale locally
- local mutation before persistence
- refresh failure after success
- derived lists not updated after a write

### Testing Adequacy

- missing regression tests
- smoke tests that assert too little
- mocks that hide the real failure mode
- tests that only prove the success path

### Maintainability Risks

- duplicated logic between multiple entry points
- silent swallowing of important errors
- helpers whose contract invites future regressions
- branch-specific code paths that can drift apart

---

## 4. Stop Rule

A review pass is complete only when all of the following are true:

- the diff has been mapped by subsystem
- each changed behavior has been checked across success, failure, and stale/retry paths
- adjacent callers/helpers were inspected where they can invalidate the change
- relevant tests were read and missing cases were noted
- one targeted follow-up pass on suspicious areas produced no additional meaningful findings

If any of those are still incomplete, the branch has not been fully reviewed.

---

## 5. Review Output Contract

Default review output must:

- report all meaningful findings found in the structured pass
- order findings by severity
- group by impact when helpful
- include file references and concise explanations

Useful impact groups:

- data loss / corruption
- incorrect accepted behavior
- stale or misleading UI
- retry / conflict / race bugs
- missing tests / coverage holes

After findings, include:

- what was checked
- open questions or assumptions
- residual risk or unreviewed areas, if any

If no additional findings remain, say that explicitly and list what was covered so the clean review is auditable.

---

## 6. Repo Defaults

Unless the request explicitly asks for a faster or narrower pass, use:

- **Coverage:** full sweep
- **Stop rule:** exhaust branch
- **Severity threshold:** include not only P1/P2 issues, but also meaningful P3 inconsistencies that can confuse users or hide future bugs

For this repo, default review behavior should be "thorough by default," not "minimal unless asked."
