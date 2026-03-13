# Character Evolution V2 UX Spec

## Purpose

Define the user-facing UX for the full Character Evolution V2 feature so implementation after Phase 1 does not drift into ad hoc screens and settings.

This document complements:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-blueprint.md`

The blueprint defines behavior and data rules.
This document defines how users see, operate, review, and configure the system.

## Foundation Rule

The current implemented evolution UI is the foundation for V2 UX.

That means:

- normalize and simplify the current screens first
- preserve working current interaction patterns unless there is a clear UX reason to change them
- build future features on top of the normalized structure
- do not create a parallel replacement UI for the same feature area

This spec is not a mandate to throw away the current UI.
It is a guide for cleaning it up and using it as the base for future evolution features.

## Core UX Principle

The user should not feel like they are managing internal memory mechanics.

The product should feel like:

- the chat keeps going
- the system periodically suggests memory updates
- the user reviews and approves them
- advanced policy lives in one settings area
- history is inspectable when needed
- archived/corrected memory exists, but stays out of the main flow

This is a character memory system, not a data-management console.

## Product Model

The user-facing mental model is:

1. Chat normally.
2. Evolution watches for meaningful updates.
3. A proposal appears when there is something to review.
4. The user accepts or rejects it.
5. The accepted state becomes the current remembered character state.

The user should not have to think in terms of:

- raw processed ranges
- cursor math
- decay windows
- conflict resolution internals
- active vs archived storage semantics during normal use

Those mechanics may appear in advanced settings and history views, but not in the main flow.

## Main Surfaces

The completed feature has 4 primary surfaces.

### 1. Sidebar

Purpose:

- show current evolution status for the active character/chat
- surface the next meaningful action
- give access to the current management tabs
- host history and settings entry points

The sidebar is not a full review workspace.

### 2. Fullscreen Review

Purpose:

- review the current pending proposal
- inspect exact changes and evidence
- make light edits if needed
- accept or reject

This is the only full proposal review/edit surface.

Current implementation baseline:

- keep the current chat-level fullscreen review shell pattern
- do not replace it with a different container model unless a later implementation need forces it

### 3. Global Defaults Settings

Location:

- `Other Bots -> Evolution`

Purpose:

- own advanced behavior and policy
- define global extraction/runtime/configuration behavior
- hold settings that should not clutter the chat flow

### 4. History and Archived Memory

Primary access:

- inside the sidebar via the History tab

Secondary expansion:

- archived/corrected traits may use a dedicated nested modal or subview

Purpose:

- inspect accepted versions
- inspect prior snapshots
- inspect archived/corrected memory when needed
- support trust and debugging

History is part of the product, but not part of the default daily flow.

## Sidebar UX

## Sidebar Tabs

Keep tabs.

Current tab model remains valid:

- Setup
- Sections
- Review
- State
- History

But their roles must be clarified.

### Sidebar Review Tab

This tab is not the place for full diff editing.

It should show:

- pending proposal status
- source chat identity
- processed scope summary
- short summary of changed sections
- primary `Open Fullscreen Review`
- secondary quick actions only if truly safe

It should not show:

- full section diff editor
- row-by-row proposal editing
- dense compare UI

If there is no pending proposal, keep the current compact empty-state approach:

- show a short status message
- indicate that fullscreen review will be available when a proposal exists
- do not fill the tab with placeholder controls

### Sidebar Setup Tab

Should show:

- evolution enabled
- use global defaults
- active runtime summary
- template warning if applicable
- save/refresh actions
- secondary entry to global defaults

Advanced override editing may remain here, but must be visually secondary.

### Sidebar Sections Tab

Should show:

- what evolution tracks
- privacy toggles
- section-level configuration

This tab is the scoped place for section behavior at the character level.

It should not mix in runtime/model controls.

### Sidebar State Tab

Should show:

- current accepted state only
- readable grouped state sections
- editability only where appropriate

If a proposal is pending, this tab should make it clear that the accepted state is still the current truth.

### Sidebar History Tab

Should show:

- version list
- selected version preview
- access to archived/corrected traits

Archived/corrected memory must not be visible by default in the main state tab.
It belongs in history/details flows.

## Pending Proposal UX

When a pending proposal exists, the user should get a strong callout in chat.

Current behavior using an alert/callout pattern is acceptable and should be reused.

Required behavior:

- a visible callout appears in chat
- sidebar Review tab reflects pending status
- primary action is `Open Fullscreen Review`

The system should not force-open review automatically.
It should strongly notify and make the next action obvious.

## Fullscreen Review UX

Fullscreen review is the main decision-making workspace.

It should be optimized for:

- mostly accept/reject
- exact compare when needed
- light editing as a secondary action

It is not intended to be a full authoring environment.

### Review Structure

Recommended structure:

1. Header
2. Proposal summary
3. Changed sections list
4. Optional evidence/details disclosure
5. Bottom action rail

### Header

Should include:

- title
- short explanatory line only once
- back/close action

Avoid repeating instructional text lower in the page unless a section truly needs it.

### Proposal Summary

Should include:

- source chat
- source range or processed scope label
- number of changed sections
- accepted state version it builds on

Do not expose raw implementation details unless useful.
Use human-readable summaries first.

### Section Compare

Each changed section should be scannable.

Default presentation:

- section title
- one-sentence summary of what changed
- compact count badge if useful
- collapsed unchanged content by default

Each row may show:

- current value
- proposed value
- status/change type
- confidence/status fields only if editable or important

The review should prefer reading clarity over maximum density.

### Editing Model

Editing is allowed, but secondary.

The intended flow is:

- inspect
- maybe tweak one or two lines
- accept or reject

Not:

- deeply rewrite the proposal from scratch

### Review Actions

Primary action:

- `Accept`

Secondary actions:

- `Accept and create new chat`
- `Reject`
- close/back

`Accept and create new chat` remains available, but is not the default action.

## Setup UX

Character-level setup and global defaults should feel like mirror surfaces.

Shared structure:

1. enable/source
2. runtime
3. privacy
4. tracked sections
5. maintenance/actions

### Character Setup

This is where the user understands:

- whether evolution is enabled
- whether it is inheriting global defaults
- what runtime is currently active
- whether this character has local overrides

Character-specific override editors should exist here, but behind clear secondary emphasis.

Current implementation baseline:

- keep character-level override editing in Setup
- preserve the current inline/disclosure-style placement as the default pattern
- make it calmer and visually secondary, not more prominent

### Global Defaults

Global defaults must contain advanced policy.

This is the canonical home for:

- extraction provider/model/max tokens
- extraction prompt
- prompt scaffolding controls if/when exposed
- range handoff policy
- auto-handoff policy
- conflict policy
- decay policy
- matching policy
- privacy defaults
- default section configuration

The sidebar should not become the place where these are managed.

## History UX

History exists for trust, inspection, and debugging.

The normal user flow is not:

- open history every chat

The normal user flow is:

- review pending proposals when prompted

History should therefore be useful but quiet.

### Version History

Should show:

- version number
- accepted time
- source chat / processed scope summary
- quick `View`

Selected version should open a readable preview, not a raw dump-first experience.

### Archived and Corrected Memory

Archived/corrected memory should not be shown by default in normal state views.

Preferred UX:

- hidden behind a separate area in History
- optionally opened in a nested modal/subview

This makes history available without polluting the active-state workflow.

Storage expectation behind the UX:

- archived/corrected memory still exists in the accepted canonical state
- it is hidden from the default State tab for focus, not removed from storage
- later accepts must not silently delete archived/corrected items just because normal review focuses on active memory

## Automatic Handoff UX

When auto-handoff is added, it should be largely invisible in the main flow.

Normal user experience:

- the system creates a pending proposal when appropriate
- the user gets a strong callout
- the user opens fullscreen review

Auto-handoff controls should live in global defaults, not in the main sidebar flow.

Character-level sidebar may show:

- auto-handoff enabled/disabled status

But detailed trigger policy belongs in global settings.

## Range UX

Range mechanics should be mostly implicit.

Users should see:

- processed scope summary
- what part of the conversation the proposal came from

Users should not be forced to manage raw start/end indices during normal use.

When explicit range controls exist, they should stay advanced and constrained.

The default product language should be:

- “latest unreviewed part of this chat”
- “new conversation segment”
- “current pending proposal”

Not:

- `startMessageIndex`
- `endMessageIndex`
- `cursor`

Those belong in technical details, if anywhere.

## Confidence and Status UX

The internal fields already exist:

- confidence: `suspected`, `likely`, `confirmed`
- status: `active`, `corrected`, `archived`

These should not dominate the normal user flow.

### Main Flow Rule

In normal review:

- show them only where they help a decision
- do not make them the center of the interface

### History Rule

In history/archive views:

- these fields can be shown more explicitly

### Copy Guidance

Use plain language around them where possible.

Example:

- `Confirmed`
- `Likely`
- `Suspected`
- `Archived`
- `Corrected`

Avoid long technical explanations in the main UI.

## Screen-by-Screen Responsibilities

### Sidebar

Owns:

- operational status
- entry points
- character-scoped management tabs

Does not own:

- full proposal editing
- deep policy authoring

### Fullscreen Review

Owns:

- full proposal inspection
- accept/reject
- light adjustment before accept

Does not own:

- global defaults
- long-term history browsing

### Global Defaults

Owns:

- advanced policy
- shared runtime behavior
- defaults for all characters using global settings

Does not own:

- character-specific accepted state
- current pending proposal review

### History

Owns:

- accepted versions
- archived/corrected inspection
- prior snapshot browsing

Does not own:

- main daily interaction flow

## Visual and Interaction Principles

The evolution UI should be:

- calm
- structured
- readable
- power-user capable without feeling like an internal dashboard

Implementation guidance:

- reuse existing design system primitives and tokens
- avoid one-off tab systems or custom review chrome when shared primitives exist
- prefer clear hierarchy and compact summaries over long instructional text
- collapse detail by default when it is not needed to make the next decision

## Implementation Order

Recommended order after current Phase 1/backend work:

1. normalize current sidebar
2. normalize fullscreen review
3. normalize setup + global defaults
4. normalize state + history
5. implement future V2 additions using this UX structure

## Phase Mapping

### Phase 1

- backend/data-model foundation
- minimal current UI support

### UI Normalization Work

- cleanup of already implemented UI
- bring current screens into the correct shape
- treat normalized current UI as the foundation for future feature work

### Before Phase 2

This UX spec must exist and be treated as the screen-structure source of truth.

The normalized current UI should be used as the base structure for Phase 2 and later work.
Future features should extend it rather than introducing a second competing evolution UI.

### Phase 2+

Use this spec to integrate:

- richer ranged handoff UX
- archive/corrected browsing details
- auto-handoff visibility
- future lifecycle controls

without falling back into ad hoc sidebar overload.

### Phase 2.5

Use the normalized current UI to add archival retention semantics without redesigning the feature.

Required UX behavior:

- main State tab continues to show active memory by default
- History/details remains the place to inspect archived/corrected memory
- review may summarize archived/corrected rows as removed from active memory
- accept must still preserve archived/corrected items in canonical stored state

This is a backend/state-model correction with only minimal UI implications.
It should not introduce a new archive-management surface or a parallel review flow.

Example review behavior:

- current accepted state contains an archived `Dead Man` item in `characterLikes`
- the active-only proposal does not mention `Dead Man`
- review should not frame that as deleting the archived record
- normal review may hide that row entirely or treat it as unchanged historical context
- History/details remains the place to inspect that archived item directly

## Signed-Off Product Decisions

- pending proposals should use a strong callout in chat
- fullscreen review is the only full review/edit surface
- review is mostly accept/reject, with editing secondary
- history/version browsing lives inside the sidebar
- archived/corrected memory is not shown by default
- archived/corrected memory may use a separate nested modal/subview
- archived/corrected memory remains stored in canonical accepted state even when hidden from the default State tab
- auto-handoff controls live in global defaults settings
- sidebar keeps tabs
- default accept action is `Accept`
- `Accept and create new chat` is secondary
