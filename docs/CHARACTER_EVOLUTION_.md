# Character Evolution v1 Plan

## Summary
Implement a manual handoff-based character evolution system that keeps current card authoring intact:
- Block 1 uses existing `desc` + `personality`
- Block 3 uses existing `replaceGlobalNote`
- Block 2 becomes new structured, versioned JSON state

The feature is opt-in per character, uses a separate extraction prompt/model flow, stores accepted state versions as JSON files, and injects current state into RP prompts through a new prompt-template block type instead of hardcoded prompt surgery.

## Implementation Changes

### Data model and storage
- Add global evolution defaults to app settings:
  - default extraction provider/model
  - default extraction prompt
  - default built-in section config
  - default privacy toggles
- Add per-character `characterEvolution` config and runtime state:
  - `enabled`
  - `useGlobalDefaults`
  - optional per-character extraction provider/model/prompt overrides
  - per-character section config override
  - privacy overrides
  - `currentStateVersion`
  - `currentState`
  - `pendingProposal`
  - `lastProcessedChatId`
  - version metadata list
- Store accepted versions under `characters/{chaId}/states/v{n}.json`
- Keep `character.json` as the source of truth for:
  - config
  - current state pointer
  - current state snapshot
  - pending proposal metadata
- Do not store Block 2 in Markdown in v1

### Built-in state schema
- Ship a fixed built-in section set for v1:
  - `relationship`
  - `activeThreads`
  - `runningJokes`
  - `characterLikes`
  - `characterDislikes`
  - `characterHabits`
  - `characterBoundariesPreferences`
  - `userFacts`
  - `userRead`
  - `userLikes`
  - `userDislikes`
  - `lastChatEnded`
  - `keyMoments`
  - `characterIntimatePreferences` disabled by default
  - `userIntimatePreferences` disabled by default
- Each built-in section is editable in UI, but not as arbitrary schema:
  - enabled/disabled
  - display label
  - include in RP prompt
  - extraction instruction
  - sensitive flag where applicable
- No custom section keys in v1

### Extraction flow and APIs
- Add a manual `Handoff` action in single-character chats only
- Handoff flow:
  - user clicks `Handoff` in the current chat
  - server runs one extraction call against the finished chat
  - server creates or replaces a single `pendingProposal`
  - UI shows review/edit screen
  - `Accept` saves a new version and updates `currentState`
  - `Accept and create new chat` saves, creates a new chat, and switches to it
  - `Reject` clears the pending proposal without saving a version
- Enforce idempotency:
  - do not allow the same chat to be processed twice into multiple accepted versions
  - only one pending proposal per character at a time
- Use one extraction call for the full state update, not one call per category
- Extraction prompt lives in evolution settings, not in the RP prompt template
- Extraction output must be structured JSON and include lightweight evidence per change for review

### Prompt system integration
- Extend prompt-template item types with a new typed block: `characterState`
- Support the new block in both client and server prompt assembly paths
- `characterState` renders the current evolved state snapshot according to enabled sections marked `include in RP prompt`
- Do not hardcode fallback injection in v1
- If evolution is enabled but the active prompt template has no `characterState` block, show a warning in the character Evolution UI

### UI and UX
- Add general evolution settings in app settings following the existing global-default pattern
- Add a new `Evolution` tab in character config:
  - enable/disable evolution
  - use global defaults toggle
  - extraction provider/model override
  - extraction prompt override
  - built-in section editor
  - privacy toggles
  - current state viewer/editor
  - version history list
  - pending proposal status/review entry point
- The section editor must be form-based, not a raw JSON editor
- Pending proposal review UI must show:
  - current vs proposed changes grouped by section
  - evidence summary for each change
  - edit before accept
- Version history in v1 is browse-only; rollback is out of scope
- Group chats are out of scope in v1; hide or disable handoff there

## Public Interfaces and Types
- Extend database/settings types with global evolution defaults
- Extend `character` with `characterEvolution`
- Extend prompt template unions with `characterState`
- Add server routes for:
  - create handoff proposal from chat
  - accept proposal and persist new version
  - reject proposal
  - list versions
  - fetch version content
- Version file payload should contain:
  - version metadata
  - full accepted state snapshot
  - source chat id
  - accepted timestamp
- Pending proposal payload should contain:
  - proposal id
  - source chat id
  - proposed state
  - change summaries
  - evidence references
  - created timestamp

## Test Plan
- Type/default migration tests for global and per-character evolution settings
- Prompt-template tests covering `characterState` in both client and server prompt builders
- Handoff tests:
  - successful proposal creation
  - reject clears pending state
  - accept writes `states/vN.json` and updates current state
  - same chat cannot produce duplicate accepted versions
  - one pending proposal per character
- Privacy tests ensuring disabled sensitive sections are omitted from extraction and RP injection
- UI-state tests for:
  - Evolution tab defaults vs overrides
  - section editor behavior
  - warning when template lacks `characterState`
- End-to-end scenario:
  - finish chat
  - run handoff
  - review/edit proposal
  - accept and create new chat
  - verify next prompt uses updated state

## Assumptions and Defaults
- `desc` + `personality` remain manually authored and immutable for evolution purposes
- `replaceGlobalNote` remains the authored RP-guidance field
- Growth Roadmap is removed from v1 entirely
- Sensitive/intimate sections are disabled by default
- No arbitrary custom state sections in v1
- No automatic extraction on new chat creation
- No rollback-to-version action in v1
- Single-character chats only in v1
