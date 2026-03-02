# Memory System V1 Plan (No Vectors Required)

Last updated: 2026-02-07

## 1) Goal
Build a memory system that is:
- reliable and debuggable,
- token-efficient,
- emotionally coherent,
- usable without vector search.

This plan uses deterministic and lexical retrieval first. Vectors are optional later.

## 2) Memory Layers

### Layer 1: Facts
Purpose:
- stable user facts/preferences.

Examples:
- likes sci-fi
- hates fish
- works night shifts

Storage shape:
- `id`
- `key`
- `value`
- `confidence` (0-1)
- `source_ref` (where learned)
- `last_confirmed_at`
- `expires_at` (optional)

Notes:
- facts are high-priority and cheap to inject.
- stale low-confidence facts should decay or require reconfirmation.

---

### Layer 2: Episodes
Purpose:
- meaningful interaction events.

Examples:
- argued about politics, tension high.
- user shared career anxiety, requested practical advice.

Storage shape:
- `id`
- `summary` (1-2 lines)
- `time_range`
- `emotion_tags` (e.g. conflict, joy, fear)
- `importance` (1-10)
- `participants`
- `source_refs` (message ids)

Notes:
- this is not raw transcript storage.
- episodes are compact narrative units.

---

### Layer 3: Relationship Markers
Purpose:
- track state transitions in relationship quality.

Examples:
- trust increased after successful support.
- boundary set: avoid late-night proactive pings.
- repair event after misunderstanding.

Storage shape:
- `id`
- `marker_type` (trust_up, trust_down, boundary, repair, consent_change)
- `description`
- `weight` (positive/negative magnitude)
- `effective_from`
- `expires_at` (optional)

Notes:
- these markers directly affect dynamic state and action policy.

---

### Layer 4: Summaries (Long-Term Compressed Memory)
Purpose:
- compressed long-term narrative.

Examples:
- weekly summary of recurring topics and emotional trends.

Storage shape:
- `id`
- `period` (daily/weekly)
- `narrative_summary`
- `themes`
- `open_threads`
- `salient_memories` (references)

Notes:
- this is the main long-term layer for prompt injection.
- similar role to Hypa-style memory summaries.

---

### Layer 5: Raw Logs (Fallback Source)
Purpose:
- immutable audit/source of truth.

Usage:
- never injected directly by default.
- used only when Layers 1-4 retrieval is weak.

Storage shape:
- full message history with message id, role, content, timestamp, and metadata.

## 3) Retrieval Strategy (No Vector Baseline)

### 3.1 Retrieval Order
1. Facts lookup (exact key/keyword match + aliases)
2. Relationship markers (policy-affecting markers always checked)
3. Episode lexical search (BM25/FTS)
4. Summary lexical search (BM25/FTS)
5. Raw logs fallback (if confidence is too low)

### 3.2 Ranking Formula (Simple)
For episodes/summaries:

`score = lexical_relevance * 0.5 + recency * 0.2 + emotional_weight * 0.2 + importance * 0.1`

For facts:
- prioritize by confidence, freshness, and direct relevance.

For relationship markers:
- always include relevant active markers, regardless of lexical score.

### 3.3 Weak Retrieval Rule
If top result score is below threshold:
- run Layer 5 fallback search,
- extract 2-5 relevant snippets,
- compress into a temporary episode summary,
- optionally persist that as a new episode if valid.

## 4) Injection Policy (Token Budget Control)

Never inject full memory stores.

Per response memory budget:
- default: 15-25% of available context window.

Suggested packing order:
1. Facts: max 3-6 short bullets
2. Relationship markers: max 1-3 bullets
3. Episodes: max 2-4 bullets
4. Summaries: max 1-2 compact blocks

Hard rules:
- no raw transcript dumps unless user explicitly asks.
- if over budget, drop oldest/lowest score first.

## 5) Pre-Main-LLM Pipeline

This pipeline runs before main generation:

1. Input parser:
- parse user intent, emotion hints, and topic keywords.

2. Memory retriever:
- retrieve from Layers 1-4.

3. Confidence evaluator:
- if weak, trigger Layer 5 fallback.

4. Memory compressor:
- format selected memories into concise packet.
- can be template-based or small-LLM-assisted.

5. Prompt assembler:
- inject static profile + dynamic state + memory packet + current chat slice.

6. Main LLM generation:
- generate final response.

7. Post-turn memory writer:
- propose and save new fact/episode/marker updates.

## 6) When to Use a Small LLM

Small LLM is optional and should be used for:
- deduplication/normalization of candidate memories,
- converting raw snippets into compact episodes,
- summarizing daily logs.

Small LLM should not be required for:
- exact fact lookup,
- lexical retrieval,
- policy gates.

If small LLM fails:
- fallback to deterministic template compression.

## 7) Write Path Rules

After each message:
1. Fact candidate extraction:
- detect stable claims/preferences.
- update confidence, do not duplicate.

2. Episode candidate extraction:
- only if interaction is meaningful enough (importance threshold).

3. Relationship marker updates:
- create markers for trust shifts, repairs, boundary changes.

4. Daily consolidation:
- compress low-salience older episodes into summaries.
- keep high-salience episodes intact.

## 8) Why This Avoids Common Vector Problems
- deterministic behavior for explicit facts.
- lexical retrieval is easier to inspect and debug.
- lower hallucination risk from unrelated semantic neighbors.
- predictable token usage.
- graceful fallback from raw logs when needed.

## 9) Observability and Debug Output

For each response store debug metadata:
- retrieval query terms,
- selected memory IDs by layer,
- scores and cutoff threshold,
- fallback used or not,
- final injected memory packet length/tokens.

This makes memory behavior explainable.

## 10) V1 Defaults (Suggested)
- memory packet cap: 600-1200 tokens.
- facts cap: 6 bullets.
- relationship markers cap: 3 bullets.
- episodes cap: 4 bullets.
- summaries cap: 2 blocks.
- fallback trigger: if top lexical score < 0.35.
- daily consolidation: once every 24h.

Tune after real usage.

## 11) Optional V2 (Hybrid)
Only after V1 is stable:
- keep Layers 1-3 deterministic,
- add vector retrieval for Layers 2/4 as secondary candidate generator,
- still apply lexical + policy reranking before injection.

Vectors should assist retrieval, not own decision authority.

## 12) Technical Execution Schema

### 12.1 Do You Need a Stack to Run Test Templates?
Yes, for full automated execution.

But there are 3 modes:
1. Paper mode (no stack):
- run as a checklist and verify expected behavior manually.

2. Simulated mode (minimal scripts):
- run parser/retrieval/rule engine scripts with mock memory files.
- optionally stub LLM responses.

3. Live mode (full stack):
- actual scripts + data store + LLM calls + persistent logs.
- required for real reliability testing.

### 12.2 Minimal Runtime Components (V1)
Required:
- ingestion script,
- memory store (DB or JSON-backed repository),
- lexical retrieval engine (BM25/FTS),
- rule-based policy engine,
- main LLM caller,
- post-turn memory writer,
- scheduled daily consolidation job.

Optional:
- small LLM for candidate compression/normalization.

### 12.3 Stage-by-Stage Pipeline (Who Does What)

1. `ingest_event` (local script)
- input: raw message + metadata.
- output: normalized event object.

2. `retrieve_memory` (local script)
- input: event object.
- action: query Layers 1-4 using exact + lexical search.
- fallback: query Layer 5 if weak result.
- output: ranked memory candidates.

3. `compress_memory_packet` (local script or small LLM)
- input: candidates.
- action: deduplicate, trim, budget-pack.
- output: prompt memory packet.

4. `update_dynamic_state` (local script, optional small LLM classifier)
- input: event + current dynamic state + selected memories.
- output: state patch (mood, battery, trust deltas, focus, cooldown hints).

5. `decide_action` (rule engine first, optional LLM tiebreaker)
- input: event + dynamic state + policy gates.
- output: structured action decision.

6. `generate_response` (main LLM, only for outward actions)
- input: static profile + dynamic state + memory packet + recent chat + decision constraints.
- output: assistant message.

7. `write_memory_updates` (local script)
- input: event + decision + model output + state patch.
- output: persisted facts/episodes/markers + audit record.

8. `daily_reflection_job` (scheduled script, optional small LLM)
- compresses older low-salience episodes into summaries.

### 12.4 LLM Prompt Boundaries
Main LLM prompt should include:
- static system excerpt,
- current dynamic state snapshot,
- compact memory packet,
- recent chat turns,
- action constraints.

Small LLM prompt (optional) should include:
- candidate memories only,
- strict formatting instruction for concise normalized output.

### 12.5 JSON Contracts (Example)

`event_object`:
```json
{
  "event_id": "evt_001",
  "message_id": "msg_1002",
  "user_id": "u_1",
  "chat_id": "c_9",
  "content": "I got fired today.",
  "event_at": "2026-02-07T09:12:00Z",
  "local_time_context": "work_hours"
}
```

`retrieval_result`:
```json
{
  "query_terms": ["fired", "job", "work"],
  "facts": [{"id": "fact_7", "score": 0.82}],
  "markers": [{"id": "marker_11", "score": 1.0}],
  "episodes": [{"id": "ep_55", "score": 0.64}],
  "summaries": [{"id": "sum_3", "score": 0.41}],
  "fallback_used": false
}
```

`decision_result`:
```json
{
  "action": "RESPOND",
  "reason": "High emotional priority and direct disclosure.",
  "confidence": 0.91,
  "policy_checks": {
    "quiet_hours_ok": true,
    "cooldown_ok": true,
    "consent_ok": true,
    "manipulation_guard_ok": true
  },
  "state_updates": {
    "mood": "grounded",
    "current_focus": "job_loss_support"
  },
  "memory_updates": {
    "facts": [{"key": "employment_status", "value": "unemployed", "confidence": 0.7}],
    "episodes": [{"summary": "User reported being fired; high emotional impact.", "importance": 9}],
    "markers": []
  }
}
```

### 12.6 Worked Event Examples

Example A: User says “I got fired today.”
1. Ingestion:
- capture event with timestamp.
2. Retrieval:
- find work-related facts and prior stress episodes.
3. Dynamic update:
- raise emotional intensity, set focus to support/stability.
4. Decision:
- `RESPOND` (+ optional gentle `FOLLOW_UP`).
5. Response generation:
- calm, validating, practical next-step framing.
6. Memory writes:
- update employment fact,
- write high-importance episode,
- record any new boundary if user sets one.

Example B: No memory found in Layers 1-4
1. Retrieval confidence below threshold.
2. Layer 5 raw log search runs.
3. Extract top snippets, compress to temporary episode summary.
4. Continue pipeline with compressed packet.
5. If still weak confidence, default to neutral response and ask clarifying follow-up.

### 12.7 Test Template Execution Path
For each test case:
1. load initial static + dynamic state snapshot,
2. send test event to `ingest_event`,
3. run full pipeline,
4. assert:
- chosen action,
- policy gate outcomes,
- memory writes,
- token budget compliance,
- prohibited outputs absent.
