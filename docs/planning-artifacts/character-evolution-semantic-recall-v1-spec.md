# Character Evolution Semantic Recall V1 Spec

## Purpose

Add semantic recall for archived Character Evolution facts so old but relevant facts can reappear in prompt context by meaning, not by exact keyword match.

This V1 is intentionally narrow:

- keep current Character Evolution merge and retention semantics
- keep archived facts archived
- support a first-version section selector for which categories use semantic recall
- honor the product rule that creating a new chat resets continuity

Semantic recall in this document means:

- archived facts are stored in a searchable semantic index
- the current scene is embedded at send time
- semantically similar archived facts are retrieved and inserted into the prompt as temporary context
- retrieved facts do not become active again automatically

## Status

This document is the source of truth for the first implementation pass of Character Evolution semantic recall.

It is intentionally scoped:

- after retention and prompt projection already exist
- after version snapshots already exist
- before any broader redesign of Character Evolution storage

## Relationship To Existing Docs

This document extends:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-v2-phase-4-5.md`
- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-retention-remediation-plan.md`

If this document conflicts with earlier assumptions that `currentState` alone is enough for long-term archived memory, this document wins for semantic recall behavior.

## Goals

V1 must:

- retrieve archived facts by embedding similarity, not keyword match
- allow the user to choose which Character Evolution categories participate
- keep archive as archive
- keep one-chat continuity reset semantics
- avoid requiring a new canonical storage model
- avoid rerunning handoffs just to make retrieval work
- keep prompt size bounded and explainable

## Non-Goals

V1 does not:

- redesign Character Evolution canonical storage
- change merge behavior for accepted handoffs
- automatically reactivate archived facts when recalled
- add per-character semantic recall settings
- add per-section custom prompt text
- add semantic recall to every prompt source in the app
- replace lorebook matching

## Confirmed Product Decisions

### 1. Semantic recall is prompt-time retrieval, not canonical state

Semantic recall creates temporary prompt context.

It does not:

- change `currentState`
- change item status
- promote archived items back to active

If a recalled fact appears again in future chat and the normal Character Evolution pipeline extracts it again, that is the correct path for it to become active in a later accepted state.

### 2. `currentState` is not a durable archive by itself

`currentState` is canonical live state, but it is not guaranteed to preserve old archived facts forever.

Reason:

- non-active items can be deleted by retention thresholds
- section caps can trim canonical stored state

That means semantic recall should not depend only on the latest `characterEvolution.currentState`.

### 3. Existing accepted version snapshots are the durable history source

The durable history source for V1 is:

- `states/v*.json` accepted version files
- plus the current accepted state when needed

This is enough to build a semantic archive without redesigning canonical storage.

### 4. New chat resets continuity

Semantic recall must respect the product rule that creating a new chat resets continuity.

Implication:

- only facts associated with the current `chatId` are eligible for recall
- archived facts from older chats must not be recalled into a new chat by default

### 5. V1 has a section selector

The first version must include a selector for which Character Evolution categories use semantic recall.

This selector is:

- global only
- advanced settings only
- section-level enable/disable only

This selector is not:

- per-character
- per-item
- custom prompt text per section

### 6. Archived facts only

V1 semantic recall targets archived facts only.

It does not recall:

- active facts
- corrected facts

This keeps the mental model simple:

- active facts are already part of normal Character Evolution prompt projection
- archived facts are the dormant memory pool
- corrected facts remain historical cleanup data and should not be revived into prompt context in V1

## Working Definitions

### Live Canon

The accepted `characterEvolution.currentState` used by existing Character Evolution behavior.

### Durable History

Accepted version snapshots under `states/v*.json`.

### Semantic Archive Index

A derived per-character, per-chat index file containing embeddings and retrieval metadata for archived facts.

This index is not canonical storage.

### Recall Candidate

An archived fact from an enabled section whose `sourceChatId` matches the current chat and whose embedding is available in the semantic archive index.

### Semantic Recall Block

A new prompt block inserted at generation time containing semantically relevant archived facts grouped by section.

## User Experience

### Settings Surface

Add a new global Character Evolution settings surface for semantic recall.

Location:

- `Evolution Defaults`
- alongside existing projection and retention controls

Suggested title:

- `Semantic Recall`

### V1 Controls

V1 settings should include:

- `Enable semantic recall`
- `Embedding model`
- `Minimum similarity score`
- `Max recalled items per prompt`
- `Query message window`
- section selector checkboxes

Section selector behavior:

- only Character Evolution item sections are shown
- default enabled section on new feature enablement: `userFacts`
- all other sections default off in V1

Suggested initial eligible sections:

- `userFacts`
- `characterHabits`
- `keyMoments`
- `userLikes`
- `userDislikes`
- `characterLikes`
- `characterDislikes`

Suggested initial recommendation:

- V1 should ship with only `userFacts` preselected

### No Per-Section Prompt Customization In V1

V1 should not allow custom prompt text for each section.

Reason:

- retrieval quality must be proven first
- section toggles are enough for the first version
- custom prompt text would multiply tuning complexity before the retrieval loop is stable

## Prompt Model

V1 should introduce one new prompt template block type:

- `semanticRecall`

This is a single aggregated block, not one template slot per category.

Inside the block, recalled facts are grouped by section.

Suggested render shape:

```xml
<SemanticRecall>
<SemanticUserFacts>
- User used to live in Berlin [confirmed]
- User gets claustrophobic in elevators [likely]
</SemanticUserFacts>

<SemanticCharacterHabits>
- She checks exits when entering crowded rooms [likely]
</SemanticCharacterHabits>
</SemanticRecall>
```

Why one block instead of one template slot per category:

- simpler prompt-template UX
- easier prompt ordering
- easier to trace
- still preserves category boundaries inside the content

## Data Model

### 1. Add stable item IDs

Add a stable `id` field to `CharacterEvolutionItem`.

Why:

- semantic archive index needs stable references
- future trace/debugging should point back to a stable item identity
- fallback matching on value text alone is too brittle

Suggested schema addition in:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/storage/database.types.ts`

Suggested field:

```ts
id?: string
```

Implementation goal:

- normalize legacy items to have IDs
- assign IDs to new items when created or first normalized

### 2. Do not store embeddings in canonical Character Evolution items

Embeddings are derived data, not canonical memory.

Do not add embeddings to `CharacterEvolutionItem`.

Instead, store embeddings in a sidecar semantic archive index.

### 3. Semantic archive index file

Suggested file path:

- `characters/<charId>/semantic-recall/<chatId>.v1.json`

Suggested shape:

```json
{
  "version": 1,
  "characterId": "char-id",
  "chatId": "chat-id",
  "embeddingModel": "MiniLM",
  "generatedAt": 0,
  "items": [
    {
      "itemId": "item-id",
      "sectionKey": "userFacts",
      "status": "archived",
      "value": "User gets claustrophobic in elevators",
      "confidence": "likely",
      "sourceChatId": "chat-id",
      "sourceRange": {
        "startMessageIndex": 10,
        "endMessageIndex": 18
      },
      "snapshotVersion": 12,
      "acceptedAt": 0,
      "embedding": [0.01, -0.2, 0.08]
    }
  ]
}
```

Rules:

- one index file per character and chat
- only archived facts are indexed
- only enabled sections are indexed
- only facts whose source chat matches the index `chatId` are included

## Source Of Truth For Index Build

V1 semantic archive index is derived from accepted version history, not from raw chat replay and not from the latest `currentState` alone.

Primary source:

- `states/v*.json`

Secondary source:

- current accepted state when needed

The index build should:

1. scan accepted versions for the character
2. read each version payload
3. keep only items whose `sourceChatId` or `sourceRange.chatId` matches the target chat
4. keep only items in enabled sections
5. keep only `status: archived`
6. dedupe by stable item ID, keeping the latest snapshot copy
7. generate embeddings for remaining candidates

## Retrieval Algorithm

### Query Input

Build a semantic query from the latest messages of the current chat.

Suggested V1 default:

- last 4 converted OpenAI-style messages
- cap raw source window to the last 8 messages before conversion, matching existing memory similarity behavior

This follows the current summary similarity pattern:

- recent scene context, not full transcript replay

### Embedding Model

Use the same embedding model for:

- indexing archive items
- building live query embeddings

V1 setting should reuse the existing embedding model vocabulary already used in memory and RAG.

Suggested practical defaults:

- `MiniLM` for English-heavy use
- `multiMiniLM` or `bgem3` for multilingual use

### Similarity Score

Use cosine similarity.

Suggested V1 ranking:

1. primary sort by similarity descending
2. tie-break by confidence
3. then tie-break by latest snapshot version or accepted timestamp

Suggested confidence bonus:

- `confirmed`: small positive boost
- `likely`: smaller boost
- `suspected`: no bonus

Suggested V1 thresholds:

- default `minScore = 0.42`
- configurable in UI

Suggested V1 item count:

- default `maxItems = 3`
- configurable in UI

### Deduplication

Before final render:

- dedupe by `itemId`
- dedupe repeated value text within the same section

### Section Balancing

V1 should avoid one section taking all slots.

Simple rule:

- soft cap of `2` recalled items per section before filling remaining slots globally

## Prompt Injection

### Build Step

At generation time:

1. determine current `characterId` and `chatId`
2. load semantic recall settings
3. if disabled, skip
4. load the chat-scoped semantic archive index
5. build query from recent messages
6. rank candidates by similarity
7. take top recalled items
8. group by section
9. render `semanticRecall` prompt block

### Prompt Titles And Trace

The prompt block should be visible in trace as:

- `Semantic Recall`

Each grouped section inside the block should also be attributable in trace metadata when possible.

Trace metadata for each recalled item should include:

- section key
- item ID
- similarity score
- snapshot version
- source chat ID

## Interactions With Existing Systems

### Retention

Retention still controls `currentState`.

Semantic recall does not change retention behavior.

The semantic archive index exists specifically because archived items may eventually disappear from `currentState`.

### Infinite / Permanent Buckets

Sections or items that remain active forever through the user’s `infinite` / permanent bucket concept do not need semantic recall to stay visible.

They are still part of active current memory.

Semantic recall is for archived dormant memory, not for active permanent memory.

### Lorebook

Do not move archived Character Evolution items into lorebook as canonical storage.

Lorebook remains a separate system.

Semantic recall should be Character Evolution-native in V1.

### Character Evolution Extraction

Extraction and acceptance logic stay unchanged.

Semantic recall only affects prompt assembly for generation, not the extraction handoff itself in V1.

## Migration And Backfill

### Default Migration Path

Do not require rerunning handoffs.

Preferred migration:

1. add stable IDs to existing Character Evolution items
2. scan accepted version files
3. build chat-scoped semantic archive indices
4. generate embeddings for archived facts found in enabled sections

This is deterministic and does not alter accepted state.

### Optional Rerun Path

If the user wants to rerun handoffs after changing extraction behavior, that is allowed, but it is not required for semantic recall.

Use rerun only if the goal is:

- regenerate extracted facts
- re-clean the archive
- normalize older low-quality extraction output

Do not use rerun just to add embeddings.

## Failure And Rebuild Behavior

### Missing Index

If the index file for the current chat does not exist:

- semantic recall skips safely
- trace should show `skipped: no_index`

### Embedding Model Change

If the configured embedding model changes:

- existing semantic archive index for that chat is stale
- mark it stale by model mismatch
- skip retrieval until rebuilt, or rebuild lazily

### Rebuild Entry Point

V1 should include an explicit rebuild action.

Suggested entry points:

- settings button in Semantic Recall panel
- server route or internal command for rebuilding a character chat index

Suggested rebuild scope:

- selected character
- selected chat only

## Implementation Touchpoints

### Schema And Item Identity

- `/Users/andrewbostan/Documents/RisuAII/src/ts/storage/database.types.ts`
- `/Users/andrewbostan/Documents/RisuAII/src/ts/character-evolution/items.ts`
- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/character_evolution/items.cjs`

Changes:

- add stable item IDs
- preserve IDs across merges and updates

### New Semantic Recall Settings

- `/Users/andrewbostan/Documents/RisuAII/src/ts/storage/database.types.ts`
- `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/EvolutionDefaultsSettings.svelte`

Changes:

- add global semantic recall settings
- add section selector UI

### New Semantic Archive Service

Suggested new files:

- `/Users/andrewbostan/Documents/RisuAII/server/node/services/character_evolution_semantic_recall_repository.cjs`
- `/Users/andrewbostan/Documents/RisuAII/server/node/services/character_evolution_semantic_recall_indexer.cjs`

Responsibilities:

- scan version files
- build per-chat semantic archive index
- load and save index files
- handle model mismatch and rebuild state

### Prompt Assembly

- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/prompt.cjs`
- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/promptTemplateShared.ts`
- `/Users/andrewbostan/Documents/RisuAII/src/lib/UI/PromptDataItem.svelte`

Changes:

- add `semanticRecall` prompt template block type
- render it with grouped per-section semantic recall content

### Embedding Reuse

- `/Users/andrewbostan/Documents/RisuAII/server/node/memory/similarity.cjs`
- `/Users/andrewbostan/Documents/RisuAII/server/node/rag/embedding.cjs`

Changes:

- reuse existing embedding generation utilities
- keep one model vocabulary across memory, RAG, and semantic recall

### Trace Integration

- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/prompt.cjs`
- `/Users/andrewbostan/Documents/RisuAII/src/lib/Others/RequestLogsViewer.svelte`

Changes:

- include semantic recall prompt block in prompt trace
- include recalled-item metadata in trace payloads

## V1 Rollout Order

### Step 1

Add stable item IDs to Character Evolution items and preserve them through merges and normalization.

### Step 2

Add global semantic recall settings and section selector UI.

### Step 3

Implement per-character, per-chat semantic archive index build from accepted versions.

### Step 4

Backfill semantic archive index for existing chats without rerunning handoffs.

### Step 5

Add `semanticRecall` prompt block type and server-side prompt assembly support.

### Step 6

Add trace metadata for recalled items.

### Step 7

Tune thresholds with real chats, starting from `userFacts` only.

## Success Criteria

V1 is successful when:

- the user can enable semantic recall and select sections in settings
- archived `userFacts` from early chat can reappear near much later relevant scenes
- semantic recall is scoped to the current chat only
- recalled facts are visible in prompt trace
- recalled facts do not mutate canonical state
- the feature works without rerunning past handoffs

## Open Questions

### 1. Should corrected facts be eligible later?

V1 answer:

- no

### 2. Should semantic recall affect extraction prompts too?

V1 answer:

- no

### 3. Should the semantic archive survive manual version deletion?

V1 answer:

- derived index should follow surviving accepted history
- rebuild may remove facts whose version history was deleted

### 4. Should section selector live beside section configs?

V1 answer:

- no
- keep it in advanced global settings

### 5. Is rerunning handoffs allowed?

V1 answer:

- yes, but optional
- not required for the feature to work

