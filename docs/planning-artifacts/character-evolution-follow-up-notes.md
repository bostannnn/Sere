# Character Evolution Follow-Up Notes

## Purpose

This note captures the remaining cleanup after the retention rollout and the handoff replay fix.

It is not a new source of truth for the whole system.
It is a short follow-up list for:

- the changed-subset extractor contract
- stale built-in prompt migration
- prompt simplification
- live validation
- residual complexity cleanup

## What Was Fixed

The main bug was not in decay itself.
It was a contract mismatch:

- docs and merge semantics expect handoff proposals to contain changed subsets
- the extractor prompt drifted toward full-section or full-state replay
- unchanged replayed items were then refreshed during accept

The code changes now do three things:

1. The built-in extraction prompt uses changed-subset semantics for list sections.
2. Handoff staging prunes unchanged echoed active items in non-reinforcement sections before storing `pendingProposal`.
3. Normalization upgrades known legacy built-in extraction prompts to the new built-in prompt on load.

## Why The Latest Live Test Still Looked Wrong

The last live handoff still used the old extractor contract because the saved settings data still contained the legacy built-in prompt text.

That means:

- a restart is required so the new normalizer path is used
- or the extraction prompt must be manually replaced in the UI

Without that, live handoffs may continue to replay full sections even though the code fix exists.

## Remaining Work

### 1. Verify The Fixed Contract In A Live Run

After restart or manual prompt update:

- run one new handoff
- inspect the handoff log
- confirm the prompt says changed-subset semantics, not full replacement
- confirm `pendingProposal` does not carry forward unchanged `userRead`, `characterHabits`, or `keyMoments`
- accept the proposal
- confirm old items do not get refreshed unless they were materially updated

### 2. Simplify The Global Extraction Prompt

The current extraction prompt is still too long.

Target state:

- global prompt only defines the core contract
- section-specific behavior comes from section config instructions
- hard guarantees remain in server-side code

Keep in the global prompt:

- JSON-only output contract
- changed-section semantics
- changed-item semantics for list sections
- full-object semantics for `relationship` and `lastInteractionEnded`
- no invention
- prefer under-extraction

Move emphasis to section configs for:

- what belongs in `userFacts`
- what belongs in `userRead`
- what qualifies as a habit
- what qualifies as a boundary
- intimate preference rules

### 3. Reduce Built-In Prompt Drift Risk

The built-in extraction prompt should not behave like arbitrary persisted free text forever.

Preferred direction:

- treat the built-in prompt as versioned application behavior
- continue allowing full custom prompt overrides
- auto-upgrade old known built-in variants
- expose a clear reset-to-default action in UI if not already obvious

### 4. Make The Mental Model Easier To Follow

The logic is valid, but it is too easy to confuse these layers:

- prompt projection
- extractor proposal
- staged pending proposal
- accepted canonical state
- decay / retention
- version snapshots

Documentation should consistently describe them in this order:

1. What the model sees
2. What the model proposes
3. What the app stages for review
4. What accept merges into canonical state
5. What retention later archives or deletes

### 5. Keep More Policy In Code Than In Prompt Text

Prompt text is the weakest place to enforce correctness.

Prefer code for:

- dedupe
- unchanged-item pruning
- privacy stripping
- metadata normalization
- historical preservation
- merge conflict handling
- retention and decay

Prompt text should mostly guide extraction judgment, not enforce storage invariants.

## Suggested Next Order

1. Restart app/server or manually replace the extraction prompt.
2. Run one live handoff and accept cycle.
3. Verify logs and resulting `character.json`.
4. Shorten the global extraction prompt.
5. Re-test live handoff behavior after prompt simplification.
6. Update public docs if prompt behavior or terminology changed.

## Residual Risks

- Old saved settings may continue to carry legacy prompt text until the app reload path normalizes them.
- Long section instructions plus long global prompt can still encourage extractor inconsistency.
- `characterHabits`, `userRead`, and `keyMoments` remain the highest-risk sections for semantic duplication or near-duplicate phrasing.
- Live behavior depends on what the running app actually loaded, not only what exists in source.

## Done When

- handoff prompt in live logs uses changed-subset wording
- staged proposals no longer replay unchanged active items
- accepted state no longer refreshes old medium/slow items unless materially changed
- extraction prompt is shorter and easier to maintain
- section configs carry more of the section-specific policy
