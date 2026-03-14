# Character Evolution V2 Phase 4.5

## Purpose

Define the source of truth for the next Character Evolution follow-up after Phase 4.

This phase exists to solve two concrete problems without redesigning the system:

1. prompt/state growth is too large and too noisy
2. the extraction contract still encourages full-state echoing even though server-side merge already supports partial proposals

This document is intentionally scoped between Phase 4 and Phase 5:

- after matching and conflict handling
- before full decay policy work
- before broader settings/UI completion

## Status

Assume:

- Phase 1 is complete
- Phase 2 is complete
- Phase 2.5 is complete
- Phase 3 is complete
- Phase 4 is complete

This Phase 4.5 document is the source of truth for prompt projection and partial proposal contract changes before additional code work continues.

## Relationship To Existing Docs

This document extends:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-blueprint.md`
- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-ux-spec.md`

If this document conflicts with the old extraction prompt wording in current code, this document wins for the next implementation pass.

This document should be folded back into the main blueprint once implementation is complete, but until then it is the source of truth for Phase 4.5 behavior.

## Goals

Phase 4.5 must:

- stop prompt size from growing linearly with accepted active state size
- stop forcing the extractor to return a full echoed next-state object
- keep canonical accepted state and history behavior intact
- keep notes and rich metadata in canonical stored state
- keep server-side merge as the source of truth
- expose prompt projection policy in global evolution settings only
- avoid introducing per-character overrides for this policy

## Non-Goals

Phase 4.5 does not:

- redesign canonical storage
- redesign the review UI
- add decay itself
- add semantic search or embeddings
- create a second evolution settings surface

## Working Definitions

### Canonical Stored State

The full accepted evolution state stored locally.

This is the rich source of truth and may include:

- active items
- corrected items
- archived items
- notes
- source provenance
- timestamps
- reinforcement metadata such as `timesSeen`

### Compact Current State

The reduced projected state sent to the extractor model for comparison.

This is not storage.
It is a prompt-only view of the current accepted state.

It exists to:

- help the extractor avoid duplicates
- help the extractor update existing memory consistently
- bound prompt size

### Transcript Slice

The processed message range for the current handoff run.

This is not the full chat transcript.
It is only the unprocessed or explicitly replayed message range being handed to the extractor in this run.

## Core Decision 1: Prompt Projection Is A Separate Layer

Canonical accepted state may continue to store more information than prompt-time state projection sends to the model.

That means:

- accepted state remains the canonical source of truth
- prompt assembly uses a projected subset of active state
- extraction comparison also uses a projected compact state view
- history and review continue to use canonical state
- notes and rich item metadata remain stored locally even when excluded from prompt projection

Prompt projection is not storage pruning.
It is a bounded model-input view.

## Core Decision 2: Projection Settings Are Global Only

Projection policy belongs in global evolution settings, not per-character overrides.

Reason:

- this is advanced internal memory policy
- the UX spec says advanced policy belongs in global settings, not the main chat flow
- users should not be tuning prompt-budget mechanics character by character during normal use

Rules:

- no per-character override UI for projection ranking or limits
- effective projection policy is always taken from global evolution defaults
- character-level evolution settings remain focused on enablement, section behavior, and prompt/template compatibility

Future extension is allowed:

- implementation may leave a clear code-level extension point for later character-specific projection overrides
- but Phase 4.5 does not expose or support those overrides in product behavior or UI

## Core Decision 3: Extraction Uses Partial `proposedState`

The extraction contract changes from full-state echoing to changed-sections-only output.

New contract:

- `proposedState` contains only sections that changed in the processed transcript range
- omitted section means no change
- `changes` contains only changed sections
- if a section must be cleared or replaced, that section must be included explicitly with the intended empty object/array/value

Examples:

- no change:
  - `proposedState: {}`
  - `changes: []`
- update one section:
  - `proposedState.userFacts = [...]`
  - `changes = [{ sectionKey: "userFacts", ... }]`
- clear one section:
  - `proposedState.runningJokes = []`
  - `changes = [{ sectionKey: "runningJokes", ... }]`

## Core Decision 4: Server Merge Remains Source Of Truth

Server-side merge behavior remains canonical.

The extractor does not become authoritative for full-state replacement.

Pipeline meaning:

1. extractor returns only changed sections
2. pending proposal remains a partial changed-sections proposal for review
3. server treats omitted sections as no change
4. server sanitizes by section/privacy rules
5. server conflict handling and matcher logic remain authoritative
6. accepted canonical state is still produced server-side at accept time

This means:

- no schema migration is required for storage
- no version-file migration is required
- fullscreen review remains the primary place where the partial proposal is compared against the full current state
- the main code task is aligning prompt contract, pending proposal storage, and acceptance merge behavior with the intended partial-proposal model

Important clarification:

- omitted section in `pendingProposal.proposedState` means no change
- `pendingProposal.proposedState` should remain partial for review
- the server should not materialize omitted sections into a full next-state object before the user reviews the proposal
- the full merged next-state object is produced at acceptance time, not staged as the pending proposal itself
- the partial proposal contract applies consistently to model output, pending proposal storage, review payloads, and accept payloads

## Core Decision 5: Compact Current State Still Gets Sent

The extractor should still receive current state for comparison and dedupe, but only in compact projected form.

Compact projected current state should:

- include only active items
- strip `note`
- strip `sourceChatId`
- strip `sourceRange`
- strip `updatedAt`
- strip `lastSeenAt`
- strip `timesSeen`
- keep `value`
- keep `confidence`
- do not include `status`

Archived/corrected items should not be included in the projected extractor input.

This is prompt-budget reduction only.

- notes must still be extracted and stored in canonical local state when the model provides them
- notes must remain visible/editable in fullscreen review and canonical state/history views
- notes must not be included in prompt projection for generation or compact extractor comparison input

### Note Expectations

Notes are local canonical memory support, not prompt steering data.

They exist to preserve short evidence/context for humans and future local inspection.

Notes should work like this:

- existing item already has a note and the new proposal matches that item without a replacement note:
  - preserve the existing note locally
- new item is added and the model provides a note:
  - store the note locally
- existing item is materially updated and the model provides a replacement note:
  - store the replacement note locally
- new item is added and the model does not provide a note:
  - the item may still be valid, but the system should treat this as missing optional support context rather than prompt data

Extractor guidance for notes:

- notes should normally be included for new or materially updated list items when the transcript provides enough support to write a short evidence/context sentence
- notes remain optional at schema level, but the intended extractor behavior is to provide them whenever there is clear support
- notes should be brief and local to the item, not mini-summaries of the entire scene

## Projection Policy Model

Projection policy has 2 editable dimensions:

1. ranking order
2. per-section item limits

These settings apply separately to:

- normal generation prompt projection
- extraction comparison prompt projection

### Ranking Buckets

Projection ranking is edited by section bucket, not per individual section.

Buckets:

- fast
  - `activeThreads`
  - `runningJokes`
  - `keyMoments`
- medium
  - `userRead`
  - `characterHabits`
  - `characterBoundariesPreferences`
- slow
  - `userFacts`
  - `characterLikes`
  - `characterDislikes`
  - `userLikes`
  - `userDislikes`
  - `characterIntimatePreferences`
  - `userIntimatePreferences`

`relationship` and `lastInteractionEnded` are always included object sections and are not part of the item-limit system.

### Editable Ranking Fields

Allowed ranking fields:

- `confidence`
- `timesSeen`
- `lastSeenAt`
- `updatedAt`

Users edit ranking as an ordered priority list for each bucket:

- fast bucket ranking
- medium bucket ranking
- slow bucket ranking

Implementation note:

- deterministic fallback tie-breaking may remain internal and does not need to be user-configurable in Phase 4.5
- ranking is configured by bucket, not per section

### Editable Limits

Users edit per-section item limits for:

- generation prompt
- extraction prompt

This is global-only configuration.

## Default Projection Policy

Initial defaults:

### Ranking Defaults

- fast: `lastSeenAt`, `updatedAt`, `timesSeen`, `confidence`
- medium: `lastSeenAt`, `timesSeen`, `confidence`, `updatedAt`
- slow: `confidence`, `timesSeen`, `lastSeenAt`, `updatedAt`

### Generation Limits

- `activeThreads`: 2
- `runningJokes`: 2
- `characterLikes`: 3
- `characterDislikes`: 3
- `characterHabits`: 2
- `characterBoundariesPreferences`: 2
- `userFacts`: 4
- `userRead`: 3
- `userLikes`: 2
- `userDislikes`: 2
- `keyMoments`: 2
- `characterIntimatePreferences`: 3
- `userIntimatePreferences`: 3

### Extraction Limits

- `activeThreads`: 3
- `runningJokes`: 3
- `characterLikes`: 4
- `characterDislikes`: 4
- `characterHabits`: 3
- `characterBoundariesPreferences`: 3
- `userFacts`: 6
- `userRead`: 4
- `userLikes`: 3
- `userDislikes`: 3
- `keyMoments`: 3
- `characterIntimatePreferences`: 4
- `userIntimatePreferences`: 4

## Validation Expectations

Phase 4.5 should add at least light consistency validation or test coverage for the new partial proposal contract.

Required rules:

- if `changes` lists a section, that section must also exist in `proposedState`
- if `proposedState` is empty and `changes` is non-empty, reject the payload as malformed
- if a section is intentionally cleared, it must be present explicitly with the intended empty shape
- if a section appears in `proposedState`, its value is the full intended next value for that section, not an item-level patch
- if a pending proposal is stored, omitted sections must remain omitted in the stored proposal payload
- if a pending proposal is edited in fullscreen review, the submitted payload should still follow the same partial changed-sections contract
- if the user edits only one changed section, acceptance should not require or synthesize unrelated unchanged sections in the review payload

Malformed extractor output must not create a pending proposal.

## UI Scope

Phase 4.5 adds projection policy controls only to:

- `Other Bots -> Evolution`

Do not add these controls to:

- per-character evolution setup
- sidebar review
- main chat flow

The settings UI should present:

- editable ranking order for fast / medium / slow buckets
- editable generation per-section limits
- editable extraction per-section limits
- short explanation that these settings bound model input, not stored history
- a simple advanced global editing UI rather than a preset-first workflow

Fullscreen review behavior in Phase 4.5 should be understood as:

- only changed sections are surfaced as proposal sections
- unchanged sections should not appear as changed sections
- within a changed section, unchanged rows/items may still be optionally expandable for context
- those optionally expanded unchanged rows/items are review context only, not part of the pending proposal contract
- sidebar remains operational/status-oriented and is not the full editing surface

## Delivery Shape

Phase 4.5 implementation should touch:

- extraction prompt contract text
- compact current-state projection for extractor input
- bounded prompt projection for live prompt generation
- global defaults schema + normalizers + settings UI
- proposal normalization/validation tests
- docs updated to reflect Phase 4 complete and Phase 4.5 added

## Acceptance Criteria

Phase 4.5 is complete when:

- extractor prompt no longer instructs the model to return full-state echoes
- omitted `proposedState` sections mean no change
- stored pending proposals keep omitted sections omitted
- compact current-state projection is used in extractor input
- bounded prompt projection is used in normal generation prompt assembly
- ranking and limits are editable in global evolution settings
- projection policy is not exposed as a per-character override
- canonical accepted state and version history behavior remain unchanged
- notes remain stored locally in canonical state while excluded from prompt projection
- tests cover partial proposal merge behavior and projection policy behavior

## Finalized Decisions

The following decisions are finalized for implementation:

1. Ranking is edited by bucket, not per section.
2. Limits are edited per section for both generation and extraction.
3. `relationship` and `lastInteractionEnded` stay always included and are not item-capped in Phase 4.5.
4. Validation is runtime rejection for obviously inconsistent extractor payloads.
5. Compact extractor comparison state includes `value` and optional `confidence`, but not `status`.
6. Global settings should use a simple advanced editing UI, not presets-first.
7. Fullscreen review should show changed sections only, while allowing optional unchanged context within a changed section.
8. Notes remain part of canonical stored state and review data, but are excluded from prompt projection.
9. The partial changed-sections contract applies end to end: extractor output, pending proposal storage, review edits, and acceptance payloads.
10. Notes should normally be generated for new or materially updated items when transcript support is clear, while remaining excluded from prompt projection.
