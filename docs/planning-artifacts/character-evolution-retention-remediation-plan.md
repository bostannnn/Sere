# Character Evolution Retention Remediation Plan

## Goal

Keep character evolution `currentState` compact and stable over time without losing useful history.

The design should:

- keep merge semantics for handoffs
- preserve short-term non-active history in `currentState`
- delete stale non-active items from `currentState`
- rely on existing version snapshots under `states/v*.json` as durable history
- reduce prompt-size pressure without changing the meaning of stored memory
- improve resilience when the extraction model returns malformed JSON

## Status Update

The plan is now largely implemented.

Implemented:

- retention defaults, normalization, and UI editing
- non-active aging/deletion from `currentState`
- stored caps for configured sections
- duplicate/refinement tightening for high-growth sections
- malformed-JSON retry during accept flow
- version mutation APIs and history UI actions
- destructive-action previews in the UI
- next-handoff retention preview via route and bulk dry-run CLI
- current-state compaction/apply via offline CLI with backups and manifest output
- extractor-side compact prompt rendering

Current operational distinction:

- `POST /data/character-evolution/:charId/retention/dry-run`
  - previews what would happen on the next accepted handoff
- `pnpm run evolution:retention:apply -- --preview`
  - previews what would be compacted from `currentState` now
- `pnpm run evolution:retention:apply`
  - applies offline cleanup to `character.json` only and leaves `states/v*.json` untouched

## Confirmed Product Decisions

### 1. Handoff semantics are merge, not full replacement

When the extractor includes a section, it is returning the changed subset for that section, not the full authoritative replacement.

Implications:

- omitted active items should remain active by default
- unchanged items should be carried forward
- decay should archive items only after they go unseen across multiple accepted handoffs

### 2. Status model stays simple

Keep only:

- `active`
- `corrected`
- `archived`

Do not add a `purged` status. Old items can be removed from `currentState` without introducing a fourth lifecycle state.

### 3. Existing version snapshots are enough for durable history

The canonical `currentState` does not need to store old corrected/archived items forever. Long-term history can live in the existing version files under `states/v*.json`.

Implications:

- `currentState` should be optimized for live memory quality and size
- snapshots remain the audit trail
- no separate history log is required initially

### 4. Retention settings should be editable in the UI

Retention behavior should not stay hardcoded once implemented.

The UI should allow editing:

- archive thresholds by bucket
- deletion thresholds for non-active items by bucket
- stored caps for sections that need them

Prompt projection already has a settings surface. Retention should get its own editable settings surface instead of being hidden in code.

Scope for first implementation:

- global defaults first
- no per-character retention overrides in the first pass

## Current Problems To Fix

### 1. Non-active items never age out of `currentState`

Current behavior:

- `corrected` and `archived` items are preserved during merge
- decay only advances `active` items
- stale non-active items remain forever

Result:

- history accumulates indefinitely inside `currentState`
- `activeThreads` is especially affected by long chains of corrected variants

### 2. Merge semantics allow active sections to grow over time

Because handoffs are merged, omitted active items remain active. This is intended. The problem is that some sections can still accumulate too many active items if:

- they are rarely revisited directly
- near-duplicate refinements are treated as new items
- conflicting variants create corrected copies while the newer version stays active

### 3. Prompt projection protects model input but not stored state

Prompt projection currently:

- ranks active items by fast / medium / slow buckets
- limits what is sent to generation and extraction prompts

Prompt projection currently does not:

- prune accepted `currentState`
- delete old non-active entries
- cap stored active items

### 4. Extractor reliability is degraded by malformed JSON

Recent Mistral failures were invalid JSON responses, not proof that the entire stored state was rejected as input. Prompt size still matters, but the direct failure mode was malformed output.

## Already Implemented

The current system now has the core retention/version-management lifecycle.

Implemented today:

- accepted-handoff-based decay tracking through `unseenAcceptedHandoffs`
- configurable retention policy under global evolution defaults
- bucketed archive logic for active items
- non-active deletion from `currentState`
- stored caps for configured sections
- prompt projection ranking and per-section prompt limits
- retention settings UI
- version-history mutation APIs and UI
- current-state cleanup tooling with backup/manifest output

Current hardcoded archive thresholds:

- fast sections archive after `2` unseen accepted handoffs
- medium sections archive after `5`
- slow sections archive after `8`

Current gap:

- rollout/threshold tuning should be validated against more real characters
- cleanup execution remains CLI-first rather than live API/UI

## Target Lifecycle

### Active items

On each accepted handoff:

- if reinforced by the accepted proposal, reset `unseenAcceptedHandoffs` to `0`
- if not reinforced, increment `unseenAcceptedHandoffs`
- if inactivity passes a section-specific threshold, change status from `active` to `archived`

### Corrected and archived items

On each accepted handoff:

- if explicitly revived, allow them to become `active`
- otherwise increment `unseenAcceptedHandoffs`
- if inactivity passes a section-specific deletion threshold, remove them from `currentState`

This keeps recent history available for a while, but prevents permanent growth.

## Reuse of Existing Prompt Projection

The current prompt projection system should be reused instead of replaced.

Reuse:

- fast / medium / slow bucket classification
- ranking priorities such as `lastSeenAt`, `updatedAt`, `timesSeen`, and `confidence`
- per-section limit structure as a configuration model

Add beside it:

- archive thresholds for active items
- deletion thresholds for non-active items
- stored-state caps for sections that tend to grow

Important distinction:

- prompt projection decides what the model sees
- retention / pruning decides what `currentState` keeps

UI implication:

- prompt projection remains a separate settings area
- retention should be added as a sibling settings area, not folded into prompt projection
- both can reuse the same bucket language and section vocabulary
- retention settings should follow the same initial scope as prompt projection: global defaults first

## Proposed Retention Strategy

### Baseline thresholds

Keep the current archive thresholds for the first implementation pass:

- fast archive threshold: `2` accepted handoffs
- medium archive threshold: `5`
- slow archive threshold: `8`

Add deletion thresholds for non-active items:

- fast non-active deletion threshold: `6`
- medium non-active deletion threshold: `12`
- slow non-active deletion threshold: `24`
- confirmed slow non-active deletion threshold: `36`

These values should be defaults, not fixed constants. They should be editable in the UI.

Deletion should apply to both:

- `corrected`
- `archived`

Use the same bucket-based defaults for both in the first pass.

### Fast sections

Likely sections:

- `activeThreads`
- `runningJokes`
- `keyMoments`

Behavior:

- decay quickly when not reinforced
- keep only a small active set
- keep only a short-lived recent history in `currentState`

### Medium sections

Likely sections:

- `characterHabits`
- `characterBoundariesPreferences`
- `userRead`

Behavior:

- slower archive thresholds than fast sections
- moderate active caps
- moderate non-active retention windows
- `characterHabits` should keep medium decay timing but use a stricter stored cap than typical medium sections

### Slow sections

Likely sections:

- `userFacts`
- `characterLikes`
- `characterDislikes`
- `userLikes`
- `userDislikes`
- `characterIntimatePreferences`
- `userIntimatePreferences`

Behavior:

- longest retention
- looser active caps or possibly no strict active cap initially
- still allow non-active cleanup after enough accepted handoffs
- confirmed items should still be removable eventually if they go unseen long enough

## Stored Caps

Decay alone is not enough under merge semantics. Some sections can remain large because items keep getting refreshed or duplicated.

Add stored caps for canonical state, especially in fast sections.

Cap types:

- maximum active items per section
- maximum non-active items per section
- optional total item cap per section as a final safety net

Pruning order:

1. remove oldest / weakest non-active items first
2. if still over cap, archive weakest active items
3. if still over cap, trim lowest-ranked active items

Ranking should reuse the existing prompt-projection priorities where possible.

Initial priority sections for stored caps:

- `activeThreads`
- `keyMoments`
- `characterHabits`

These caps should be editable in the UI.

Recommended starting cap posture:

- `activeThreads`
  - active cap: `6`
  - non-active cap: `10`
- `keyMoments`
  - active cap: `12`
  - non-active cap: `12`
- `characterHabits`: medium decay, stricter cap
  - active cap: `6`
  - non-active cap: `8`

## Refinement and Duplicate Control

This is critical under merge semantics.

Goal:

- if a proposed item is just a better wording of the same idea, update the existing item instead of creating a new corrected-history chain

Desired behavior:

- wording refinements should usually collapse into one live item
- `corrected` should be reserved for genuine semantic replacement, contradiction, or supersession
- fast sections should have stricter duplicate collapse than slow fact/preference sections

Priority section:

- `activeThreads`

Reason:

- it is currently prone to multiple corrected variants of the same underlying thread

## Prompt-Size Reduction

Prompt-size work should focus on compacting extractor-visible state, not changing merge semantics.

Recommended approach:

1. keep prompt projection
2. shorten the extractor-facing representation of items without necessarily rewriting canonical stored values
3. keep richer stored metadata internally only if needed
4. tune per-section limits only after item compactness is improved

Potential tactics:

- compact extractor summaries instead of paragraph-like item values
- derive extractor-facing compact text from stored items instead of forcing stored values themselves to become terse
- shorter section instructions if needed
- transcript-window tuning only if still necessary after state compacting

## Extractor Reliability Hardening

Add a separate reliability pass for malformed model output.

Recommended scope:

- log exact parse position and nearby context
- add one retry path for invalid JSON
- optionally attempt safe repair for simple syntax issues
- keep schema validation strict before acceptance

This should be treated as a separate reliability improvement, not the primary retention fix.

## Existing State Cleanup

Do not rely only on passive cleanup.

Recommended rollout:

1. implement new retention and cleanup rules
2. run a dry-run analysis on existing character states
3. report what would be removed from `currentState`
4. apply cleanup after review with the offline CLI

Existing version snapshots remain the durable history layer, so deleting stale non-active items from `currentState` is safe.

## Version Management Requirements

Version snapshots are sufficient as the history layer, but the product needs better operational controls around them.

Usual operator workflow to support:

- clear accepted coverage for a specific processed message range
- rerun handoff for that range
- optionally restore a prior version as current state
- optionally delete selected versions

Important example:

- if messages `161-180` were accepted into evolution and later need to be redone, the user should be able to clear that accepted coverage and rerun handoff for that range

Required capabilities:

- remove a processed range from accepted coverage
- recompute `next unprocessed message` correctly after coverage removal
- restore `currentState` consistently when rolling back a version or deleting a version
- prevent orphaned coverage metadata that references removed or reverted versions

Recommended implementation direction:

- keep version snapshots as the source of truth for history
- add explicit UI actions for:
  - revert to version
  - delete version
  - clear accepted coverage for a version / range
  - rerun handoff from cleared range
- treat accepted coverage metadata as editable operational state, not immutable history

Rollback semantics:

- clearing accepted coverage for a range invalidates later dependent accepted ranges globally from that rollback point
- if range `161-180` is cleared, later accepted ranges after `180` are invalidated rather than preserved
- `currentState` should be restored to the last valid version before the cleared range
- rerun should then proceed forward from the cleared point

Coverage bookkeeping rules:

- `processedRanges` should be treated as the source of truth
- `lastProcessedMessageIndexByChat` should be recomputed from surviving processed ranges after every rollback / delete / coverage-clear action
- the cursor should not be patched independently
- read paths should not continue trusting an explicit cursor ahead of recomputed surviving coverage after mutation operations
- pending proposals derived from invalidated coverage or reverted state should be cleared during rollback / delete / coverage-clear operations

Snapshot mutation rule:

- retention cleanup should affect only `currentState` and future accepted versions
- old snapshot files under `states/v*.json` should not be rewritten just because retention rules changed

Manual version deletion semantics:

- deleting the latest contiguous tail version should be allowed directly
- deleting an interior historical version should be treated as a rollback from that point forward
- if an interior version is deleted, later dependent versions and processed ranges for that chat should also be invalidated
- `currentState` should be restored to the last valid version before the deleted point
- snapshot deletion through the UI should remove both:
  - version metadata
  - the corresponding snapshot file

Backend scope:

- add mutation APIs for:
  - clear accepted coverage for a version / range
  - cascade invalidation of later dependent ranges
  - restore current state to the last valid version
  - delete version metadata and snapshot files under the allowed rollback rules
- UI actions should be thin wrappers over these explicit backend operations

Safety rules:

- coverage clearing should be explicit and range-scoped
- destructive actions should preview what state version and message coverage will change
- rollback should be deterministic and based on snapshot state, not partial in-memory reconstruction

## UI Requirements

Retention needs its own UI controls.

The UI should expose:

- bucket-based archive thresholds
- bucket-based deletion thresholds
- per-section stored caps for active items
- per-section stored caps for non-active items if implemented separately

Recommended shape:

- keep prompt projection UI for prompt-facing limits only
- add a new retention panel for lifecycle / cleanup behavior
- reuse the existing fast / medium / slow bucket terminology so the model-facing and storage-facing settings stay understandable
- keep retention settings global-only in the first pass

## Suggested Execution Order

1. Validate retention thresholds against more real characters.
2. Run next-handoff preview and current-state compaction preview on representative data.
3. Apply offline cleanup with backup/manifest output.
4. Monitor before/after state-size metrics and adjust caps conservatively.

## Open Questions

### 1. How stored caps should interact with merge semantics

Stored caps are necessary, but if they are too aggressive they can behave like hidden replacement logic.

The cap policy should prefer:

- deleting stale non-active items first
- archiving weak active items before deleting active items
- using conservative active caps for merge-driven sections
