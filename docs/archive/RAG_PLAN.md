# TTRPG Session RAG Plan (2026-02-08)

## Goal
Support long-running TTRPG sessions with AI bots using a layered memory/RAG architecture:
- Static rule and setting retrieval ("Read layer")
- Clean session memory retrieval ("Write layer")
- Rolling narrative state ("Condenser")

## Capability Targets
- Scenario book guidance: GM can retrieve and apply chapter/scene guidance from uploaded materials.
- Beginner guidance: GM explains rules in plain language and suggests legal next actions.
- Rule accountability: rule-claiming responses include citations to retrieved sources.

## Current Codebase Baseline

### What already exists
- Embedding pipeline and model options already exist (`/Users/andrewbostan/Documents/RisuAII/src/ts/process/memory/hypamemory.ts`, `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OtherBotSettings.svelte`).
- Long-term memory systems already exist (Supa, Hanurai, HypaV2, HypaV3) and are injected during chat processing (`/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts`).
- HypaV3 already does periodic summarization + recent/similar/random selection and strips summary-style headings before prompt injection (`/Users/andrewbostan/Documents/RisuAII/src/ts/process/memory/hypav3.ts`).

### Current gaps for TTRPG RAG
- Lorebook retrieval path is currently keyword/regex matching, not semantic vector retrieval (`/Users/andrewbostan/Documents/RisuAII/src/ts/process/lorebook.svelte.ts`).
- `lorePlus` exists in UI/import-export fields, but no `lorePlus` check is wired into the lore retrieval execution path (`/Users/andrewbostan/Documents/RisuAII/src/lib/SideBars/LoreBook/LoreBookData.svelte`, `/Users/andrewbostan/Documents/RisuAII/src/ts/process/lorebook.svelte.ts`).
- Existing vector memory paths still rely heavily on raw chat text and summary chunks; there is no dedicated "fact memory" schema yet (`/Users/andrewbostan/Documents/RisuAII/src/ts/process/memory/hanuraiMemory.ts`, `/Users/andrewbostan/Documents/RisuAII/src/ts/process/memory/hypav2.ts`, `/Users/andrewbostan/Documents/RisuAII/src/ts/process/memory/hypav3.ts`).

## Target Architecture (for this repo)

### Layer A: Rulebook Data Bank (Read layer)
- Input: rulebooks/settings/lore docs (PDF/TXT/MD).
- Pipeline:
  1) text extraction
  2) cleanup (headers/footers/page numbers)
  3) chunking (start with 600-900 chars, overlap 80-120)
  4) embedding with current embedding model settings
  5) persistence to a dedicated RAG index per campaign/module
- Retrieval:
  - query embed -> top-k semantic chunks
  - optional lexical fallback for exact rule terms
  - prompt inject as a "Rules Context" block

### Layer B: Session Fact Memory (Write layer)
- Do not vectorize raw logs directly.
- Add a fact extraction step on each turn (or every N turns), producing compact structured facts, e.g.:
  - `event`, `actor`, `targets`, `state_change`, `location`, `session_id`, `chat_memo_refs`, `confidence`
- Embed and store facts, then retrieve by semantic similarity + optional entity filters.
- Inject as a "Session Facts" block distinct from rulebook snippets.

### Layer C: Story Condenser (Active state)
- Keep HypaV3 summarization as the rolling plot state.
- Continue summary cleanup before prompt injection (already implemented in HypaV3).
- Treat summaries as short-horizon narrative state, not source-of-truth facts.

## Retrieval and Prompt Budget Policy
- Reserve separate token budgets per layer:
  - rules context budget
  - facts context budget
  - summary context budget
- Merge order:
  1) rules (authoritative mechanics)
  2) session facts (world state)
  3) rolling summary (narrative continuity)
- Keep each layer tagged in prompt XML-like blocks for debuggability.

## Citation Requirements
- Every rules/ruling answer should include one or more citations when supporting evidence exists.
- Citation metadata must be stored per chunk:
  - `system`, `book_title`, `edition`, `section`, `page`, `chunk_id`, `source_file`
- If retrieval confidence is low or no supporting chunk is found, the assistant should state uncertainty instead of presenting a rule as definitive.
- Add prompt/debug preview support to show exactly which chunks were selected.

## GM and Character Model
- Required:
  - one GM bot character for world control, pacing, and adjudication
  - one GM profile per game system (do not reuse the same GM profile across different rulesets)
- Optional:
  - AI-controlled RP characters (NPCs, companions, party members)
- Human players do not require bot-character definitions unless they want AI to co-pilot those roles.

## Beginner-Assist Mode
- Add a mode that:
  - explains rules as "what this means in play"
  - proposes legal action options each turn
  - flags probable rules mismatches with short correction hints
- Keep this mode toggleable per chat/campaign to avoid over-guiding experienced users.

## Tabletop UX Scope
- Dice tray UI:
  - expression input (e.g. `1d20+5`, `2d6`)
  - roll history/log
  - optional deterministic mode for replay/testing
- Character sheet UI:
  - core stats/resources
  - quick-edit values during play
  - references from sheet fields into prompt context
- Citation panel:
  - clickable list of sources used in the last ruling/answer

## Phased Implementation

### Phase 1: Rulebook Data Bank MVP
1. Add campaign-scoped ingestion job and index format.
2. Build retrieval API/functions for top-k rule chunks.
3. Inject retrieved rule chunks into prompt assembly.
4. Add debug output in prompt preview showing selected chunks.

Exit criteria:
- Rules questions reliably cite relevant chunks.
- Prompt preview shows deterministic retrieval sources.

### Phase 2: Fact Memory MVP
1. Define fact schema and extractor prompt/template.
2. Add write path to store extracted facts with embeddings.
3. Add retrieval path using latest user message + recent turn context.
4. Inject facts as dedicated prompt block.

Exit criteria:
- NPC/object state changes persist across long chats.
- Fact retrieval quality exceeds raw-log retrieval in manual test scenarios.

### Phase 2.5: Book Ingestion Hardening
1. Add parser pipeline for PDF/TXT/MD with normalization.
2. Add scanned-PDF OCR fallback when extracted text quality is below threshold.
3. Store source metadata needed for citations.

Exit criteria:
- Scenario books with scanned pages remain searchable.
- Retrieved chunks always carry source metadata for citation output.

### Phase 3: Ranking and Quality Controls
1. Add weighted ranking (semantic score + recency + confidence).
2. Add deduplication and conflict handling for contradictory facts.
3. Add controls for top-k and token caps per layer.

Exit criteria:
- Stable output quality on 20+ turn sessions.
- No frequent contradictions on known NPC/world states.

### Phase 4: Server-First Alignment
1. Move ingestion/retrieval/fact extraction execution to server path.
2. Keep UI controls client-side, retrieval state server-authoritative.
3. Add server-side logs and replayability for retrieval decisions.

Exit criteria:
- Multi-client sessions return consistent RAG results.
- Retrieval behavior independent of client device performance.

### Phase 5: Playability Layer
1. Add dice tray/log UI and hook it into GM context.
2. Add character sheet panel with campaign/session persistence.
3. Add beginner-assist flow for first-time players.

Exit criteria:
- New users can run a full beginner session with guidance and rule citations.
- Returning users can run faster sessions with assistive mode disabled.

## Better-Option Notes vs Raw Chat Vectorization
- Preferred for TTRPG: `facts + summaries + rulebook chunks` over raw chat-only vectors.
- Reason: fact records reduce noise and ambiguity from OOC chatter and stylistic text.
- Keep raw chat vectors as optional fallback, not primary retrieval source.

## System-Specific Adapters (Recommended)
- Add lightweight rules adapters per target game:
  - D&D
  - Vampire: The Masquerade
  - The One Ring
- Each adapter should define:
  - turn structure hints
  - dice conventions
  - minimum sheet fields
  - retrieval tags/keywords for better chunk ranking

## Additional Recommendations
- Rules evaluation harness:
  - maintain golden test scenarios per system and verify expected rulings/citations.
- House-rules precedence:
  - add campaign-level overrides that explicitly supersede book defaults.
- Confidence/risk control:
  - enforce "no citation, no definitive ruling" behavior when retrieval confidence is weak.
- Session auditability:
  - persist a timeline of dice rolls, applied rules, and citation sources.
- Campaign bootstrap UX:
  - wizard flow for uploading books, selecting system adapter, creating GM profile, and enabling beginner mode.
- Source rights hygiene:
  - store source metadata and user-provided ownership flags for uploaded materials.
