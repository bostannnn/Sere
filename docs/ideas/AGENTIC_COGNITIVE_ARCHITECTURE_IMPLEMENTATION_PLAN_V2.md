# Agentic Cognitive Architecture — Complete Implementation Plan v2

> **Audience:** This document is the single source of truth for implementing the Agentic Cognitive Architecture feature. It is written to be used by both human developers and AI coding agents. Read the entire document before starting any phase.
>
> **Prerequisite reading:**
> - `docs/Agentic Cognitive Architecture — Full System Specification.md` — the full feature spec
> - `docs/ONBOARDING.md` — project conventions, dev commands, check sequence
> - `docs/SERVER_RULES.md` — mandatory server coding rules
> - `docs/TESTING_RULES.md` — mandatory testing requirements

---

## Table of Contents

1. [What This Feature Does](#1-what-this-feature-does)
2. [Current Codebase Baseline](#2-current-codebase-baseline)
3. [Open Questions — Must Resolve Before Starting](#3-open-questions--must-resolve-before-starting)
4. [Pre-Implementation Decisions](#4-pre-implementation-decisions)
5. [Code Conventions (Non-Negotiable)](#5-code-conventions-non-negotiable)
6. [Phase 0 — Foundations and Schemas](#phase-0--foundations-and-schemas)
7. [Phase 1 — Storage Layer](#phase-1--storage-layer)
8. [Phase 2 — Per-Message Cognitive Pipeline](#phase-2--per-message-cognitive-pipeline)
9. [Phase 3 — Background Jobs](#phase-3--background-jobs)
10. [Phase 4 — User-Facing Memory Management](#phase-4--user-facing-memory-management)
11. [Phase 5 — Testing and Rollout](#phase-5--testing-and-rollout)
12. [PR Slicing](#pr-slicing)
13. [Complexity and Risk Register](#complexity-and-risk-register)

---

## 1. What This Feature Does

### Plain-English Summary

Today, each conversation starts from scratch. The AI has no persistent memory of the user across sessions, no model of its own emotional state, and no understanding of how the relationship has evolved over time.

This feature adds a **cognitive layer** that runs alongside every message exchange. After each message:

- Facts the user mentions ("I'm moving to Japan", "I hate mornings") are extracted and stored as discrete **memory atoms** in a searchable vector store.
- The AI's internal **state** (mood, trust in the user, relationship quality score) is updated deterministically based on how the conversation went.
- Contradictions between what the user says now and what they said before are detected and flagged.
- A **context sandwich** is assembled for each prompt: current state + relevant memories + relationship history + recent conversation, all within a token budget.

Periodically (not every message), a background **reflection job** consolidates memory atoms, updates a rolling relationship narrative, and forms the AI's long-term opinions about the user. A separate **forgetting/decay job** prunes stale, low-importance atoms to keep memory relevant.

Users get a **memory inspector UI** to see what the AI remembers, correct mistakes, and control what gets stored.

**Result:** The AI remembers that the user mentioned moving to Japan three weeks ago, is still slightly hurt from last Tuesday's cold response, and trusts the user less than it did in week one — and all of that context is reflected in every reply.

---

## 2. Current Codebase Baseline

### What already exists and maps to the spec

| Spec Component | Status | Current Location | Notes |
|---|---|---|---|
| Short-term conversation buffer | ✅ Implemented | `server/node/llm/memory.cjs:273`, `prompt.cjs:227` | HypaV3 summarization is solid. Keep as-is during migration. |
| Short-term summarization | ✅ Implemented | `server/node/llm/memory.cjs`, `generate_helpers.cjs:330` | Maps to spec Step 3.0 |
| Internal LLM call infrastructure | ✅ Implemented | `generate_helpers.cjs: executeInternalLLMTextCompletion()` | Reuse for context builder and reflector calls |
| Audit/trace logging | ✅ Implemented | `execute_route_handler.cjs: appendLLMAudit()`, `appendGenerateTraceAudit()` | Extend for new pipeline steps |
| Prompt template system | ✅ Implemented | `prompt.cjs: buildMessagesFromPromptTemplate()` | Add new template block types for state/memory layers |
| `<Thoughts>` extraction | ✅ Implemented | `execute_route_handler.cjs:~190` | Parsed from stream but **not persisted** — fix in Phase 2 |
| Embedding generation | ✅ Implemented | `server/node/rag/embedding.cjs` | Reuse for atom embeddings |
| DI / factory pattern | ✅ Implemented | All server modules | New modules must follow same pattern |
| Path safety utilities | ✅ Implemented | `server/node/llm/execute_route_handler.cjs: isSafePathSegment()` | Required on every user-supplied ID |
| Relational cognitive state (mood/trust/relationship) | ❌ Missing | — | Nothing exists. Build from scratch. |
| Vector atom store (with full schema) | ❌ Missing | Embeddings stored inline in JSON, no atom schema | Must add proper storage with atom schema |
| Reflector module | ❌ Missing | — | Build from scratch |
| Context builder / query planner | ❌ Missing | — | Build from scratch |
| Deterministic state updater (inertia, bounds, trust asymmetry) | ❌ Missing | — | Build from scratch |
| Periodic reflection job | ❌ Missing | — | Build from scratch |
| Forgetting / decay job | ❌ Missing | — | Build from scratch |
| Session ID system | ❌ Missing | `chatId` exists but is not a session boundary | Define and implement |
| Turn log with state snapshots | ❌ Missing | `execution_log.jsonl` exists but has no cognitive state | Extend schema |
| `<Thoughts>` persistence | ❌ Missing | Extracted but discarded | Persist to turn log |
| Memory inspector (atom-level) | ❌ Missing | HypaV3 UI shows summaries, different abstraction | Build new UI or extend existing |
| Explicit memory commands | ❌ Missing | — | Build from scratch |
| Privacy policy engine | ❌ Missing | Hard reset only | Build from scratch |

### Existing pipeline data flow (simplified)

```
POST /data/llm/generate
  → buildGenerateExecutionPayload()   [generate_helpers.cjs]
      reads: settings.json, character.json, chats/{chatId}.json
      runs:  maybeRunServerPeriodicHypaV3Summarization()
      calls: buildGeneratePromptMessages() [prompt.cjs]
               calls: buildServerMemoryMessages() [memory.cjs]
      returns: { provider, model, request, promptBlocks }
  → executeLLM()
  → handleLLMExecutePost()            [execute_route_handler.cjs]
      streams or returns response
      runs: updateGameStateFromMessage()
      logs: appendLLMAudit(), appendGenerateTraceAudit()
```

The new pipeline inserts steps **before** `executeLLM()` (context builder + reflector) and **wraps** the whole handler with cognitive state reads/writes.

---

## 3. Open Questions — Must Resolve Before Starting

These questions have no currently correct answer in the codebase. Each one is a decision that will ripple through all phases. They must be answered and recorded before any phase begins.

---

### OQ-1: Storage backend for atom store and cognitive state

**The problem:** The current file-per-chat JSON model cannot support the cognitive architecture. The new pipeline requires:
- Vector similarity search over potentially thousands of atoms (currently: O(n) cosine scan in memory — fine at 50 summaries, broken at 5,000 atoms)
- Frequent small writes to cognitive state fields (mood, trust, relationship_score) on every message turn
- Concurrent reads/writes with etag protection across 3+ stores in a single request

**Options:**

| Option | Pros | Cons |
|---|---|---|
| A: Keep JSON files, store atoms as one file per chat | Zero new dependencies, consistent with existing pattern | O(n) scan for vector search, no indexing, concurrent-write hazard on state fields |
| B: SQLite per data-root | Fast, no network, embedded, supports concurrent readers, can store both state and atoms | New dependency, requires migration tooling, must integrate with existing etag pattern |
| C: SQLite for state + keep JSON for atoms (with in-process cosine scan) | State writes are safe, atoms stay familiar | Still O(n) for vector search, two storage systems to maintain |
| D: SQLite for state + Vectra/local vector index for atoms | Proper vector search, fast | Two new systems, more complex setup and migration |

**Recommendation to decide:** Option B (SQLite per data-root) is likely the right call for a self-hosted app. But this must be an explicit decision by the project owner before Phase 1 begins.

**❓ Decision required from project owner before Phase 1.**

---

### OQ-2: Latency budget for extra LLM calls

**The problem:** The new pipeline adds at minimum 2 extra LLM calls before the main generation (context builder + reflector). On a 500ms model this is ~1.5s of additional wait before the user sees anything. On a slow model it could be 5–10s.

**Options:**

| Option | Behavior |
|---|---|
| A: Sequential — user waits for all pre-calls before response streams | Safest for correctness, worst for UX |
| B: Parallel pre-calls — context builder and reflector run in parallel | Faster, but reflector depends on retrieval which depends on context builder |
| C: Fire-and-forget — main generation starts immediately, pre-calls run async and write to state for the *next* turn only | Best latency, state is always 1-turn stale |
| D: Fast model only for pre-calls — use a cheap/fast model (e.g. GPT-4o-mini) for context builder and reflector, reserve main model for character LLM | Good balance. Requires a configurable "fast model" setting |

**❓ Decision required: what latency degradation is acceptable? Which option?**

---

### OQ-3: Session definition

**The problem:** The spec calls for a `session_id` and session-level lifecycle. Currently, the codebase has no concept of a "session" — only `chatId` (a persistent conversation). There is no concept of "starting" or "ending" a session.

**Options:**

| Option | Definition |
|---|---|
| A: Session = browser tab lifetime | Session starts when the user opens the chat tab, ends when they close it. Detected client-side. |
| B: Session = inactivity gap | A new session starts if more than N hours (e.g. 8h) have passed since `lastInteraction`. Detected server-side from timestamp. |
| C: Session = explicit server-side generation | A UUID is generated on the first message after an inactivity gap. Subsequent messages in the same gap share the session ID. |

**Impact:** Session IDs affect: turn log schema, the session initialization step (spec Step 0), time-gap note generation, and the reflection job trigger.

**❓ Decision required: which definition of "session" to use?**

---

### OQ-4: HypaV3 migration strategy

**The problem:** Existing users have HypaV3 summaries. The new system uses atoms (discrete facts with structured metadata). These are different abstractions. Summaries are multi-sentence blobs; atoms are single facts.

**Options:**

| Option | Behavior |
|---|---|
| A: Run in parallel forever | HypaV3 stays as the short-term/context layer; atoms are a new long-term layer. No migration. Users slowly accumulate atoms while keeping their summaries. |
| B: Migrate summaries to atoms on first access | Each existing summary is sent to an LLM to be decomposed into atoms. One-time cost, then only atoms going forward. |
| C: Hard cutover with data loss warning | At feature enable, HypaV3 data is archived (not deleted) and atoms start fresh. |

**❓ Decision required: what happens to existing HypaV3 data when the feature is enabled?**

**Recommendation:** Option A is safest and simplest. HypaV3 continues as the `memory` template block. Atoms provide an additional layer (`cognitiveMemory` block). Phase them in as parallel systems.

---

### OQ-5: Reflection and decay job scheduling

**The problem:** Node.js has no built-in job scheduler. The spec calls for periodic background processing (every N messages or at session end, and a daily/periodic decay pass).

**Options:**

| Option | Implementation |
|---|---|
| A: In-process interval timer | `setInterval()` in `server.cjs`. Simple, dies with server restart. |
| B: Message-count trigger | Check inside `handleLLMExecutePost()` after every N messages; trigger reflection synchronously (or fork to a worker). |
| C: External cron + endpoint | A cron job hits a protected internal endpoint `/internal/run-reflection`. Requires infrastructure outside the app. |
| D: `node-cron` package | Lightweight in-process cron scheduler. Minimal dependency. |

**❓ Decision required: which approach?**

**Recommendation:** Option B for reflection (triggered per N messages, async so it doesn't block response), Option A or D for decay (low-frequency, can run on restart + interval).

---

### OQ-6: Feature flag architecture

**The problem:** This is a large change. It must be possible to run the old pipeline for characters that have not opted in, and the new pipeline for characters/globally that have. A bug in the reflector should not break characters that don't use it.

**Options:**

| Option | Granularity |
|---|---|
| A: Global flag in `settings.json` | `settings.cognitiveArchitecture.enabled: true/false` |
| B: Per-character flag in `character.json` | `character.cognitiveArchitecture.enabled: true/false` |
| C: Both — global default + per-character override | Most flexible, most code |

**❓ Decision required: global, per-character, or both?**

**Recommendation:** Option C. Global flag to enable the feature at all; per-character flag to opt individual characters in/out. Start with global=false.

---

### OQ-7: Reflector model selection

**The problem:** The reflector prompt is complex structured JSON output. Not all models reliably produce valid JSON. It needs to be configurable, and a fallback must exist for when it fails.

**Questions:**
- Should the reflector use the same model as the main character LLM, or the same model as HypaV3 summarization (`settings.hypaModel`)?
- Should there be a dedicated `cognitiveModel` setting (like `hypaModel` for HypaV3)?
- What happens on JSON parse failure — skip extraction, use last known state, or retry once?

**❓ Decision required: model selection and failure behavior.**

---

### OQ-8: Identity scoping per atom/state/log record

**The problem:** Every atom, state record, and log entry must be scoped to prevent cross-character or cross-user data leaks. The spec mentions `character_id`, `chat_id`, `user_id`, `tenant_id`.

**Currently in the codebase:** `characterId` and `chatId` exist. There is no `userId` or `tenantId` concept in the self-hosted version. The multi-user/tenant case is unclear.

**❓ Decision required: is multi-user support required? If yes, what is the user identity model?**

**Minimum safe requirement (even single-user):** Every atom, state record, and log entry must store `characterId` and `chatId`. Any query against these stores must filter by both fields. This is non-negotiable regardless of other decisions.

---

## 4. Pre-Implementation Decisions

Record all OQ answers here before Phase 0 begins. Agents: do not proceed with any phase until this table is filled in.

| OQ | Question | Decision | Decided By | Date |
|---|---|---|---|---|
| OQ-1 | Storage backend | _pending_ | | |
| OQ-2 | Latency budget / extra LLM calls | _pending_ | | |
| OQ-3 | Session definition | _pending_ | | |
| OQ-4 | HypaV3 migration strategy | _pending_ | | |
| OQ-5 | Job scheduling approach | _pending_ | | |
| OQ-6 | Feature flag architecture | _pending_ | | |
| OQ-7 | Reflector model selection | _pending_ | | |
| OQ-8 | Identity scoping | _pending_ | | |

---

## 5. Code Conventions (Non-Negotiable)

All new server-side code must follow the existing patterns. Agents: if any of the rules below conflict with how you would normally write code, the rules below win.

### DI Pattern

Every new module must use the factory pattern:

```javascript
// CORRECT
function createContextBuilder(arg = {}) {
    const executeInternalLLMTextCompletion = arg.executeInternalLLMTextCompletion;
    const readJsonWithEtag = arg.readJsonWithEtag;
    const logError = arg.logError || console.error;

    async function buildRetrievalPlan({ userMessage, recentTurns }) {
        // implementation
    }

    return { buildRetrievalPlan };
}
module.exports = { createContextBuilder };

// WRONG — do not do this
const { executeLLM } = require('../llm'); // no inline requires of deps
```

All dependencies destructured at the top of the factory. Never accessed inline after construction.

### Path Safety

Every user-supplied ID (`characterId`, `chatId`, `sessionId`, `atomId`) must be validated before use in a path:

```javascript
if (!isSafePathSegment(characterId)) {
    throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId contains invalid characters');
}
```

### Error Handling

Every async handler wrapped in try/catch. Non-fatal errors (e.g. reflector failure) are logged and execution continues with stale/default state. Fatal errors use `LLMHttpError` and are caught by the top-level handler.

```javascript
// Non-fatal: reflector failure
try {
    reflectorResult = await runReflector({ ... });
} catch (err) {
    logError('[Reflector] failed, using stale state:', err.message);
    reflectorResult = null; // pipeline continues with null result
}
```

### Response Helpers

Always use `sendJson(res, status, payload)`. Never `res.json()` or `res.send()`. For SSE errors use `sendSSE(res, { type: 'fail', ... })`.

### File Writes

Always use `readJsonWithEtag` → modify → `writeJsonWithEtag`. Never write without reading first. Never overwrite blindly.

### Business Logic Location

No business logic in route files. If a route handler grows beyond ~20 lines, extract to a service module.

---

## Phase 0 — Foundations and Schemas

**Goal:** Lock data contracts, validation utilities, and the feature flag system before any runtime wiring. Nothing in this phase changes the existing pipeline.

**Blocks:** All subsequent phases depend on Phase 0.

---

### P0.1 — Atom Schema

**File to create:** `server/node/memory/schemas.cjs`

Define and export these schema factories. All are plain objects (no class instances).

**Atom schema:**
```javascript
function createAtom(fields) {
    return {
        id: fields.id,                        // string UUID — required
        characterId: fields.characterId,      // string — required
        chatId: fields.chatId,                // string — required
        content: fields.content,              // string — required
        category: fields.category,            // 'fact' | 'preference' | 'plan' | 'emotion' | 'opinion' | 'event'
        subject: fields.subject,              // 'user' | 'ai' | 'relationship'
        confidence: fields.confidence ?? 0.5, // float 0-1
        importance: fields.importance ?? 0.5, // float 0-1
        timestamp: fields.timestamp ?? Date.now(),
        sourceTurnId: fields.sourceTurnId ?? null,
        supersedes: fields.supersedes ?? [],  // array of atom UUIDs this replaces
        accessCount: fields.accessCount ?? 0,
        lastAccessed: fields.lastAccessed ?? null,
        tags: fields.tags ?? [],
        isDisputed: fields.isDisputed ?? false,
        embedding: fields.embedding ?? null,  // number[] | null
        schemaVersion: 1,
    };
}
```

**Cognitive state schema:**
```javascript
function createCognitiveState(fields = {}) {
    return {
        characterId: fields.characterId,      // string — required
        chatId: fields.chatId,                // string — required
        mood: fields.mood ?? 'neutral',       // string
        moodIntensity: fields.moodIntensity ?? 0.5,    // float 0-1
        moodInertia: fields.moodInertia ?? 0,           // int (turns held)
        relationshipScore: fields.relationshipScore ?? 0, // int -100 to 100
        trustLevel: fields.trustLevel ?? 0.5,            // float 0-1
        activeGoals: fields.activeGoals ?? [],           // array of goal objects
        conversationCount: fields.conversationCount ?? 0,
        lastInteraction: fields.lastInteraction ?? null, // timestamp ms
        relationshipPhase: fields.relationshipPhase ?? 'strangers',
        relationshipNarrative: fields.relationshipNarrative ?? '',
        unresolvedTensions: fields.unresolvedTensions ?? [],
        positiveAnchors: fields.positiveAnchors ?? [],
        personalityDrift: fields.personalityDrift ?? {},
        perceivedUserMood: fields.perceivedUserMood ?? 'neutral',
        engagementLevel: fields.engagementLevel ?? 'casual',
        lastTopics: fields.lastTopics ?? [],
        updatedAt: fields.updatedAt ?? null,
        schemaVersion: 1,
    };
}
```

**Turn log entry schema:**
```javascript
function createTurnLogEntry(fields) {
    return {
        turnId: fields.turnId,                // string UUID — required
        sessionId: fields.sessionId,          // string UUID — required
        characterId: fields.characterId,      // string — required
        chatId: fields.chatId,                // string — required
        role: fields.role,                    // 'user' | 'assistant'
        content: fields.content,              // string
        timestamp: fields.timestamp ?? Date.now(),
        extractedAtomIds: fields.extractedAtomIds ?? [],
        aiInternalMonologue: fields.aiInternalMonologue ?? null,
        stateSnapshot: fields.stateSnapshot ?? null, // cognitive state at this turn
        schemaVersion: 1,
    };
}
```

**Goal schema (used inside cognitiveState.activeGoals):**
```javascript
function createGoal(fields) {
    return {
        id: fields.id,                        // string UUID
        goal: fields.goal,                    // string description
        status: fields.status ?? 'active',    // 'active' | 'achieved' | 'retired' | 'blocked'
        priority: fields.priority ?? 'medium',// 'low' | 'medium' | 'high'
        created: fields.created ?? Date.now(),
        updatedAt: fields.updatedAt ?? null,
        note: fields.note ?? null,
    };
}
```

**Exports:** `{ createAtom, createCognitiveState, createTurnLogEntry, createGoal }`

---

### P0.2 — Validators

**File to create:** `server/node/memory/validators.cjs`

Validate all LLM-generated JSON outputs before they touch any application state. The system must never crash on a bad LLM response.

```javascript
// Validates reflector output (spec Step 3)
function validateReflectorOutput(raw) {
    // Returns { valid: true, data: parsedOutput } or { valid: false, errors: [...], data: safeDefault }
    // Safe default: { new_atoms: [], contradictions: [], state_deltas: null, goal_updates: [], retraction_detected: false }
    // Rules:
    // - Must be parseable JSON
    // - new_atoms: array, each item must have content (string), category (valid enum), confidence (0-1), importance (0-1)
    // - state_deltas.mood_shift must be a valid enum value or absent
    // - relationship_score_delta must be number in range -10 to +10 or absent
    // - trust_delta must be number in range -0.2 to +0.2 or absent
    // Clamp all numeric fields to valid ranges even if present
}

// Validates context builder (planner) output (spec Step 1)
function validatePlannerOutput(raw) {
    // Returns { valid: true, data } or { valid: false, errors, data: safeDefault }
    // Safe default: { search_queries: [], categories_needed: [], subjects_needed: [], emotional_valence: 'neutral', recency_bias: 'medium', is_trivial: false }
    // Rules:
    // - Must be parseable JSON
    // - search_queries: array of strings (max 5, each max 200 chars)
    // - categories_needed, subjects_needed: array of known enum values only
    // - is_trivial: boolean
}

// Validates periodic reflection output (spec Step 8)
function validateReflectionOutput(raw) {
    // Returns { valid: true, data } or { valid: false, errors, data: safeDefault }
    // Safe default: { updated_narrative: null, new_opinions: [], revised_opinions: [], new_goals: [], goal_updates: [], consolidation_suggestions: [], deprioritize_atom_ids: [], trajectory: 'stable' }
    // Rules:
    // - updated_narrative: string or null, max 500 chars
    // - trajectory: 'improving' | 'stable' | 'declining' or absent
}
```

**Exports:** `{ validateReflectorOutput, validatePlannerOutput, validateReflectionOutput }`

---

### P0.3 — Utility: UUID generation

**File to create:** `server/node/memory/id_utils.cjs`

The codebase currently has no UUID generation utility. Provide one that works in Node.js without external dependencies:

```javascript
const { randomUUID } = require('crypto');

function generateId() {
    return randomUUID();
}

module.exports = { generateId };
```

---

### P0.4 — Feature Flag Utility

**File to create:** `server/node/memory/feature_flags.cjs`

```javascript
// Read cognitive architecture feature flags from settings object
function isCognitiveArchitectureEnabled(settings) {
    return settings?.cognitiveArchitecture?.enabled === true;
}

function isCognitiveArchitectureEnabledForCharacter(settings, character) {
    if (!isCognitiveArchitectureEnabled(settings)) return false;
    // Per-character override: if explicitly set to false, disable
    if (character?.cognitiveArchitecture?.enabled === false) return false;
    // Per-character override: if explicitly set to true, enable
    if (character?.cognitiveArchitecture?.enabled === true) return true;
    // Default: follow global flag
    return true;
}

module.exports = { isCognitiveArchitectureEnabled, isCognitiveArchitectureEnabledForCharacter };
```

**Settings schema addition** (document for users, add to settings defaults):
```json
{
  "cognitiveArchitecture": {
    "enabled": false,
    "cognitiveModel": null,
    "reflectionIntervalMessages": 15,
    "forgettingIntervalHours": 24,
    "sessionInactivityThresholdMs": 28800000,
    "moodInertiaThreshold": 5,
    "forgetThreshold": 0.15,
    "minAccessCountToKeep": 2
  }
}
```

---

### P0.5 — Session ID Logic

**File to create:** `server/node/memory/session_utils.cjs`

Based on the answer to OQ-3, implement one of the following options. **Insert decision here before implementing.**

```javascript
// Option B implementation (inactivity gap — recommended default):
function resolveSessionId(cognitiveState, settings) {
    const thresholdMs = settings?.cognitiveArchitecture?.sessionInactivityThresholdMs ?? 8 * 60 * 60 * 1000;
    const now = Date.now();
    const last = cognitiveState?.lastInteraction ?? 0;
    const isNewSession = (now - last) > thresholdMs;

    if (isNewSession) {
        return { sessionId: generateId(), isNewSession: true, gapMs: now - last };
    }
    return { sessionId: cognitiveState.currentSessionId ?? generateId(), isNewSession: false, gapMs: now - last };
}
```

**Exports:** `{ resolveSessionId }`

---

### Phase 0 Acceptance Criteria

- [ ] `server/node/memory/schemas.cjs` exports all four schema factories
- [ ] `server/node/memory/validators.cjs` exports all three validators, returns safe defaults on any malformed input (never throws)
- [ ] `server/node/memory/id_utils.cjs` exports `generateId()`
- [ ] `server/node/memory/feature_flags.cjs` exports both flag checkers
- [ ] `server/node/memory/session_utils.cjs` exports `resolveSessionId()`
- [ ] Unit tests: `scripts/test-memory-schemas-unit.cjs` — covers every schema factory (required fields, defaults, clamping), every validator (valid input, malformed JSON, out-of-range values), flag logic
- [ ] `.gitignore` exceptions added for new test files
- [ ] No changes to any existing files in this phase

---

## Phase 1 — Storage Layer

**Goal:** Implement the three storage backends (atom store, cognitive state store, turn log store) behind clean interfaces. Integrate with `server.cjs`. No pipeline changes yet.

**Depends on:** Phase 0 complete. OQ-1 (storage backend) answered.

**⚠️ Note:** The implementation details below assume **OQ-1 resolves to Option B (SQLite)**. If a different option is chosen, adapt accordingly but keep the same exported interface so all higher phases remain unchanged.

---

### P1.1 — Atom Store

**File to create:** `server/node/memory/atom_store.cjs`

This is the vector/long-term memory store. Each atom is a row. The interface must be storage-backend agnostic (callers never touch SQL or file paths directly).

```javascript
function createAtomStore(arg = {}) {
    const db = arg.db;                         // SQLite connection or equivalent
    const generateEmbeddings = arg.generateEmbeddings; // from rag/embedding.cjs
    const createAtom = arg.createAtom;         // from schemas.cjs
    const generateId = arg.generateId;         // from id_utils.cjs
    const logError = arg.logError || console.error;

    // Insert a new atom. Generates embedding if content provided and embeddings available.
    async function insertAtom({ characterId, chatId, content, category, subject, confidence, importance, tags, sourceTurnId, supersedes }) { ... }

    // Search atoms by semantic similarity + optional filters
    // Returns top N atoms sorted by: (semantic_similarity * recency_weight * importance)
    async function searchAtoms({ characterId, chatId, queries, categories, subjects, limit, recencyBias }) { ... }

    // Get atom by ID
    async function getAtom({ characterId, chatId, atomId }) { ... }

    // Mark atom as disputed (user correction)
    async function disputeAtom({ characterId, chatId, atomId }) { ... }

    // Mark atom as superseded by a newer atom
    async function supersededBy({ characterId, chatId, oldAtomId, newAtomId }) { ... }

    // Update atom importance/confidence (used by reflection job)
    async function updateAtom({ characterId, chatId, atomId, fields }) { ... }

    // Delete atom permanently (only for privacy/wipe operations)
    async function deleteAtom({ characterId, chatId, atomId }) { ... }

    // Delete all atoms for a character+chat (full memory wipe)
    async function deleteAllAtoms({ characterId, chatId }) { ... }

    // Get all atoms for memory inspector UI (paginated)
    async function listAtoms({ characterId, chatId, category, subject, page, pageSize }) { ... }

    // Increment access count + last_accessed (called on retrieval)
    async function recordAccess({ characterId, chatId, atomIds }) { ... }

    return {
        insertAtom, searchAtoms, getAtom, disputeAtom,
        supersededBy, updateAtom, deleteAtom, deleteAllAtoms,
        listAtoms, recordAccess,
    };
}

module.exports = { createAtomStore };
```

**Storage note — embeddings:** If SQLite, store embedding as a BLOB (serialized Float32Array). Cosine similarity computed in JS on the retrieved rows. This is acceptable up to ~10,000 atoms. If performance becomes a bottleneck, this is the single place to swap in a vector DB without touching other modules.

**Identity scoping:** Every query must filter by both `characterId` AND `chatId`. Every insert must include both. No cross-character or cross-chat reads are ever permitted.

---

### P1.2 — Cognitive State Store

**File to create:** `server/node/memory/state_store.cjs`

Stores the single mutable cognitive state object per (characterId, chatId) pair. Read and written every turn.

```javascript
function createStateStore(arg = {}) {
    const db = arg.db;
    const createCognitiveState = arg.createCognitiveState; // from schemas.cjs
    const logError = arg.logError || console.error;

    // Get current state. Returns createCognitiveState defaults if no record exists yet.
    async function getState({ characterId, chatId }) { ... }

    // Write full state (replaces existing record)
    async function setState({ characterId, chatId, state }) { ... }

    // Partial update — merge fields into existing state
    async function patchState({ characterId, chatId, patch }) { ... }

    // Delete state record (full wipe)
    async function deleteState({ characterId, chatId }) { ... }

    return { getState, setState, patchState, deleteState };
}

module.exports = { createStateStore };
```

---

### P1.3 — Turn Log Store

**File to create:** `server/node/memory/turn_log_store.cjs`

Append-only log of every conversation turn. Used as input for the reflection job. Not used for real-time retrieval.

```javascript
function createTurnLogStore(arg = {}) {
    const db = arg.db;
    const createTurnLogEntry = arg.createTurnLogEntry; // from schemas.cjs
    const logError = arg.logError || console.error;

    // Append a new turn to the log
    async function appendTurn({ characterId, chatId, sessionId, role, content, turnId, extractedAtomIds, aiInternalMonologue, stateSnapshot }) { ... }

    // Retrieve last N turns for a chat (used by reflection job)
    async function getRecentTurns({ characterId, chatId, limit }) { ... }

    // Retrieve turns since a given timestamp (for reflection job incremental pass)
    async function getTurnsSince({ characterId, chatId, since }) { ... }

    // Delete all turns for a chat (wipe)
    async function deleteAllTurns({ characterId, chatId }) { ... }

    return { appendTurn, getRecentTurns, getTurnsSince, deleteAllTurns };
}

module.exports = { createTurnLogStore };
```

---

### P1.4 — Database Initialization

**File to create:** `server/node/memory/db_init.cjs`

Initializes the SQLite database (or equivalent), runs schema migrations, returns a connected `db` instance.

```javascript
function createCognitiveDb(arg = {}) {
    const dbPath = arg.dbPath;          // path.join(dataDirs.root, 'cognitive.db')
    const schemaVersion = 1;

    async function initialize() {
        // Open or create SQLite DB
        // Create tables if not exist:
        //   atoms (id, character_id, chat_id, content, category, subject, confidence, importance,
        //          timestamp, source_turn_id, supersedes_json, access_count, last_accessed,
        //          tags_json, is_disputed, embedding_blob, schema_version)
        //   cognitive_state (character_id, chat_id, state_json, updated_at, schema_version)
        //   turn_log (turn_id, session_id, character_id, chat_id, role, content, timestamp,
        //             extracted_atom_ids_json, ai_internal_monologue, state_snapshot_json, schema_version)
        // Run any pending migrations (check schema_version in a meta table)
        // Return db connection
    }

    return { initialize };
}

module.exports = { createCognitiveDb };
```

---

### P1.5 — Wire storage into server.cjs

**File to modify:** `server/node/server.cjs`

Add to the initialization sequence (after `createServerPaths()`, before route registration):

```javascript
const { createCognitiveDb } = require('./memory/db_init.cjs');
const { createAtomStore } = require('./memory/atom_store.cjs');
const { createStateStore } = require('./memory/state_store.cjs');
const { createTurnLogStore } = require('./memory/turn_log_store.cjs');

// In the async init block:
const cognitiveDb = createCognitiveDb({ dbPath: path.join(dataDirs.root, 'cognitive.db') });
const db = await cognitiveDb.initialize();

const atomStore = createAtomStore({ db, generateEmbeddings, createAtom, generateId });
const stateStore = createStateStore({ db, createCognitiveState });
const turnLogStore = createTurnLogStore({ db, createTurnLogEntry });

// Pass into LLM bootstrap:
createServerLlmBootstrap({ ..., atomStore, stateStore, turnLogStore });
```

---

### Phase 1 Acceptance Criteria

- [ ] `server/node/memory/atom_store.cjs` — all interface functions implemented and exported
- [ ] `server/node/memory/state_store.cjs` — all interface functions implemented and exported
- [ ] `server/node/memory/turn_log_store.cjs` — all interface functions implemented and exported
- [ ] `server/node/memory/db_init.cjs` — initializes DB, creates tables, schema version tracked
- [ ] `server/node/server.cjs` — stores initialized and injected, guarded by feature flag (init only if `cognitiveArchitecture.enabled`)
- [ ] A failed atom write must NOT corrupt the cognitive state write. Implement compensation: if atom insert fails, log error and continue; do not attempt to write state that depends on the atom.
- [ ] All queries filter by both `characterId` AND `chatId`
- [ ] Unit tests: `scripts/test-memory-stores-unit.cjs` — CRUD on all three stores, identity isolation test (character A cannot read character B's atoms), defaults test (getState on unknown character returns defaults)
- [ ] Smoke test: `scripts/test-server-memory-stores.js` — HTTP round-trip via server, verify DB writes

---

## Phase 2 — Per-Message Cognitive Pipeline

**Goal:** Implement all 8 in-request pipeline steps (spec Steps 0–7). Wrap the existing generate handler with the cognitive layer. The existing HypaV3 pipeline continues to run unchanged inside this wrapper.

**Depends on:** Phase 1 complete. OQ-2, OQ-3, OQ-5, OQ-6, OQ-7 answered.

**❗ Critical rule:** If the feature flag is off for a character, the existing pipeline runs exactly as before. Not a single line of existing behavior changes for unflagged characters.

---

### P2.1 — Session Initializer

**File to create:** `server/node/llm/session_initializer.cjs`

Runs once per session (detected via `resolveSessionId`). Loads state and produces a `SessionContext` object consumed by subsequent steps.

```javascript
function createSessionInitializer(arg = {}) {
    const stateStore = arg.stateStore;
    const turnLogStore = arg.turnLogStore;
    const resolveSessionId = arg.resolveSessionId;

    async function initializeSession({ characterId, chatId, settings }) {
        const state = await stateStore.getState({ characterId, chatId });
        const { sessionId, isNewSession, gapMs } = resolveSessionId(state, settings);

        let timeGapNote = null;
        if (isNewSession && state.lastInteraction) {
            const gapHours = Math.round(gapMs / 3600000);
            const gapDays = Math.round(gapMs / 86400000);
            if (gapDays >= 1) timeGapNote = `It has been ${gapDays} day${gapDays > 1 ? 's' : ''} since the last conversation.`;
            else if (gapHours >= 1) timeGapNote = `It has been about ${gapHours} hour${gapHours > 1 ? 's' : ''} since the last conversation.`;
        }

        const recentTurns = await turnLogStore.getRecentTurns({ characterId, chatId, limit: 6 });

        return {
            sessionId,
            isNewSession,
            timeGapNote,
            state,
            recentTurns,
        };
    }

    return { initializeSession };
}

module.exports = { createSessionInitializer };
```

---

### P2.2 — Context Builder (Query Planner)

**File to create:** `server/node/llm/context_builder.cjs`

Makes an LLM call (fast/cheap model) to determine what to retrieve from memory before the main generation.

```javascript
function createContextBuilder(arg = {}) {
    const executeInternalLLMTextCompletion = arg.executeInternalLLMTextCompletion;
    const validatePlannerOutput = arg.validatePlannerOutput;
    const logError = arg.logError || console.error;

    // Builds the planner prompt (see spec Step 1 for the template)
    function buildPlannerPrompt({ userMessage, recentTurns }) { ... }

    async function buildRetrievalPlan({ userMessage, recentTurns, settings, sessionContext }) {
        // If no userMessage or trivially short, return safe default plan
        if (!userMessage || userMessage.trim().length < 3) {
            return { search_queries: [], categories_needed: [], subjects_needed: [], emotional_valence: 'neutral', recency_bias: 'low', is_trivial: true };
        }

        let raw = null;
        try {
            raw = await executeInternalLLMTextCompletion({
                provider: settings.provider,
                model: settings.cognitiveArchitecture?.cognitiveModel ?? settings.hypaModel,
                messages: buildPlannerPrompt({ userMessage, recentTurns }),
                maxTokens: 400,
            });
        } catch (err) {
            logError('[ContextBuilder] planner LLM call failed:', err.message);
        }

        const { data } = validatePlannerOutput(raw);
        return data;
    }

    return { buildRetrievalPlan };
}

module.exports = { createContextBuilder };
```

---

### P2.3 — Memory Retrieval (Parallel)

**File to create:** `server/node/llm/cognitive_retrieval.cjs`

Runs the three parallel retrievals defined in spec Step 2.

```javascript
function createCognitiveRetrieval(arg = {}) {
    const atomStore = arg.atomStore;
    const stateStore = arg.stateStore;

    async function retrieve({ characterId, chatId, plan, sessionContext }) {
        // Run in parallel:
        const [relevantAtoms, currentState] = await Promise.all([
            // 2a: Vector search — skip if is_trivial
            plan.is_trivial
                ? Promise.resolve([])
                : atomStore.searchAtoms({
                    characterId,
                    chatId,
                    queries: plan.search_queries,
                    categories: plan.categories_needed,
                    subjects: plan.subjects_needed,
                    limit: 10,
                    recencyBias: plan.recency_bias,
                  }),
            // 2b: State read (already loaded in session init, but re-read for freshness)
            stateStore.getState({ characterId, chatId }),
        ]);

        // 2c: recent turns already in sessionContext.recentTurns

        // Record access for retrieved atoms
        if (relevantAtoms.length > 0) {
            await atomStore.recordAccess({ characterId, chatId, atomIds: relevantAtoms.map(a => a.id) });
        }

        return {
            relevantAtoms,
            currentState,
            recentTurns: sessionContext.recentTurns,
        };
    }

    return { retrieve };
}

module.exports = { createCognitiveRetrieval };
```

---

### P2.4 — Reflector

**File to create:** `server/node/llm/reflector.cjs`

The most complex new module. Makes an LLM call that performs fact extraction, contradiction detection, and state delta calculation simultaneously.

```javascript
function createReflector(arg = {}) {
    const executeInternalLLMTextCompletion = arg.executeInternalLLMTextCompletion;
    const validateReflectorOutput = arg.validateReflectorOutput;
    const logError = arg.logError || console.error;

    function buildReflectorPrompt({ userMessage, retrievalResult, sessionContext }) {
        // Builds the full reflector prompt from spec Step 3
        // Include: current AI state, known facts (relevant atoms), recent conversation, user's message
        // Returns messages array for LLM call
    }

    async function reflect({ userMessage, retrievalResult, sessionContext, settings }) {
        let raw = null;
        try {
            raw = await executeInternalLLMTextCompletion({
                provider: settings.provider,
                model: settings.cognitiveArchitecture?.cognitiveModel ?? settings.hypaModel,
                messages: buildReflectorPrompt({ userMessage, retrievalResult, sessionContext }),
                maxTokens: 800,
            });
        } catch (err) {
            logError('[Reflector] LLM call failed:', err.message);
            // Return safe default — pipeline continues with null result
        }

        const { valid, data, errors } = validateReflectorOutput(raw);
        if (!valid) {
            logError('[Reflector] output validation failed:', errors);
        }
        return data; // Always return safe default if invalid
    }

    return { reflect };
}

module.exports = { createReflector };
```

---

### P2.5 — Deterministic State Updater

**File to create:** `server/node/llm/state_updater.cjs`

No LLM calls here. Pure deterministic logic enforcing all business rules from spec Step 4.

```javascript
function createStateUpdater(arg = {}) {
    const atomStore = arg.atomStore;
    const stateStore = arg.stateStore;
    const generateId = arg.generateId;
    const generateEmbeddings = arg.generateEmbeddings;
    const createAtom = arg.createAtom;
    const createGoal = arg.createGoal;
    const logError = arg.logError || console.error;

    // Mood shift lookup table — maps string direction to concrete mood
    const MOOD_SHIFT_MAP = {
        toward_happy: 'happy',
        toward_angry: 'angry',
        toward_sad: 'sad',
        toward_anxious: 'anxious',
        toward_neutral: 'neutral',
    };

    async function applyReflectorResult({ characterId, chatId, reflectorResult, currentState, sourceTurnId, settings }) {
        if (!reflectorResult) return { updatedState: currentState, insertedAtomIds: [] };

        const inertiaThreshold = settings?.cognitiveArchitecture?.moodInertiaThreshold ?? 5;
        const insertedAtomIds = [];

        // 4a: Insert new atoms
        for (const atomDef of (reflectorResult.new_atoms ?? [])) {
            try {
                const atomId = await atomStore.insertAtom({
                    characterId, chatId,
                    content: atomDef.content,
                    category: atomDef.category,
                    subject: atomDef.subject ?? 'user',
                    confidence: Math.min(1, Math.max(0, atomDef.confidence ?? 0.5)),
                    importance: Math.min(1, Math.max(0, atomDef.importance ?? 0.5)),
                    tags: atomDef.tags ?? [],
                    sourceTurnId,
                });
                insertedAtomIds.push(atomId);
            } catch (err) {
                logError('[StateUpdater] failed to insert atom:', err.message);
            }
        }

        // 4b: Contradiction handling — store in unresolvedTensions, do NOT auto-resolve
        const newTensions = (reflectorResult.contradictions ?? []).map(c => ({
            id: generateId(),
            newClaim: c.new_claim,
            existingAtomId: c.existing_atom_id,
            existingClaim: c.existing_claim,
            severity: c.severity,
            detectedAt: Date.now(),
        }));

        // 4c: State mutation with guards
        const deltas = reflectorResult.state_deltas ?? {};
        const newState = { ...currentState };

        // Mood: inertia guard
        if (deltas.mood_shift && deltas.mood_shift !== 'none') {
            if (newState.moodInertia >= inertiaThreshold) {
                const newMood = MOOD_SHIFT_MAP[deltas.mood_shift];
                if (newMood) {
                    newState.mood = newMood;
                    newState.moodIntensity = Math.min(1, Math.max(0, newState.moodIntensity + 0.1));
                    newState.moodInertia = 0;
                }
            }
            // else: dampen — don't change mood, just increment inertia below
        }
        newState.moodInertia = (newState.moodInertia ?? 0) + 1;

        // Relationship score: bounded -100 to 100
        if (typeof deltas.relationship_score_delta === 'number') {
            newState.relationshipScore = Math.min(100, Math.max(-100,
                (newState.relationshipScore ?? 0) + deltas.relationship_score_delta
            ));
        }

        // Trust: asymmetric — trust lost fast, gained slow
        if (typeof deltas.trust_delta === 'number') {
            const delta = deltas.trust_delta;
            const currentTrust = newState.trustLevel ?? 0.5;
            newState.trustLevel = Math.min(1, Math.max(0,
                delta < 0
                    ? currentTrust + delta              // full loss
                    : currentTrust + (delta * 0.5)     // gains halved
            ));
        }

        // User state fields
        if (deltas.perceived_user_mood) newState.perceivedUserMood = deltas.perceived_user_mood;
        if (deltas.engagement_level) newState.engagementLevel = deltas.engagement_level;

        // 4d: Retraction
        if (reflectorResult.retraction_detected && reflectorResult.retraction_target_atom_id) {
            try {
                await atomStore.disputeAtom({ characterId, chatId, atomId: reflectorResult.retraction_target_atom_id });
            } catch (err) {
                logError('[StateUpdater] failed to dispute atom:', err.message);
            }
        }

        // 4e: Goal updates
        const updatedGoals = [...(newState.activeGoals ?? [])];
        for (const update of (reflectorResult.goal_updates ?? [])) {
            const idx = updatedGoals.findIndex(g => g.id === update.goal_id);
            if (idx >= 0) {
                updatedGoals[idx] = { ...updatedGoals[idx], status: update.status, note: update.note, updatedAt: Date.now() };
            }
        }
        newState.activeGoals = updatedGoals;
        newState.unresolvedTensions = [...(newState.unresolvedTensions ?? []), ...newTensions];
        newState.updatedAt = Date.now();

        // Write updated state
        await stateStore.setState({ characterId, chatId, state: newState });

        return { updatedState: newState, insertedAtomIds };
    }

    return { applyReflectorResult };
}

module.exports = { createStateUpdater };
```

---

### P2.6 — Prompt Assembler Extension

**File to modify:** `server/node/llm/prompt.cjs`

Add new template block types for the cognitive context layers. These are injected into the existing `buildMessagesFromPromptTemplate()` alongside the existing blocks.

**New template block types to support:**

| Block name | Content | Priority |
|---|---|---|
| `cognitiveState` | AI's current mood, relationship score, trust, time gap note | 2 (Always) |
| `cognitiveMemory` | Formatted retrieved atoms (bullet points) | 4 (Dynamic) |
| `contradictionAlert` | Flagged contradictions from reflector, if any | 5 (Conditional) |
| `goalDirectives` | Active AI goals (private — do not reveal to user) | 8 (Conditional) |
| `relationshipNarrative` | Compressed relationship story (periodic) | 7 (Periodic) |

**Function to add in prompt.cjs:**

```javascript
function buildCognitiveStateBlock(state, timeGapNote) {
    // Returns system message string with current state formatted
    // Include: mood, moodIntensity, moodInertia, relationshipScore, trustLevel,
    //          perceivedUserMood, engagementLevel, timeGapNote (if any)
}

function buildCognitiveMemoryBlock(atoms) {
    // Returns system message string with retrieved atoms as bullet points
    // Format: "- [category] content (confidence: X)"
    // Skip disputed atoms (is_disputed: true)
}

function buildContradictionBlock(contradictions) {
    // Returns system message string warning the AI of detected contradictions
    // Only include if contradictions array is non-empty
}

function buildGoalDirectivesBlock(activeGoals) {
    // Returns system message with active AI goals
    // Only active goals with status: 'active'
}
```

**Token budget enforcement:** The assembler must track a running token count and skip lower-priority blocks if the budget is exceeded. Use `estimatePromptTokens()` (already exists) after each block addition.

---

### P2.7 — `<Thoughts>` Persistence

**File to modify:** `server/node/llm/execute_route_handler.cjs`

Currently, `<Thoughts>` content is extracted from the stream and discarded. Fix: capture it and include it in the turn log entry.

```javascript
// In the streaming section, after accumulating thoughtsContent:
// Store as: normalizedBody._capturedMonologue = thoughtsContent
// Pass to writeTurnLog() at the end of handleLLMExecutePost
```

---

### P2.8 — Post-Processor Updates

**File to modify:** `server/node/llm/execute_route_handler.cjs`

After the existing `appendLLMAudit()` call, add:

1. Increment `mood_inertia` counter (already done in state updater, skip here)
2. Update `lastInteraction` timestamp
3. Increment `conversationCount` if `isNewSession`
4. Update `lastTopics` (extract from reflector result's atom tags)
5. Append turn log entry via `turnLogStore.appendTurn()`

```javascript
// After existing audit logging:
try {
    await stateStore.patchState({ characterId, chatId, patch: {
        lastInteraction: Date.now(),
        currentSessionId: sessionContext.sessionId,
        conversationCount: sessionContext.isNewSession
            ? (sessionContext.state.conversationCount ?? 0) + 1
            : sessionContext.state.conversationCount,
        lastTopics: extractTopicsFromAtoms(insertedAtomIds), // from reflector result
    }});

    await turnLogStore.appendTurn({
        characterId, chatId,
        sessionId: sessionContext.sessionId,
        role: 'assistant',
        content: sanitizedResponseText,
        turnId: requestId,
        extractedAtomIds: insertedAtomIds,
        aiInternalMonologue: normalizedBody._capturedMonologue ?? null,
        stateSnapshot: updatedState,
    });
} catch (err) {
    logError('[PostProcessor] failed to write turn log or patch state:', err.message);
    // Non-fatal — response already sent
}
```

---

### P2.9 — Orchestration: wire pipeline into generate handler

**File to modify:** `server/node/llm/generate_helpers.cjs` (or a new `server/node/llm/cognitive_pipeline.cjs`)

Create a `runCognitivePipeline()` function that orchestrates Steps 0–4. This function runs before `buildGeneratePromptMessages()` and returns a `CognitiveContext` object that is passed into the prompt assembler.

```javascript
async function runCognitivePipeline({ characterId, chatId, userMessage, settings, character }) {
    // Step 0: Session init
    const sessionContext = await sessionInitializer.initializeSession({ characterId, chatId, settings });

    // Step 1: Context builder
    const plan = await contextBuilder.buildRetrievalPlan({
        userMessage,
        recentTurns: sessionContext.recentTurns,
        settings,
        sessionContext,
    });

    // Step 2: Parallel retrieval
    const retrievalResult = await cognitiveRetrieval.retrieve({ characterId, chatId, plan, sessionContext });

    // Step 3: Reflector
    const reflectorResult = await reflector.reflect({ userMessage, retrievalResult, sessionContext, settings });

    // Step 4: State updater (writes to DB)
    const { updatedState, insertedAtomIds } = await stateUpdater.applyReflectorResult({
        characterId, chatId,
        reflectorResult,
        currentState: retrievalResult.currentState,
        sourceTurnId: generateId(), // will be the turn ID
        settings,
    });

    return {
        sessionContext,
        plan,
        retrievalResult,
        reflectorResult,
        updatedState,
        insertedAtomIds,
    };
}
```

**Integration point in `buildGenerateExecutionPayload()`:**

```javascript
let cognitiveContext = null;
if (isCognitiveArchitectureEnabledForCharacter(settings, character)) {
    try {
        cognitiveContext = await runCognitivePipeline({ characterId, chatId, userMessage, settings, character });
    } catch (err) {
        logError('[CognitivePipeline] pipeline failed, falling back to stateless mode:', err.message);
        cognitiveContext = null; // graceful degradation
    }
}

// Pass cognitiveContext into prompt assembly:
const { messages, promptBlocks } = buildGeneratePromptMessages({ character, chat, settings, userMessage, cognitiveContext });
```

---

### Phase 2 Acceptance Criteria

- [ ] `server/node/llm/session_initializer.cjs` — exported, tested
- [ ] `server/node/llm/context_builder.cjs` — exported, tested. Returns safe default on LLM failure.
- [ ] `server/node/llm/cognitive_retrieval.cjs` — exported, tested. Handles empty atom store gracefully.
- [ ] `server/node/llm/reflector.cjs` — exported, tested. Returns safe default on any failure.
- [ ] `server/node/llm/state_updater.cjs` — exported, unit-tested with all invariants (mood inertia, trust asymmetry, relationship bounds). Never throws.
- [ ] `server/node/llm/prompt.cjs` — new cognitive block builders added, token budget respected
- [ ] `server/node/llm/execute_route_handler.cjs` — `<Thoughts>` persisted, post-processor writes turn log, state patched
- [ ] `server/node/llm/generate_helpers.cjs` — cognitive pipeline wired, feature-flagged, full graceful degradation
- [ ] **Degradation contract:** If the cognitive pipeline throws at any step, the existing HypaV3 pipeline runs as normal. The user never sees an error caused by a cognitive pipeline failure.
- [ ] **Latency test:** Measure p50/p95 latency increase introduced by the 2 extra LLM calls. Document in PR description.
- [ ] Unit tests: `scripts/test-cognitive-pipeline-unit.cjs` — covers state updater invariants, planner safe defaults, reflector safe defaults, feature flag gating
- [ ] Smoke tests: `scripts/test-server-cognitive-pipeline.js` — end-to-end generate call with cognitive pipeline on a test character

---

## Phase 3 — Background Jobs

**Goal:** Implement periodic reflection (spec Step 8) and forgetting/decay (spec Step 9) as scheduled background tasks.

**Depends on:** Phase 2 complete. OQ-5 (scheduling approach) answered.

---

### P3.1 — Reflection Job

**File to create:** `server/node/memory/reflection_job.cjs`

Runs every N messages (default: 15). Performs the "overnight consolidation" described in spec Step 8.

```javascript
function createReflectionJob(arg = {}) {
    const turnLogStore = arg.turnLogStore;
    const atomStore = arg.atomStore;
    const stateStore = arg.stateStore;
    const executeInternalLLMTextCompletion = arg.executeInternalLLMTextCompletion;
    const validateReflectionOutput = arg.validateReflectionOutput;
    const createAtom = arg.createAtom;
    const createGoal = arg.createGoal;
    const generateId = arg.generateId;
    const logError = arg.logError || console.error;

    function buildReflectionPrompt({ recentTurns, currentState, existingOpinions }) {
        // Full reflection prompt from spec Step 8
        // Includes: relationship narrative, existing opinions, recent N turns
    }

    async function runReflection({ characterId, chatId, settings }) {
        const [recentTurns, currentState] = await Promise.all([
            turnLogStore.getRecentTurns({ characterId, chatId, limit: 20 }),
            stateStore.getState({ characterId, chatId }),
        ]);

        if (recentTurns.length < 3) return { skipped: true, reason: 'insufficient turns' };

        const existingOpinions = await atomStore.listAtoms({
            characterId, chatId, category: 'opinion', pageSize: 20, page: 0,
        });

        let raw = null;
        try {
            raw = await executeInternalLLMTextCompletion({
                provider: settings.provider,
                model: settings.cognitiveArchitecture?.cognitiveModel ?? settings.hypaModel,
                messages: buildReflectionPrompt({ recentTurns, currentState, existingOpinions }),
                maxTokens: 1200,
            });
        } catch (err) {
            logError('[ReflectionJob] LLM call failed:', err.message);
            return { ok: false, error: err.message };
        }

        const { data } = validateReflectionOutput(raw);

        // Apply results (all in try/catch — individual failures don't abort the rest)

        // Update relationship narrative
        if (data.updated_narrative) {
            try {
                await stateStore.patchState({ characterId, chatId, patch: {
                    relationshipNarrative: data.updated_narrative,
                }});
            } catch (err) { logError('[ReflectionJob] narrative update failed:', err.message); }
        }

        // Insert new opinion atoms
        for (const opinion of (data.new_opinions ?? [])) {
            try {
                await atomStore.insertAtom({ characterId, chatId, content: opinion.content, category: 'opinion', subject: 'user', confidence: opinion.confidence, importance: opinion.importance });
            } catch (err) { logError('[ReflectionJob] opinion insert failed:', err.message); }
        }

        // Revise existing opinion atoms
        for (const rev of (data.revised_opinions ?? [])) {
            try {
                await atomStore.updateAtom({ characterId, chatId, atomId: rev.existing_atom_id, fields: { content: rev.revised_content, confidence: rev.revised_confidence } });
            } catch (err) { logError('[ReflectionJob] opinion revision failed:', err.message); }
        }

        // New goals
        const newGoalObjects = (data.new_goals ?? []).map(g => createGoal({ id: generateId(), goal: g.goal, priority: g.priority }));
        if (newGoalObjects.length > 0) {
            try {
                await stateStore.patchState({ characterId, chatId, patch: {
                    activeGoals: [...(currentState.activeGoals ?? []), ...newGoalObjects],
                }});
            } catch (err) { logError('[ReflectionJob] goal insert failed:', err.message); }
        }

        // Goal updates
        // ... similar pattern

        // Atom consolidation: mark source atoms as superseded, insert summary atom
        for (const suggestion of (data.consolidation_suggestions ?? [])) {
            try {
                const newAtomId = await atomStore.insertAtom({
                    characterId, chatId,
                    content: suggestion.consolidated_content,
                    category: 'fact',
                    subject: 'user',
                    confidence: 0.8,
                    importance: suggestion.consolidated_importance,
                    supersedes: suggestion.source_atom_ids,
                });
                for (const oldId of suggestion.source_atom_ids) {
                    await atomStore.supersededBy({ characterId, chatId, oldAtomId: oldId, newAtomId });
                }
            } catch (err) { logError('[ReflectionJob] consolidation failed:', err.message); }
        }

        // Deprioritize stale atoms
        for (const atomId of (data.deprioritize_atom_ids ?? [])) {
            try {
                await atomStore.updateAtom({ characterId, chatId, atomId, fields: { importance: 0.1 } });
            } catch (err) { logError('[ReflectionJob] deprioritize failed:', err.message); }
        }

        return { ok: true, trajectory: data.trajectory };
    }

    return { runReflection };
}

module.exports = { createReflectionJob };
```

**Trigger logic in `execute_route_handler.cjs`:** After post-processing, check if reflection should run:

```javascript
// Non-blocking — fire and forget. Do not await.
const shouldReflect = await shouldRunReflection({ characterId, chatId, stateStore, settings });
if (shouldReflect) {
    reflectionJob.runReflection({ characterId, chatId, settings })
        .catch(err => logError('[ReflectionJob] uncaught error:', err.message));
}
```

**`shouldRunReflection` logic:**
- Read `conversationCount` from state
- If `conversationCount % reflectionIntervalMessages === 0` → return true
- Also trigger on `isNewSession` (end of session = start of next)

---

### P3.2 — Forgetting / Decay Job

**File to create:** `server/node/memory/decay_job.cjs`

Scheduled periodic process. Decays, archives, and prunes stale atoms. Must never delete atoms with `importance >= 0.9`.

```javascript
function createDecayJob(arg = {}) {
    const atomStore = arg.atomStore;
    const logError = arg.logError || console.error;

    async function runDecay({ characterId, chatId, settings }) {
        const forgetThreshold = settings?.cognitiveArchitecture?.forgetThreshold ?? 0.15;
        const minAccessCount = settings?.cognitiveArchitecture?.minAccessCountToKeep ?? 2;

        const allAtoms = await atomStore.listAtoms({ characterId, chatId, pageSize: 1000, page: 0 });

        for (const atom of allAtoms) {
            if (atom.importance >= 0.9) continue; // never forget

            const daysSinceAccess = atom.lastAccessed
                ? (Date.now() - atom.lastAccessed) / 86400000
                : (Date.now() - atom.timestamp) / 86400000;

            const decayScore = atom.importance * (1 / (1 + 0.1 * daysSinceAccess));

            if (decayScore < forgetThreshold && atom.accessCount < minAccessCount) {
                try {
                    if (atom.importance < 0.3) {
                        await atomStore.deleteAtom({ characterId, chatId, atomId: atom.id });
                    } else {
                        // Archive: lower importance significantly so it drops out of search results
                        await atomStore.updateAtom({ characterId, chatId, atomId: atom.id, fields: { importance: 0.05, isArchived: true } });
                    }
                } catch (err) {
                    logError('[DecayJob] failed to process atom:', atom.id, err.message);
                }
            }
        }
    }

    return { runDecay };
}

module.exports = { createDecayJob };
```

**Scheduler registration in `server.cjs`:**
```javascript
// Run decay on startup (for missed runs) + every N hours
const DECAY_INTERVAL_MS = (settings?.cognitiveArchitecture?.forgettingIntervalHours ?? 24) * 3600000;
setInterval(async () => {
    // For all active characters/chats — iterate known character directories
    // This requires knowing which characters have cognitive state
    // See OQ-5 for scheduling approach decision
}, DECAY_INTERVAL_MS);
```

**❓ Open sub-question:** The decay job needs to enumerate all (characterId, chatId) pairs that have cognitive state. The state store should provide a `listAllIdentities()` method for this purpose. Add to `state_store.cjs` interface.

---

### Phase 3 Acceptance Criteria

- [ ] `server/node/memory/reflection_job.cjs` — all steps applied, each step individually try/catched, job is idempotent (running twice produces same result)
- [ ] `server/node/memory/decay_job.cjs` — never deletes importance >= 0.9 atoms (invariant tested), archived atoms excluded from search results
- [ ] Reflection trigger checked in `execute_route_handler.cjs` post-processing block. Fire-and-forget, never blocks response.
- [ ] Decay job registered in `server.cjs` with interval. Runs once on startup.
- [ ] Both jobs produce observable audit log entries (extend `appendLLMAudit` or create `appendCognitiveAudit`)
- [ ] Jobs are idempotent — safe to run multiple times without duplicating atoms or goals
- [ ] Unit tests: `scripts/test-memory-jobs-unit.cjs` — reflection output application, decay threshold logic, never-forget invariant
- [ ] Smoke test: `scripts/test-server-memory-jobs.js` — trigger reflection via message-count mechanism, verify audit log entry

---

## Phase 4 — User-Facing Memory Management

**Goal:** Expose memory atoms and cognitive state to users. Add memory inspector UI, explicit memory commands, and privacy controls.

**Depends on:** Phase 1 complete (storage). Phase 2 recommended (atoms being generated).

---

### P4.1 — Memory Profile API Routes

**File to create:** `server/node/routes/memory_profile_routes.cjs`

All routes require `characterId` and `chatId` path parameters. All validate with `isSafePathSegment`.

```
GET    /data/cognitive/atoms?characterId=X&chatId=Y&category=Z&page=0&pageSize=20
       → paginated atom list, grouped by category

GET    /data/cognitive/atoms/:atomId?characterId=X&chatId=Y
       → single atom detail

PATCH  /data/cognitive/atoms/:atomId?characterId=X&chatId=Y
       body: { isDisputed: true } | { importance: 0.1 }
       → mark atom disputed or update importance

DELETE /data/cognitive/atoms/:atomId?characterId=X&chatId=Y
       → hard delete single atom (user-initiated)

GET    /data/cognitive/state?characterId=X&chatId=Y
       → current cognitive state (mood, trust, relationship score, goals, narrative)

POST   /data/cognitive/memory-command?characterId=X&chatId=Y
       body: { command: 'remember' | 'forget' | 'inspect', content?: string }
       → handle explicit memory commands (see P4.2)

DELETE /data/cognitive/wipe?characterId=X&chatId=Y
       → wipe all atoms + state + turn log for this character+chat

GET    /data/cognitive/export?characterId=X&chatId=Y
       → export full memory profile as JSON (atoms + state)
```

All routes must follow the existing pattern in `server/node/routes/storage_routes.cjs`: `isSafePathSegment`, `sendJson`, try/catch, `LLMHttpError`.

---

### P4.2 — Explicit Memory Commands

**File to create:** `server/node/memory/memory_commands.cjs`

Handle the three explicit memory commands from spec Section 4.2.

```javascript
function createMemoryCommands(arg = {}) {
    const atomStore = arg.atomStore;
    const generateId = arg.generateId;
    const createAtom = arg.createAtom;

    // "Remember that I..." → force high-confidence, high-importance atom
    async function handleRememberCommand({ characterId, chatId, content }) {
        return atomStore.insertAtom({
            characterId, chatId,
            content: content.replace(/^remember that\s+/i, ''),
            category: 'fact',
            subject: 'user',
            confidence: 1.0,       // user-asserted = maximum confidence
            importance: 0.8,       // user-asserted = high importance
            tags: ['user-asserted'],
            sourceTurnId: null,
        });
    }

    // "Forget that I..." → find matching atoms and mark disputed
    async function handleForgetCommand({ characterId, chatId, content }) {
        const query = content.replace(/^forget that\s+/i, '');
        const matches = await atomStore.searchAtoms({
            characterId, chatId, queries: [query], limit: 5,
        });
        const disputed = [];
        for (const atom of matches) {
            await atomStore.disputeAtom({ characterId, chatId, atomId: atom.id });
            disputed.push(atom.id);
        }
        return { disputed };
    }

    // "What do you know about me?" → retrieve and summarize all user-subject atoms
    async function handleInspectCommand({ characterId, chatId }) {
        const atoms = await atomStore.listAtoms({
            characterId, chatId, subject: 'user', pageSize: 100, page: 0,
        });
        return { atoms };
    }

    return { handleRememberCommand, handleForgetCommand, handleInspectCommand };
}

module.exports = { createMemoryCommands };
```

**Detection in message processing:** In `buildGenerateExecutionPayload()`, before running the cognitive pipeline, check if `userMessage` starts with a known command prefix. If yes, route to the memory command handler instead of (or before) the reflector.

```javascript
const memoryCommandPrefixes = ['remember that ', 'forget that ', 'what do you know about'];
const isMemoryCommand = memoryCommandPrefixes.some(prefix => userMessage.toLowerCase().startsWith(prefix));
if (isMemoryCommand) {
    commandResult = await memoryCommands.handleCommand({ characterId, chatId, userMessage });
    // Inject result into cognitive context for the AI to reference in its response
}
```

---

### P4.3 — Privacy Controls

**File to modify:** `server/node/routes/memory_profile_routes.cjs`

Add privacy-related endpoints and enforce category-level do-not-store policies.

**Do-not-store policy enforcement:**

Add to character settings (or cognitive architecture settings):
```json
{
  "cognitiveArchitecture": {
    "doNotStoreCategories": ["emotion", "plan"],
    "doNotStoreSubjects": []
  }
}
```

In `state_updater.cjs`, before inserting each new atom:
```javascript
const doNotStore = settings?.cognitiveArchitecture?.doNotStoreCategories ?? [];
if (doNotStore.includes(atomDef.category)) {
    continue; // skip this atom
}
```

**Memory export endpoint:**
- `GET /data/cognitive/export` → returns JSON with: all atoms (excluding embeddings), current state, schema version, export timestamp
- Embeddings excluded from export (too large, not human-readable)

**Memory wipe endpoint:**
- `DELETE /data/cognitive/wipe` → calls `atomStore.deleteAllAtoms()`, `stateStore.deleteState()`, `turnLogStore.deleteAllTurns()`
- Returns count of deleted records

---

### P4.4 — Memory Inspector UI

**Approach:** Based on OQ-4 (migration strategy). If running in parallel with HypaV3, add a new tab to the existing HypaV3 modal or create a new `CognitiveMemoryModal.svelte` component.

**New component:** `src/lib/Others/CognitiveMemoryModal.svelte`

**UI requirements:**
- List atoms grouped by category (fact, preference, plan, emotion, opinion, event)
- Each atom shows: content, confidence (0-1), importance (0-1), timestamp, tags, isDisputed badge
- Actions per atom: "Mark incorrect" (sets `isDisputed: true`), "Delete" (hard delete), edit importance
- Search/filter by category, subject, tags
- Pagination (atoms can be in the thousands)
- "Export memory" button → triggers export endpoint → downloads JSON
- "Wipe memory" button → confirmation dialog → wipe endpoint
- "Add memory" button → opens text field → calls remember command endpoint

**State display section:**
- Show current mood, relationship score, trust level as progress bars / labels
- Show active goals list
- Show relationship narrative (truncated, with expand)
- Read-only (state is managed by the pipeline, not user-editable directly)

---

### Phase 4 Acceptance Criteria

- [ ] `server/node/routes/memory_profile_routes.cjs` — all endpoints implemented, all IDs validated, sendJson used
- [ ] Memory routes registered in `server/node/server_route_bootstrap.cjs`
- [ ] `server/node/memory/memory_commands.cjs` — all three commands implemented
- [ ] Do-not-store policy enforced in state_updater before any atom insert
- [ ] Export endpoint returns valid JSON with all atoms and state
- [ ] Wipe endpoint deletes all three stores for the given characterId+chatId and returns counts
- [ ] `src/lib/Others/CognitiveMemoryModal.svelte` — atom list, category filter, dispute/delete actions, state display, export, wipe
- [ ] Unit tests: `scripts/test-memory-commands-unit.cjs` — remember/forget/inspect commands
- [ ] Smoke tests: `scripts/test-server-memory-profile.js` — all API endpoints

---

## Phase 5 — Testing and Rollout

**Goal:** Make the feature safe to deploy and easy to roll back.

**Depends on:** All previous phases complete.

---

### P5.1 — Contract Tests

**File to create:** `scripts/test-cognitive-contracts-unit.cjs`

Tests that every LLM output consumed by code is validated and safe-defaulted:

- Planner output: missing fields → safe default returned
- Planner output: invalid enum values → stripped/defaulted
- Planner output: malformed JSON → safe default returned, no throw
- Reflector output: out-of-range numerics → clamped to valid range
- Reflector output: unknown atom categories → atom skipped
- Reflector output: malformed JSON → empty result, no throw
- Reflection output: narrative > 500 chars → truncated
- Reflection output: malformed JSON → safe default, no throw

---

### P5.2 — State Guard Tests

**File to create:** `scripts/test-state-guards-unit.cjs`

Tests all deterministic invariants in `state_updater.cjs`:

- Mood does NOT change if `moodInertia < threshold` (test multiple values around threshold)
- Mood DOES change if `moodInertia >= threshold`, and inertia resets to 0
- `moodInertia` always increments by 1 regardless of whether mood changed
- `relationshipScore` never exceeds 100, never goes below -100
- Trust: negative delta applied in full; positive delta halved
- Trust never exceeds 1.0, never goes below 0.0
- `retraction_detected: true` + valid `atomId` → atom marked disputed
- `retraction_detected: true` + invalid `atomId` → no crash

---

### P5.3 — Pipeline Regression Tests

**File to create:** `scripts/test-server-cognitive-regression.js`

End-to-end tests that verify:

- A generate request for a character with `cognitiveArchitecture.enabled: false` produces a response identical to the pre-feature baseline (same prompt structure, no cognitive blocks in prompt)
- A generate request for a character with `cognitiveArchitecture.enabled: true` includes cognitive state blocks in the generated prompt trace
- A reflector failure (simulated by using a broken model) does NOT prevent the main LLM response from being returned
- A state updater failure (simulated by breaking DB write) does NOT prevent the main LLM response
- Turn log is appended after each response for enabled characters

---

### P5.4 — Prompt Regression Test

**File to add:** Check in `server/node/check-server-contracts.cjs` (existing file)

Add assertions that verify the prompt assembler still produces a valid message array after the new cognitive layers are added. Run this as part of the existing check sequence.

---

### P5.5 — Rollout Plan

1. **Deploy with global flag off:** `cognitiveArchitecture.enabled: false` in default settings. The new modules exist but are never called. Existing behavior unchanged for all users.

2. **Internal opt-in:** Enable per-character for test characters in development. Run for N days. Review atom quality, state accuracy, and latency impact.

3. **Document latency:** Measure and publish the p50/p95 added latency from the 2 extra LLM calls. Provide guidance on which fast model to use for `cognitiveModel`.

4. **User opt-in (beta):** Add a toggle in character settings: "Enable cognitive memory (beta)". Users can opt individual characters in. Flag is per-character.

5. **Global default on (future):** After sufficient validation, switch global default to `enabled: true`. Per-character overrides still work.

**Rollback:** Set `cognitiveArchitecture.enabled: false` globally. No data is lost. Atoms and state remain in the DB and will be used again if re-enabled.

---

## PR Slicing

| PR | Title | Phases | Key files |
|---|---|---|---|
| PR1 | `feat: cognitive architecture schemas and validators` | P0 | `memory/schemas.cjs`, `memory/validators.cjs`, `memory/id_utils.cjs`, `memory/feature_flags.cjs`, `memory/session_utils.cjs`, unit tests |
| PR2 | `feat: cognitive storage layer (atom, state, turn log stores)` | P1 | `memory/atom_store.cjs`, `memory/state_store.cjs`, `memory/turn_log_store.cjs`, `memory/db_init.cjs`, `server.cjs` wiring, unit + smoke tests |
| PR3 | `feat: session initializer and context builder` | P2.1, P2.2 | `llm/session_initializer.cjs`, `llm/context_builder.cjs`, unit tests |
| PR4 | `feat: parallel retrieval and reflector` | P2.3, P2.4 | `llm/cognitive_retrieval.cjs`, `llm/reflector.cjs`, unit tests |
| PR5 | `feat: deterministic state updater` | P2.5 | `llm/state_updater.cjs`, state guard unit tests |
| PR6 | `feat: prompt assembler cognitive layers and pipeline orchestration` | P2.6, P2.7, P2.8, P2.9 | `llm/prompt.cjs`, `llm/execute_route_handler.cjs`, `llm/generate_helpers.cjs`, smoke test |
| PR7 | `feat: reflection and decay background jobs` | P3 | `memory/reflection_job.cjs`, `memory/decay_job.cjs`, `server.cjs` scheduler, unit + smoke tests |
| PR8 | `feat: memory profile API routes and memory commands` | P4.1, P4.2, P4.3 | `routes/memory_profile_routes.cjs`, `memory/memory_commands.cjs`, smoke tests |
| PR9 | `feat: cognitive memory inspector UI` | P4.4 | `CognitiveMemoryModal.svelte` |
| PR10 | `feat: cognitive architecture contract tests and rollout flags` | P5 | All test files, check-server-contracts.cjs update, settings schema docs |

---

## Complexity and Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| **Latency regression.** 2 extra LLM calls add significant wait time before user sees a response. | Critical | Decide OQ-2 before Phase 2. Use fast/cheap model for pre-calls. Consider fire-and-forget option (state written for next turn). Instrument latency from day one. |
| **JSON file storage can't handle concurrent cognitive state writes.** Under rapid message sending, two writes to the same state file can race. | Critical | Resolve OQ-1 early. If SQLite is chosen, use WAL mode. If JSON files, add explicit mutex per (characterId, chatId). |
| **Reflector produces invalid JSON.** This will happen. GPT-4o-mini is unreliable at strict JSON. | High | Validators in Phase 0 must be rock-solid. Test with intentionally malformed responses. Never let reflector failure block the main response. |
| **HypaV3 and cognitive pipeline interact in unexpected ways.** Both write to chat data, both affect prompt assembly. | High | Keep the two systems in separate namespaces. HypaV3 writes to `chat.hypaV3Data`. Cognitive pipeline writes to `cognitive.db`. They share the prompt assembler but via different template blocks. |
| **Memory bloat.** Thousands of atoms per character over time. | Medium | Implement Phase 3 (decay job) before allowing long-running use. Monitor atom counts in audit logs. |
| **Prompt injection via atoms.** Malicious user input could create atoms that contain instructions to the AI. | Medium | See spec Section 7 "security controls for memory poisoning". Atoms should be formatted in the prompt with a clear semantic wrapper (bullet points under a labeled section) that reduces their prompt-injection surface. Never interpolate atom content directly into the system prompt without escaping/labeling. |
| **Schema migration for existing characters.** Adding `cognitiveArchitecture` to settings/character schema. | Low | All new schema fields are optional with safe defaults. No existing character data needs to be touched. |
| **Test coverage gaps on background jobs.** Reflection and decay are hard to test deterministically (LLM-dependent). | Medium | Mock the LLM call in unit tests. Test only the application logic (applying the output, not generating it). Smoke tests verify the job runs and produces an audit log entry. |

---

*Document version: 2.0*
*Written: 2026-02-21*
*Status: Awaiting OQ decisions (Section 3) before Phase 0 can begin*
