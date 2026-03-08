# Core Product Spec

Last updated: 2026-02-17
Status: Draft (implementation baseline)

## 1) Purpose
Define the minimum coherent product for Risu so UI and feature work follow one shared model.

Primary objective:
- Fast, reliable chat workflow with continuity (memory) and knowledge support (RAG), all discoverable from a single shell.

## 2) Product Pillars
1. Chat-first execution speed
2. Continuity over long sessions
3. Explainable generation pipeline
4. Predictable navigation and workspace behavior
5. Safe iteration (no hidden critical flows)

## 3) Core Concepts (Domain Model)
1. Character
- Persistent persona/config object.
- Owns chat sessions and memory behavior.

2. Chat Session
- Time-ordered conversation under one character.
- Primary unit users open and continue.

3. Memory Entry
- Structured continuity artifact derived from chat history.
- Reviewable, mergeable, and traceable to source messages.

4. Knowledge Document (Library)
- External files (rulebooks/docs) for retrieval.
- Ingested and queryable with visible status.

5. Generation Trace
- Inspectable record of prompt assembly + retrieval context + request summary.

6. Workspace Shell
- Unified app navigation and route state across all core surfaces.

## 4) Required Workspaces

### A. Characters
User goal:
- Create/select/manage characters quickly.

Must-have:
1. List/search characters
2. Create/edit/delete character
3. Set active character
4. Show linked chat count and last activity

Acceptance criteria:
1. Character selection is one click from global nav.
2. Active character is visible in shell context.
3. Deleting character requires confirm and cannot orphan active route.

### B. Chats
User goal:
- Find and open conversations immediately.

Must-have:
1. Chats page reachable in one click from anywhere.
2. Chat list by active character + optional all-chats view.
3. Create/rename/delete chat session.
4. Open selected chat in one click.

Acceptance criteria:
1. `Chats` is never hidden behind modal-only flow.
2. If no active character, user sees explicit CTA (`Select character` / `Create character`).
3. Switching to `Chats` never results in blank/ambiguous state.

### C. Chat Runtime
User goal:
- Continue conversation with minimal friction.

Must-have:
1. Timeline + composer + send
2. Streaming generation + cancel
3. Regenerate / continue response
4. Persist user message before generation

Acceptance criteria:
1. Message typed and sent remains after refresh/restart.
2. In-flight generation exposes clear loading/cancel state.
3. Failure states return actionable error, not silent drop.

### D. Memory
User goal:
- Maintain continuity and control summary quality.

Must-have:
1. Manual summarize by message range
2. Manual re-summarize of selected memories
3. View linked source messages
4. Periodic summarize visibility (trace/log)

Acceptance criteria:
1. User can tell what was summarized and from which messages.
2. Re-summarize result clearly replaces/merges prior memory entries.
3. No hidden background mutation without visible log/trace.

### E. Library (RAG)
User goal:
- Manage documents and retrieval quality in one place.

Must-have:
1. Upload/ingest documents
2. Show ingest progress/state/errors
3. Search/retrieval preview
4. RAG defaults visibility (topK/minScore/budget/model)

Acceptance criteria:
1. Failed ingest shows reason and retry path.
2. Retrieved snippets can be inspected from trace context.
3. Library is a top-level workspace, not buried in side flows.

### F. Settings
User goal:
- Configure models/behavior safely without side effects.

Must-have:
1. Model/provider settings
2. Prompt/format settings
3. Memory and RAG defaults
4. Save/apply semantics clearly visible

Acceptance criteria:
1. Settings changes are explicit and persist reliably.
2. Section navigation is consistent with shell patterns.
3. No separate “mini-app” behavior inside settings.

### G. Trace / Request Logs
User goal:
- Understand what was sent and why output happened.

Must-have:
1. Generate trace visibility
2. Memory summarize trace visibility
3. Redacted durable request summary
4. Copy/export debug view

Acceptance criteria:
1. Logs are discoverable from one stable location.
2. Sensitive payloads are compact/redacted by default.
3. Trace references include retrieval/prompt block provenance.

## 5) Shell and Navigation Contract
1. Global left nav includes: `Characters`, `Chats`, `Library`, `Settings`.
2. Top-level workspace switch clears transient overlays.
3. Each workspace follows one page contract:
- Header
- Collection pane
- Detail pane
- Optional inspector
4. Critical actions are never only inside hidden menus.
5. Back behavior follows route state, not component-local booleans.

## 6) Cross-Cutting Product Requirements
1. Reliability
- Persist user input before network execution.
- No silent state loss on refresh.

2. Explainability
- Trace/log available for generation and memory operations.

3. Safety
- Compact durable logging by default.
- Explicit debug mode for expanded payloads.

4. Consistency
- Same interaction verbs across entities: `Create`, `Open`, `Edit`, `Delete`, `Import`, `Export`.

## 7) Out of Scope (Until Core Is Stable)
1. Visual style exploration as primary effort
2. New social/share/community surfaces
3. Non-essential extension-surface expansion
4. New backend/provider migrations unrelated to core workflows

## 8) Delivery Priority
P0:
1. Shell contract + chat discoverability
2. Characters + Chats coherence
3. Chat runtime reliability (message persistence)

P1:
1. Memory workspace coherence
2. Library workspace coherence
3. Trace/log consolidation

P2:
1. Settings convergence
2. Settings convergence under shared shell

## 9) Definition of “Core Complete”
Core complete is achieved when:
1. Users can always find/open chats in one click.
2. Character/chat/memory/library/settings all use the same workspace contract.
3. Chat messages and memory operations are traceable and reliable.
4. No critical path depends on legacy hidden sidebars or modal-only navigation.
