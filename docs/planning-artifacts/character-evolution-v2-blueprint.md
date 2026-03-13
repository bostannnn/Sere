# Character Evolution V2 Blueprint

## Goal

Build a character evolution system that supports one continuous evolving chat without relying on full-chat boundaries, while keeping long-term memory clean, reviewable, and stable over time.

This version must:

- support handoff on message ranges, not only full chats
- reduce over-promotion of one-scene details into permanent memory
- reuse the existing `confidence` and `status` fields instead of introducing another parallel lifecycle
- support conflict handling and decay in code
- keep settings editable from UI, with global settings owning the full advanced configuration
- keep implementation modular, with small files and helpers rather than adding more logic into large route files
- use the normalized current evolution UI as the foundation for future phases rather than building a parallel replacement surface

## Product Principles

1. One chat is not permanent truth.
2. New memory starts weak unless clearly explicit and durable.
3. Repeated evidence strengthens memory.
4. Contradictions must be resolved, not accumulated.
5. Old low-value memory should fade instead of piling up.
6. Archived memory remains stored for history, but does not steer generation.
7. Advanced behavior must be configurable from UI, not hardcoded in code paths.

## Non-Goals

- Replacing the entire chat prompt architecture in this feature.
- Building semantic search or embeddings for evolution memory in this phase.
- Full automatic acceptance of handoff proposals.
- Fully generic policy authoring language in V1.
- Throwing away the current evolution UI and replacing it with a separate parallel product surface.

## UX Source Of Truth

UI and interaction behavior for the completed feature is defined in:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-ux-spec.md`

This blueprint defines data model, lifecycle, and backend behavior.
The UX spec defines how users operate and understand the feature.

Implementation after the completed foundation phases should follow both documents together.

## Current Baseline

The merged baseline now:

- supports ranged handoff with per-chat processed cursors and accepted range history
- keeps `activeThreads`, `runningJokes`, `userRead`, and `keyMoments` as item-object arrays
- already has `confidence: suspected | likely | confirmed`
- already has `status: active | corrected | archived`
- keeps archived/corrected items in canonical accepted state while excluding them from normal prompt assembly
- uses `lastInteractionEnded` as the canonical field name, with legacy `lastChatEnded` compatibility
- still over-promotes scene material even with improved prompt rules

This blueprint assumes we keep the existing base system and evolve it incrementally.

## Core Mental Model

The system should work like this:

- recent messages stay in normal prompt context
- older messages are summarized
- handoff periodically extracts state updates from a message range
- uncertain new memory stays low-confidence
- repeated or explicit memory becomes stronger
- contradicted memory is corrected or archived
- stale memory decays over time

This is not one infinite transcript. It is a live chat plus evolving structured state.

## Canonical Meanings

### Confidence

Reuse the existing field.

- `suspected`
  - seen once or weakly supported
  - should not strongly influence future generations
- `likely`
  - supported by multiple signals or a stronger single signal
- `confirmed`
  - explicit, repeated, or clearly durable

### Status

Reuse the existing field.

- `active`
  - currently live memory
  - eligible for prompt injection
- `corrected`
  - replaced by newer or better evidence
  - kept for history only
- `archived`
  - stale, resolved, contradicted enough, or no longer relevant
  - kept for history only

### Important Simplification

Do not add a third lifecycle like `tentative`.

Use:

- `status: active`
- `confidence: suspected`

as the meaning of tentative memory.

## Meaning of Archived

`archived` means:

- the item is still stored locally for history and review
- the item is not included in normal prompt building
- the item is not treated as current truth
- the item can later be matched by code during handoff processing if new evidence clearly revives the same idea

Storage rule:

- archived and corrected items remain in the canonical accepted state
- they do not move to a separate database table or separate state file in V2
- version history stores snapshots of that same canonical state over time

Archived items are preserved, but silent.

Default rule:

- archived items are excluded from prompt assembly
- corrected items are also excluded from prompt assembly
- only active items are injected into normal character evolution prompt/state usage
- archived items are ignored by normal prompting and only used by the handoff matcher in V1

## Range-Based Handoff

## Why

To support one continuous evolving chat, handoff must work on message ranges, the same way summaries already work on ranges.

Without this, the system depends on chat boundaries and cannot evolve state cleanly inside one long conversation.

## Required Behavior

Handoff should support:

- whole-chat handoff
- explicit message-range handoff
- periodic auto-trigger handoff on ranges inside a long chat

Examples:

- messages `0..79`
- messages `80..159`
- messages `160..239`

Each accepted handoff must record exactly what range it processed.

### Whole-Chat Meaning In V2

Whole-chat handoff no longer means “reprocess the whole chat from message 0”.

It means:

- process the current unprocessed tail of the chat

Example:

- accepted range already ends at message `179`
- user chooses whole-chat handoff
- system processes only `180..latest`

Reprocessing from message `0` should require explicit replay behavior.

### Explicit Range Selection In V1

V1 should only allow contiguous next-range handoff.

That means:

- users may hand off the next unprocessed contiguous range
- users may not hand off arbitrary disjoint ranges in the middle of a chat in V1
- users may not skip ahead and leave gaps in processed coverage

Reason:

- this keeps cursor logic simple
- this avoids partial coverage ambiguity
- this keeps replay and overlap behavior predictable

## Required Metadata

Add range metadata to handoff proposal and accepted version records.

### New type: `CharacterEvolutionRangeRef`

```ts
{
  chatId: string
  startMessageIndex: number
  endMessageIndex: number
}
```

### Extend `CharacterEvolutionPendingProposal`

Add:

```ts
sourceRange: CharacterEvolutionRangeRef
```

### Extend `CharacterEvolutionVersionMeta`

Add:

```ts
range?: CharacterEvolutionRangeRef
```

### Extend `CharacterEvolutionVersionFile`

Add:

```ts
range?: CharacterEvolutionRangeRef
```

### Extend `CharacterEvolutionSettings`

Keep `lastProcessedChatId` for backward compatibility during migration, but move toward:

```ts
lastProcessedMessageIndexByChat?: Record<string, number>
processedRanges?: Array<{
  version: number
  acceptedAt: number
  range: CharacterEvolutionRangeRef
}>
```

Recommended final behavior:

- `lastProcessedMessageIndexByChat` is the fast runtime cursor
- `processedRanges` is the durable history

## Range Rules

- ranges for a chat must not overlap accepted ranges unless `forceReplay` is explicitly used
- the system may allow replay of an already accepted range, but only explicitly
- if a new handoff tries to process an already accepted range without replay, reject it
- if a new handoff finishes after another request already accepted the same or overlapping range, reject it
- if a proposal is already pending, block new range handoffs until that proposal is accepted or rejected

### Pending Proposal And Ongoing Chat

Pending proposal must block only new handoff creation, not normal chat messaging.

Behavior:

- the chat may continue while a proposal is pending
- new messages are allowed
- no second handoff is created until the pending proposal is resolved

If the pending proposal is accepted:

- the processed cursor advances to the accepted range end
- the next handoff starts after that range

If the pending proposal is rejected:

- the processed cursor does not advance
- the next handoff starts again from the same unaccepted range start and includes the newer tail

## State Model

## Sections That Should Become Item Objects

To support decay, conflict handling, and source tracking consistently, the following sections should be migrated from string arrays to item-object arrays:

- `activeThreads`
- `runningJokes`
- `userRead`
- `keyMoments`

They should use the same item shape as existing list sections.

## Canonical Item Shape

Current base:

```ts
{
  value: string
  confidence?: "suspected" | "likely" | "confirmed"
  note?: string
  status?: "active" | "corrected" | "archived"
  sourceChatId?: string
  updatedAt?: number
}
```

Extend with:

```ts
{
  sourceRange?: {
    startMessageIndex: number
    endMessageIndex: number
  }
  lastSeenAt?: number
  timesSeen?: number
}
```

## Why These Fields Matter

- `sourceChatId`
  - provenance by chat
- `sourceRange`
  - provenance by range
- `updatedAt`
  - last modified timestamp
- `lastSeenAt`
  - last reinforced timestamp
- `timesSeen`
  - promotion and decay signal

## Relationship and LastInteractionEnded

Keep these as objects for now:

- `relationship`
- `lastInteractionEnded`

But define special handling:

- `relationship` should be updated conservatively
- `lastInteractionEnded` should always be fast-decay, since it is scene residue by design

## Schema Rename

Rename:

- `lastChatEnded`

to:

- `lastInteractionEnded`

Reason:

- once handoff becomes range-based, the field no longer literally means a full chat ending
- the new name correctly reflects the latest processed interaction segment

Migration rule:

- readers must accept both `lastChatEnded` and `lastInteractionEnded` during migration
- writers should emit only `lastInteractionEnded` once migration is active
- version file readers should normalize old snapshots into the new runtime shape

## Prompt and Runtime Semantics

The LLM must not be expected to infer the meaning of status and confidence without instruction.

The extractor prompt must include short semantic definitions:

- `status: active` means currently relevant and live
- `status: corrected` means superseded by newer evidence and not current
- `status: archived` means history only and not current
- `confidence: suspected` means weak or first-pass evidence
- `confidence: likely` means moderate support
- `confidence: confirmed` means explicit, repeated, or clearly durable

The prompt must also say:

- prefer updating confidence on an existing matching item over creating duplicates
- prefer correcting or archiving contradictory old items over leaving both active
- prefer `lastInteractionEnded` and `keyMoments` for fresh scene details
- prefer under-extraction over over-extraction

## Critical Configuration Rule

All extraction policy settings introduced by this feature must be editable in UI.

Do not hardcode new behavior like:

- decay windows
- promotion thresholds
- range trigger intervals
- matching thresholds
- conflict policy toggles
- prompt text
- section-level extraction behavior

This feature may continue to use current code-backed defaults, but those defaults must be surfaced and editable through UI-backed settings.

Advanced configuration belongs in global settings.

Sidebar should only contain:

- enabled / disabled
- use global defaults
- model
- max tokens
- run handoff now
- current handoff status
- maybe auto-handoff on/off if needed

Global settings should contain:

- extraction prompt and scaffolding settings
- section rules
- range handoff behavior
- decay rules
- conflict policy
- matching policy
- privacy settings

Character-level UI should stay operational and lighter-weight.
Normalize current UI first, then build future controls on top of that structure.

## Matching and Promotion

## Item Matching

On each accepted handoff, code must attempt to match newly proposed items against existing active or archived items in the same section.

Matching should be deterministic and code-driven, not purely left to the model.

V1 matching strategy:

1. exact normalized `value` match
2. exact normalized match after punctuation and case cleanup
3. simple configurable alias or similarity helper later if needed

Do not start with embeddings or fuzzy semantic systems.

## Promotion Rules

When a new proposal item matches an existing active item:

- update `lastSeenAt`
- increment `timesSeen`
- increase confidence if evidence is stronger or repeated
- keep `status: active`

When a new proposal item matches an archived item:

- either revive the archived item to `active`
- or create a new active item and leave the archived one intact

V1 recommendation:

- revive the archived item if it is clearly the same normalized value

## Initial Confidence Rules

When a new item first appears:

- explicit factual statement:
  - `confirmed`
- strong but not explicit inference:
  - `likely`
- weak single-scene inference:
  - `suspected`

Conservative rule:

- if the model is unsure, prefer `suspected` or no item at all

## Conflict Handling

Conflict handling must happen in code after model output normalization.

### Core Rules

1. Same idea, stronger evidence

- keep existing item
- raise confidence
- update note, `updatedAt`, `lastSeenAt`, `timesSeen`

2. New idea replaces old idea

- old item becomes `corrected`
- new item becomes `active`

3. Old idea is no longer useful or relevant

- old item becomes `archived`

4. Both ideas can coexist

- keep both `active`

### Conflict Resolution Guidelines

- use `corrected` for direct replacements
- use `archived` for fade-outs or resolved relevance
- never keep mutually contradictory items both active if they refer to the same domain and cannot both be true

### Examples

Example: direct correction

- old active:
  - `user dislikes AI roleplay`
- new evidence:
  - user is actively building and enjoying AI roleplay UI
- result:
  - old becomes `corrected` or `archived`
  - new becomes `active`

Example: coexistence

- old active:
  - `user likes dark fantasy`
- new active:
  - `user likes quiet domestic scenes`
- result:
  - both remain active

## Decay

Decay must be section-specific.

The goal is not perfect realism. The goal is predictable, simple memory hygiene.

## Decay Buckets

### Fast Decay

- `activeThreads`
- `runningJokes`
- `keyMoments`
- `lastInteractionEnded`

Rule:

- if unseen for 2 accepted handoffs, archive unless reinforced

### Medium Decay

- `userRead`
- `characterHabits`
- `characterBoundariesPreferences`

Rule:

- if unseen for 5 accepted handoffs, archive or soften unless reinforced

### Slow Decay

- `userFacts`
- `characterLikes`
- `characterDislikes`
- `userLikes`
- `userDislikes`
- `characterIntimatePreferences`
- `userIntimatePreferences`

Rule:

- `confirmed` items do not automatically decay in V1
- `suspected` items archive if unseen for 8 accepted handoffs
- `likely` items may archive after 8 accepted handoffs if contradictory or stale

## Special Cases

### LastInteractionEnded

Always overwrite with the most recent accepted handoff range.

This is not durable long-term memory.

### Relationship

`relationship` should not automatically decay in V1.

Rule:

- only update `relationship` when new accepted handoff evidence changes it
- do not auto-soften, auto-clear, archive, or otherwise decay the relationship object in V1

### ActiveThreads

These represent unresolved carry-forward loops.

Rules:

- active when unresolved
- archived when resolved or stale
- corrected only if replaced by a more accurate formulation

### RunningJokes

Rules:

- do not survive forever by default
- archive quickly if not revisited
- a joke can come back later as a revived item

## Handoff Extraction Rules

The extractor sees:

- effective evolution settings
- current active state
- current transcript range
- section rules

The extractor should not rely on full character card identity context as evidence for state changes.

The extractor should be instructed to:

- update durable sections conservatively
- push fresh scene residue into `lastInteractionEnded`
- push important one-range developments into `keyMoments`
- avoid creating duplicates when an existing item already covers the same fact

## Acceptance Pipeline

### On Handoff Request

1. validate character and chat
2. resolve effective settings
3. determine range to process
4. reject if overlapping accepted range exists and replay is not enabled
5. build prompt messages
6. call extractor
7. normalize extractor output
8. run code-side match and conflict handling
9. store pending proposal with range metadata

### On Proposal Accept

1. load current accepted state
2. re-apply sanitization and privacy rules
3. merge proposed items against current state using matcher
4. preserve existing archived and corrected items unless the accepted proposal explicitly revives, replaces, or edits them
5. save the merged full state as the next accepted canonical state
6. run conflict rules
7. run decay pass
8. save accepted version file with range metadata
9. update fast cursors and processed range history
10. clear pending proposal

Important:

- prompt building may use an active-only filtered view
- pending proposals may omit archived/corrected items from normal review focus
- accept must not treat omission from the active-only proposal as deletion from canonical state
- archived/corrected items remain stored in `currentState` for later history, matching, conflict handling, and decay

## Auto-Handoff Triggers

This feature should support both manual and automatic triggers.

V1 triggers:

- manual handoff on current unprocessed range
- automatic every `N` new messages in a chat
- automatic when chat is explicitly ended or split

Default recommendation:

- auto-create proposal
- do not auto-accept proposal

### Auto-Handoff Counter Rule

When auto-handoff is configured to run every `N` new messages:

- count from the end of the last accepted handoff range
- do not count from rejected proposals
- rejected proposals do not advance the processed cursor
- the next proposal should begin at the last accepted handoff end + 1

## UI Requirements

## Global Settings

Global settings must expose the full advanced config for evolution:

- extraction provider and model
- extraction max tokens
- extraction prompt
- section configs
- privacy flags
- range handoff toggle
- default range size in messages
- auto-handoff toggle
- auto-handoff trigger interval
- replay behavior
- decay policy per section group
- conflict policy
- matching policy

V1 can use grouped settings rather than fully custom per-section scripting.

## Sidebar Settings

Sidebar should stay minimal:

- enabled
- use global defaults
- model
- max tokens
- maybe privacy shortcuts
- run handoff now
- show pending proposal

Do not overload the sidebar with all advanced lifecycle settings.

## Prompt Builder Configuration Rule

The architecture should move toward UI-editable prompt scaffolding.

Even if the existing memory extraction prompt builder remains hardcoded today, this feature must not introduce more hardcoded policy that cannot be changed from UI.

At minimum, the following must be configurable:

- extraction prompt text
- section instructions
- confidence guidance
- status guidance
- range trigger thresholds
- decay thresholds
- matching rules where practical

## File Organization

Follow the refactoring style already established:

- extract helpers from large files
- keep files below 500 LOC
- prefer focused modules over large route files

Recommended server modules:

- `server/node/llm/character_evolution/range.cjs`
- `server/node/llm/character_evolution/matcher.cjs`
- `server/node/llm/character_evolution/conflicts.cjs`
- `server/node/llm/character_evolution/decay.cjs`
- `server/node/llm/character_evolution/metadata.cjs`
- `server/node/llm/character_evolution/policies.cjs`

Recommended client and shared modules:

- `src/ts/character-evolution/schema.ts`
- `src/ts/character-evolution/constants.ts`
- `src/ts/character-evolution/normalizers.ts`
- `src/ts/character-evolution/selectors.ts`
- `src/ts/character-evolution/settings-groups.ts`

Route files should stay orchestration-only.

## Migration Plan

V2 should not try to automatically upgrade noisy old evolution state in place.

Recommended rollout:

1. hard reset current evolution state
2. move old evolution version files to a legacy/archive location
3. rerun handoffs using the new V2 logic

Recommended archive location:

- `states-legacy/`

Behavior:

- legacy files remain on disk for historical inspection
- legacy files are not included in normal V2 version history UI
- V2 version history starts clean after reset

## Schema Transition Requirements

1. Add range metadata fields as optional.
2. Add new runtime cursors as optional.
3. Convert string-array sections to item-object arrays.
4. Preserve old version files without rewriting unless needed.
5. Treat old evolution state as legacy rather than auto-migrating confidence/status quality.

## Migration Compatibility

During migration:

- readers must accept both old and new forms for migrated sections
- writers should always write the new canonical form
- a reset-and-rebuild flow is the preferred path for real usage

## Phased Implementation

Completed phases so far:

- Phase 1
- Phase 2
- Phase 2.5
- Phase 3
- Phase 4

Remaining planned phases:

- Phase 4.5
- Phase 5
- Phase 6

## Phase 1: Range Handoff Foundation (Complete)

Deliver:

- range metadata type
- pending proposal range support
- accepted version range support
- per-chat processed cursor
- manual ranged handoff endpoint behavior

Acceptance:

- can handoff only new messages from one long chat
- replay requires explicit flag
- overlapping accepted range is rejected

## Phase 2: Section Normalization (Complete)

Deliver:

- migrate `activeThreads`, `runningJokes`, `userRead`, `keyMoments` to item objects
- update normalizers, proposal sanitization, UI editors, version file readers

Acceptance:

- all durable-ish sections except `relationship` and `lastInteractionEnded` use a consistent item shape

## Phase 2.5: Archived State Retention (Complete)

Deliver:

- keep archived/corrected items in canonical accepted state even when prompt-building and proposal review operate on active-only slices
- change accept from full-state replacement to merge-on-accept for item-array sections
- preserve archived/corrected rows by default unless the accepted proposal explicitly changes or revives them
- keep route logic thin by extracting merge helpers

Acceptance:

- accepting a proposal that omits archived/corrected items does not delete them from `currentState`
- normal prompt assembly still injects only active items
- archived/corrected items remain available for history, later matcher work, conflict handling, and decay
- no new separate archive store or parallel state model is introduced

Example:

- current accepted `characterLikes` contains:
  - `Stalker` (`active`)
  - `Dead Man` (`archived`)
  - `Texas Chain Saw` (`active`)
- prompt-building sends only:
  - `Stalker`
  - `Texas Chain Saw`
- accepted proposal returns only:
  - `Stalker`
  - `Texas Chain Saw`
- after accept, canonical `currentState.characterLikes` still contains:
  - `Stalker` (`active`)
  - `Dead Man` (`archived`)
  - `Texas Chain Saw` (`active`)

This omission means:

- `Dead Man` is not part of the active prompt slice
- not that `Dead Man` should be deleted from canonical stored state

## Phase 3: Matching and Promotion

Deliver:

- exact-match and normalized-match item matcher
- `timesSeen`, `lastSeenAt`, confidence updates
- archived item revival on clear match

Acceptance:

- repeated same item upgrades confidence instead of duplicating

## Phase 4: Conflict Handling

Deliver:

- replacement logic
- `corrected` transitions
- contradictory active item prevention

Acceptance:

- direct contradictions do not remain as two active items in the same section

## Phase 4.5: Prompt Projection and Partial Proposal Contract

Source of truth:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-phase-4-5.md`

Deliver:

- bounded prompt projection for normal generation prompt assembly
- bounded compact current-state projection for extractor comparison input
- changed-sections-only `proposedState` contract
- runtime rejection of obviously inconsistent partial proposal payloads
- global-only settings for projection ranking and per-section limits

Acceptance:

- prompt growth no longer scales linearly with total active canonical state
- extractor is no longer instructed to echo the full next state object
- omitted `proposedState` sections mean no change
- included `proposedState` sections are full replacements for those sections
- malformed extractor payloads do not create pending proposals
- projection policy is editable from global settings and not exposed as a per-character override

## Phase 5: Decay

Deliver:

- section-bucket decay rules
- archive stale items based on unseen accepted handoff count
- overwrite semantics for `lastInteractionEnded`

Acceptance:

- active threads, key moments, and jokes fade quickly
- facts and confirmed preferences remain stable

## Phase 6: Settings and UI Completion

Deliver:

- global settings for range, decay, conflict, and matching policies
- minimal sidebar settings
- UI explanation of confidence and status

Acceptance:

- advanced behavior is editable from UI
- new policy is not trapped in hardcoded route logic

## Tests

Required test coverage:

- range overlap rejection
- replay of already accepted range
- cursor advancement per chat
- string-array migration to item-object arrays
- confidence promotion on repeat
- archived item revival
- corrected status on direct replacement
- prompt projection policy behavior
- partial proposal validation for changed-sections-only extractor output
- fast decay for active threads and key moments
- slow decay behavior for facts and preferences
- prompt exclusion of corrected and archived items
- UI normalization and persistence of global settings

## Manual QA

Manual scenarios to validate:

1. Long single chat with multiple range handoffs
2. Repeated joke across separate ranges upgrades rather than duplicates
3. One-off joke archives after enough accepted handoffs
4. Conflicting user preference gets corrected
5. Archived item stays visible in review UI but not in prompt behavior
6. Global settings changes apply to new handoffs without code edits

## Final Simplified Rules

If implementation gets too complex, fall back to these rules:

- use ranges, not full chats
- use only `confidence` and `status`
- archive means stored but not prompted
- only active items are prompted
- fast sections decay after 2 accepted handoffs unseen
- medium sections decay after 5 accepted handoffs unseen
- slow sections only decay if low-confidence and unseen for 8 accepted handoffs
- exact match first
- no embeddings in V1

That is the smallest version that still achieves the product goal.
