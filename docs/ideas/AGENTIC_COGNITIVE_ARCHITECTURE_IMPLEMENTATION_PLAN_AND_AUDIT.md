# Agentic Cognitive Architecture: Implementation Plan and Codebase Audit

## Scope

This document combines:

1. Feedback on the architecture spec.
2. A codebase audit mapped to the spec checklist.
3. A concrete implementation plan for this repository with phased deliverables.

Repository root: `/Users/andrewbostan/Documents/RisuAII`

---

## Feedback on the Spec

The architecture is strong and actionable. Before implementation, add these explicit constraints:

1. Identity scoping on every memory/state/log record: `character_id`, `chat_id`, `user_id`, `tenant_id`.
2. Cross-store consistency semantics (vector + state + logs): transaction or compensation rules.
3. Concurrency/idempotency rules for retries, duplicate requests, and streaming reconnects.
4. Schema versioning and migration policy for atoms/state/log payloads.
5. Strict JSON schema validation contracts for planner/reflector/reflection outputs.
6. Security controls for memory poisoning and prompt-injection-through-memory.
7. Operational budgets and SLOs (latency, token overhead, fallback behavior).
8. Evaluation criteria (contradiction precision, state guard correctness, regressions).
9. Migration bridge from existing HypaV3 summaries to atom-based memory.

---

## Codebase Audit Snapshot

Status legend: `Implemented` / `Partial` / `Missing`

| Spec Item | Status | Evidence | Gap |
|---|---|---|---|
| 1.1 Vector Store | Partial | `server/node/llm/memory.cjs:243`, `server/node/rag/engine.cjs:198` | Embeddings exist, but no atom schema (`confidence`, `subject`, `supersedes`, `is_disputed`, etc.). |
| 1.2 Relational State Store | Missing | `server/node/server_data_helpers.cjs:43`, `src/ts/storage/database.svelte.ts:1250` | File/JSON persistence exists, but no dedicated cognitive state model (mood/trust/relationship/goals). |
| 1.3 Conversation Log Store | Partial | `src/ts/storage/database.svelte.ts:1506`, `server/node/routes/storage_routes.cjs:307` | Raw turns persist, but no `turn_id/session_id/extracted_atoms/state_snapshot/ai_internal_monologue` schema. |
| 2.0 Session Initialization | Partial | `src/ts/process/index.svelte.ts:219` | `lastInteraction` tracked, but no session context load for narrative/tensions/time-gap note. |
| 2.1 Context Builder / Query Planner | Partial | `server/node/llm/engine.cjs:157` | Heuristic query exists for RAG, but no dedicated planner outputting structured retrieval JSON. |
| 2.2a Vector Retrieval | Partial | `server/node/llm/memory.cjs:510` | Recent/similar/important selection exists, but no category/subject filtered atom retrieval with contradiction context. |
| 2.2b State Read | Partial | `server/node/llm/generate_helpers.cjs:255` | Reads character/chat/settings, not cognitive relational state fields from spec. |
| 2.2c Conversation Buffer | Implemented | `server/node/llm/prompt.cjs:227` | Works as short-term context window. |
| 2.3 Reflector | Missing | no matching structured reflector module | No extraction + contradiction + state-delta module. |
| 2.4 Deterministic State Updater | Partial | `server/node/llm/execute_route_handler.cjs:64` | Deterministic parser exists for `gameState`, but not mood inertia/trust asymmetry/relationship guards. |
| 2.5 Prompt Assembler | Partial | `server/node/llm/prompt.cjs:270`, `server/node/llm/memory.cjs:582` | Layering exists, but not full state + contradiction + time + narrative + goal sandwich. |
| 2.6 Character LLM + Internal Monologue | Partial | `server/node/llm/openai.cjs:65`, `server/node/llm/prompt.cjs:258` | `<Thoughts>` handling exists, but no explicit monologue field in canonical turn-log schema. |
| 2.7 Post-Processing | Partial | `src/ts/process/index.svelte.ts:1804`, `server/node/llm/execute_route_handler.cjs:245` | Logging exists, but no `mood_inertia`, `conversation_count`, `last_topics` logic. |
| 2.8 Periodic Reflection | Missing | no reflection worker/module found | No narrative/opinion/goal consolidation pass. |
| 2.9 Forgetting / Decay | Missing | no decay/archive scheduler found | No stale-memory pruning policy implementation. |
| 3.0 Short-term Summarization | Implemented | `server/node/llm/memory.cjs:273`, `server/node/llm/generate_helpers.cjs:108` | Strongly implemented as HypaV3 summary memory. |
| 4.1 Memory Inspector UI | Partial | `src/lib/Others/HypaV3Modal/modal-summary-item.svelte:150` | UI edits summaries, but not atom-level correctness/dispute semantics. |
| 4.2 Explicit Memory Commands | Missing | no command handling found | No `"Remember that I..."` / `"Forget that I..."` / `"What do you know"` command path. |
| 4.3 Privacy Controls + Memory Export | Partial | `src/lib/Setting/Pages/OtherBotSettings.svelte:412`, `src/lib/Others/HypaV3Modal.svelte:481`, `src/ts/characters.ts:533` | Partial controls exist, but no category policy engine + dedicated memory-profile export/wipe API. |

---

## Concrete Implementation Plan

## Phase 0: Foundations and Contracts

Goal: lock schemas and interfaces before wiring runtime.

Deliverables:

1. Define canonical JSON schemas:
   - Atom schema (vector memory).
   - Cognitive state schema (relational-like state object).
   - Conversation turn log schema.
2. Add validation utilities and safe defaults.
3. Add migration version headers for all new records.

Target files:

- Add `server/node/memory/schemas.cjs`
- Add `server/node/memory/validators.cjs`
- Add `server/node/memory/migrations.cjs`

Acceptance criteria:

1. Invalid planner/reflector outputs fail closed into safe defaults.
2. Schema version is persisted and migration is test-covered.

---

## Phase 1: Storage Layer Implementation

Goal: add all 3 stores behind interfaces, compatible with current server architecture.

Deliverables:

1. Atom store:
   - CRUD + filtered retrieval by category/subject/time.
   - Access stats (`access_count`, `last_accessed`).
2. Cognitive state store:
   - `mood`, `mood_intensity`, `mood_inertia`, `relationship_score`, `trust_level`, `active_goals`, `relationship_narrative`, etc.
3. Turn log store:
   - Persist `turn_id`, `session_id`, raw content, monologue, extracted atom refs, state snapshot.

Target files:

- Add `server/node/memory/atom_store.cjs`
- Add `server/node/memory/state_store.cjs`
- Add `server/node/memory/turn_log_store.cjs`
- Integrate in `server/node/server.cjs`
- Integrate routing/bootstrap in `server/node/server_route_bootstrap.cjs`

Acceptance criteria:

1. New message cycle can read/write all 3 stores without changing legacy chat format.
2. Failed vector write cannot silently corrupt state (compensation path required).

---

## Phase 2: Per-Message Cognitive Pipeline

Goal: implement steps 0-7 in server generation flow.

Deliverables:

1. Session initializer:
   - Time-gap note from `last_interaction`.
   - Load relationship narrative and unresolved tensions.
2. Context builder/query planner:
   - Structured JSON plan.
3. Parallel retrieval:
   - Atom retrieval + state read + recent turns.
4. Reflector:
   - Structured output: new atoms, contradictions, state deltas, goal updates.
5. Deterministic updater:
   - Mood inertia guards.
   - Trust asymmetry.
   - Relationship score bounds.
   - Retraction/dispute logic.
6. Prompt assembler update:
   - Add state/contradiction/time/narrative/goal layers with token budget priorities.
7. Post-processing:
   - Persist turn log snapshot and counters.

Target files:

- Add `server/node/llm/context_builder.cjs`
- Add `server/node/llm/reflector.cjs`
- Add `server/node/llm/state_updater.cjs`
- Update `server/node/llm/generate_helpers.cjs`
- Update `server/node/llm/prompt.cjs`
- Update `server/node/llm/execute_route_handler.cjs`
- Wire in `server/node/server_llm_bootstrap.cjs`

Acceptance criteria:

1. End-to-end generate route runs with graceful fallback if planner/reflector output is malformed.
2. State mutation is deterministic and validated in unit tests.

---

## Phase 3: Background Jobs (Reflection + Forgetting)

Goal: implement steps 8 and 9 as scheduled/background tasks.

Deliverables:

1. Reflection job:
   - Update relationship narrative.
   - Form/revise opinions.
   - Manage goals.
   - Consolidate atoms.
2. Forgetting/decay job:
   - Decay based on importance/access/age.
   - Archive/delete trivial stale atoms.
   - Never-forget threshold for critical atoms.

Target files:

- Add `server/node/memory/reflection_job.cjs`
- Add `server/node/memory/decay_job.cjs`
- Add scheduler init in `server/node/server.cjs`

Acceptance criteria:

1. Jobs run safely and idempotently.
2. Jobs are observable via audit logs.

---

## Phase 4: User-Facing Memory Management

Goal: match Section 4 requirements in UI and API.

Deliverables:

1. Memory inspector API + UI over atoms:
   - Grouped by category.
   - Mark correct/incorrect/delete.
   - Incorrect maps to `is_disputed=true`, confidence drop.
2. Explicit commands:
   - `"Remember that I..."`, `"Forget that I..."`, `"What do you know about me?"`.
3. Privacy controls:
   - Category-level do-not-store policy.
   - Full memory wipe endpoint.
   - Export memory profile endpoint.

Target files:

- Add `server/node/routes/memory_profile_routes.cjs`
- Update `server/node/routes/memory_routes.cjs`
- Update `src/lib/Others/HypaV3Modal.svelte` or add new memory inspector component
- Update `src/lib/Setting/Pages/OtherBotSettings.svelte`

Acceptance criteria:

1. User can inspect and edit memory atoms from UI.
2. Privacy settings are enforced in storage pipeline.

---

## Phase 5: Testing and Rollout

Goal: make rollout safe and measurable.

Deliverables:

1. Contract tests:
   - Planner/reflector schema validity and fallback behavior.
2. State guard tests:
   - Mood inertia and trust asymmetry invariants.
3. Regression tests:
   - Prompt assembly remains stable.
   - Legacy HypaV3 behavior still works when new pipeline is off.
4. Feature flag rollout:
   - Character-level or global flag with staged enablement.

Target files:

- Add tests under `server/node/` test/check framework
- Update `server/node/check-server-contracts.cjs` and related checks

Acceptance criteria:

1. New path is gated by feature flag.
2. Clear rollback path exists.

---

## PR Slicing (Recommended)

1. PR1: Schemas + validators + storage interfaces.
2. PR2: Session init + planner + retrieval wiring.
3. PR3: Reflector + deterministic updater.
4. PR4: Prompt assembly/context sandwich expansion.
5. PR5: Turn log schema + post-processing counters.
6. PR6: Reflection/decay background jobs.
7. PR7: Memory inspector + commands + privacy/export APIs.
8. PR8: Test hardening and feature-flag rollout docs.

---

## Immediate Audit Checklist (Execution Order)

1. [ ] Add atom schema and persistence with identity scoping.
2. [ ] Add cognitive state schema and deterministic updater invariants.
3. [ ] Add turn log schema with monologue + state snapshots.
4. [ ] Add context builder planner output contract.
5. [ ] Add reflector output contract and contradiction model.
6. [ ] Expand prompt layers (state/contradiction/time/narrative/goals).
7. [ ] Add background reflection and forgetting jobs.
8. [ ] Add memory inspector correctness/dispute APIs.
9. [ ] Add explicit memory command handling.
10. [ ] Add privacy policy engine + memory export/wipe.
11. [ ] Add tests and rollout flags.

---

## Notes on Compatibility with Current Code

1. Keep HypaV3 summary system during migration; use it as short-term/context layer while atom memory is introduced.
2. Introduce new modules behind stable interfaces so future migration to SQLite/Postgres + vector DB is straightforward.
3. Reuse existing audit infrastructure (`appendLLMAudit`) for planner/reflector/reflection observability.
