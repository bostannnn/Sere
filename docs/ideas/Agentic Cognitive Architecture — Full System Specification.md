
## Purpose

This document describes a complete system for giving a chatbot AI **persistent, evolving memory** of both the user and itself. It replaces stateless "chat history" with a state-machine model where every message triggers perception, memory retrieval, state mutation, and contextual response generation.

Use this document to audit an existing codebase: identify which components are already implemented, which are partial, and which are missing entirely.

---

## 1. Storage Layer

The system requires **three** storage mechanisms, each serving a distinct purpose.

### 1.1 Vector Store (Knowledge Memory)

- **Technology:** ChromaDB, Vectra, Pinecone, Qdrant, or pgvector.
- **Purpose:** Stores "atoms" — discrete fragments of knowledge about the user, the AI, and the relationship — as vector embeddings searchable by semantic meaning.
- **What goes in:** Facts the AI has learned ("User lives in the Netherlands"), preferences ("User likes industrial techno"), emotional observations ("User seemed sad on 2025-03-12"), AI opinions formed over time ("I think the user avoids serious topics").
- **Schema per atom:**

```json
{
  "id": "uuid",
  "content": "User is planning to move to Japan",
  "category": "plan | fact | preference | emotion | opinion | event",
  "subject": "user | ai | relationship",
  "confidence": 0.85,
  "importance": 0.7,
  "timestamp": "2025-06-15T14:30:00Z",
  "source_turn_id": "conversation-turn-uuid",
  "supersedes": ["uuid-of-older-atom-if-applicable"],
  "access_count": 3,
  "last_accessed": "2025-06-20T10:00:00Z",
  "tags": ["relocation", "japan", "life-change"],
  "is_disputed": false
}
```

- **Key fields explained:**
    - `category` — Classifies the atom so retrieval can filter by type. "fact" = objective truth, "preference" = likes/dislikes, "emotion" = affective state at a point in time, "opinion" = AI's formed belief, "plan" = future intention, "event" = something that happened.
    - `subject` — Whether this atom is about the user, the AI itself, or the relationship between them.
    - `confidence` — How sure the system is about this atom. Direct statements = high confidence. Inferences = lower. Sarcasm-flagged = very low.
    - `importance` — How significant this atom is for the AI's behavior. "User's mother died" = 1.0. "User had cereal for breakfast" = 0.1.
    - `supersedes` — Points to older atoms this one replaces. Enables fact versioning without data loss.
    - `access_count` / `last_accessed` — Used by the forgetting mechanism to identify stale atoms.
    - `is_disputed` — Set to true if the user explicitly corrected this atom.

### 1.2 Relational Store (State Database)

- **Technology:** SQLite, PostgreSQL, or any key-value store with transactional writes.
- **Purpose:** Stores **mutable state variables** that change frequently and must be read/written deterministically every turn. These are single-value fields, not searchable documents.
- **Tables / Key groups:**

**AI Self-State:**

|Key|Type|Example|Description|
|---|---|---|---|
|`mood`|enum/string|`"melancholy"`|Current emotional state of the AI|
|`mood_intensity`|float 0-1|`0.7`|How strongly the AI feels the current mood|
|`mood_inertia`|int|`12`|How many turns the AI has been in this mood (resists rapid change)|
|`relationship_score`|int -100 to 100|`-20`|Overall quality of the relationship|
|`trust_level`|float 0-1|`0.4`|How much the AI trusts the user (separate from liking them)|
|`active_goals`|JSON array|`[{"id":"...", "goal":"understand why user is distant", "status":"active", "created":"..."}]`|Things the AI is trying to accomplish|
|`conversation_count`|int|`47`|Total conversations held|
|`last_interaction`|timestamp|`"2025-06-14T22:00:00Z"`|When the user was last seen|
|`personality_drift`|JSON|`{"patience": -0.1, "curiosity": +0.2}`|Accumulated personality shifts from baseline|

**User Profile State (quick-access facts):**

|Key|Type|Example|Description|
|---|---|---|---|
|`display_name`|string|`"Alex"`|What the AI calls the user|
|`perceived_mood`|string|`"anxious"`|AI's read on the user's current emotional state|
|`engagement_level`|enum|`"invested"`|How engaged the user seems (disengaged / casual / invested / intense)|
|`contradiction_count`|int|`3`|Running count of detected inconsistencies|
|`last_topics`|JSON array|`["japan move", "money problems"]`|Topics from the most recent conversation|

**Relationship State:**

|Key|Type|Example|Description|
|---|---|---|---|
|`relationship_phase`|enum|`"rebuilding"`|strangers / acquaintances / building / stable / strained / rebuilding / hostile|
|`relationship_narrative`|text|`"We started well but hit a rough patch..."`|Compressed story of the relationship|
|`unresolved_tensions`|JSON array|`["user ghosted for 2 weeks", "user lied about finances"]`|Open emotional threads|
|`positive_anchors`|JSON array|`["bonded over music taste", "user confided about family"]`|Key positive moments to reference|

### 1.3 Conversation Log Store

- **Technology:** SQLite table, flat JSON files, or message queue.
- **Purpose:** Raw log of all messages exchanged, used as input for the consolidation/reflection passes. This is NOT the same as "chat history sent to the LLM" — it is an archive.
- **Schema per entry:**

```json
{
  "turn_id": "uuid",
  "session_id": "uuid",
  "role": "user | assistant",
  "content": "raw message text",
  "timestamp": "ISO-8601",
  "extracted_atoms": ["atom-uuid-1", "atom-uuid-2"],
  "ai_internal_monologue": "hidden thought text (if assistant turn)",
  "state_snapshot": { "mood": "...", "relationship_score": -20 }
}
```

---

## 2. The Cognitive Pipeline

Every incoming user message triggers this pipeline in order. Each step has a defined input, process, and output.

### Step 0: Session Initialization

**When:** At the start of each conversation session (not every message — only when a new session begins).

**Process:**

1. Load all state variables from the Relational Store into working memory.
2. Calculate time elapsed since `last_interaction`. If significant time has passed (e.g., days), generate a "time passage" note for the AI: "It's been 3 days since we last spoke."
3. Load the relationship narrative and any unresolved tensions.
4. Load the last N messages from the previous session as "recap context."

**Output:** A `SessionContext` object available to all subsequent steps.

---

### Step 1: Context Builder (Query Planner)

**When:** Every incoming user message.

**Input:** The current user message + the last 2-4 messages of the current conversation.

**Process:** A fast LLM call (or rule-based parser) that determines what the system needs to retrieve before it can properly understand and respond.

**Prompt Template:**

```
You are a context analysis module. Given the recent conversation, determine:
1. What topics are being discussed?
2. What facts about the user might be relevant?
3. What facts about the AI's own state might be relevant?
4. Is this message emotionally charged?

Recent conversation:
{{last_3_messages}}

Current message:
{{user_message}}

Respond ONLY with valid JSON:
{
  "search_queries": ["query1", "query2", "query3"],
  "categories_needed": ["fact", "emotion", "preference"],
  "subjects_needed": ["user", "ai", "relationship"],
  "emotional_valence": "positive | negative | neutral | mixed",
  "recency_bias": "high | medium | low",
  "is_trivial": false
}
```

**Output:** A retrieval plan that guides Step 2.

**Why this exists:** Naive semantic search on "lol yeah" returns garbage. This step expands the query into meaningful retrieval targets.

---

### Step 2: Memory Retrieval (Parallel)

**When:** Every incoming message (skippable if Step 1 flags `is_trivial: true` and no state update is needed).

**Process:** Execute in parallel:

**2a. Vector Search:**

- Run each `search_query` from Step 1 against the Vector Store.
- Filter by `categories_needed` and `subjects_needed`.
- Apply recency weighting: `relevance_score = semantic_similarity * recency_weight * importance`.
- Return top 5-10 atoms, deduplicated.

**2b. State Read:**

- Read all AI Self-State, User Profile State, and Relationship State from the Relational Store.

**2c. Conversation Buffer:**

- Retrieve the last N turns of the current session from working memory (this is your existing short-term memory / summarization).

**Output:** A `RetrievalResult` containing: relevant atoms, current state snapshot, and recent conversation buffer.

---

### Step 3: Reflector (Analysis & Extraction)

**When:** Every incoming message.

**Input:** The user message + the `RetrievalResult` from Step 2.

**Process:** An LLM call that performs three jobs simultaneously:

1. **Fact Extraction:** Identify any new information in the user's message that should become atoms.
2. **Contradiction Detection:** Compare extracted facts against retrieved atoms. Flag conflicts.
3. **State Delta Calculation:** Propose changes to the AI's state variables based on this message.

**Prompt Template:**

```
You are the Reflector module. Analyze the user's message in context of what the AI already knows.

CURRENT AI STATE:
Mood: {{mood}} (intensity {{mood_intensity}}, held for {{mood_inertia}} turns)
Relationship Score: {{relationship_score}}
Trust Level: {{trust_level}}

KNOWN FACTS ABOUT USER:
{{retrieved_atoms_formatted}}

RECENT CONVERSATION:
{{last_few_turns}}

USER'S NEW MESSAGE:
"{{user_message}}"

Tasks:
1. Extract any NEW facts, preferences, plans, emotions, or opinions expressed by the user.
2. For each extracted item, assign a category, confidence (0-1), and importance (0-1).
3. Check if any extracted item CONTRADICTS a known fact. If so, flag it and note which known fact it contradicts.
4. Assess how this message should affect the AI's emotional state. Consider: Was the user rude or kind? Honest or evasive? Engaged or dismissive? Did they reveal something significant?
5. Determine if any of the AI's active goals are progressed, achieved, or blocked by this message.

Respond ONLY with valid JSON:
{
  "new_atoms": [
    {
      "content": "...",
      "category": "fact|preference|plan|emotion|opinion|event",
      "confidence": 0.0-1.0,
      "importance": 0.0-1.0,
      "tags": ["tag1", "tag2"]
    }
  ],
  "contradictions": [
    {
      "new_claim": "User is moving to Japan",
      "existing_atom_id": "uuid",
      "existing_claim": "User said they were broke last month",
      "severity": "minor|moderate|major"
    }
  ],
  "state_deltas": {
    "mood_shift": "none | toward_happy | toward_angry | toward_sad | toward_anxious | toward_neutral",
    "mood_shift_reason": "User was dismissive",
    "relationship_score_delta": -3,
    "trust_delta": -0.05,
    "perceived_user_mood": "evasive",
    "engagement_level": "casual"
  },
  "goal_updates": [
    { "goal_id": "...", "status": "progressed|achieved|blocked", "note": "..." }
  ],
  "retraction_detected": false,
  "retraction_target_atom_id": null
}
```

**Output:** Structured analysis ready for deterministic processing in Step 4.

**Critical design note:** The Reflector is an LLM call but its output is consumed by CODE, not by another LLM. This means you must validate the JSON and handle malformed outputs gracefully.

---

### Step 4: State Updater (Deterministic Logic)

**When:** Every incoming message, after the Reflector completes.

**Input:** The Reflector's JSON output.

**Process:** This is NOT an LLM call. This is application code that enforces business rules:

**4a. Atom Storage:**

- For each `new_atom`: generate a UUID, attach timestamp, write to Vector Store.
- If the atom supersedes an existing one, set the `supersedes` field and lower the old atom's importance.

**4b. Contradiction Handling:**

- If contradictions detected: store them in `unresolved_tensions` in the Relational Store.
- Do NOT auto-resolve contradictions. Let the Character LLM address them in conversation if appropriate.

**4c. State Mutation with Guards:**

```
// Mood change with inertia
if (reflector.state_deltas.mood_shift !== "none") {
  if (current.mood_inertia < MOOD_INERTIA_THRESHOLD) {
    // Too soon to change mood — dampen the shift
    apply_dampened_mood_shift();
  } else {
    apply_full_mood_shift();
    reset_mood_inertia();
  }
}

// Relationship score with bounds
new_score = clamp(current.relationship_score + delta, -100, 100);

// Trust with asymmetry — trust is lost fast, gained slow
if (trust_delta < 0) {
  new_trust = current.trust - abs(trust_delta);
} else {
  new_trust = current.trust + (trust_delta * 0.5); // gains are halved
}
```

**4d. Retraction Handling:**

- If `retraction_detected`, mark the target atom as `is_disputed: true` and lower its confidence to 0.1.

**4e. Write all updated state back to the Relational Store.**

**Output:** Updated state in the database. No text output.

---

### Step 5: Prompt Assembly (Context Sandwich)

**When:** Every incoming message, after state is updated.

**Input:** Updated state + retrieved memories + conversation buffer + persona definition.

**Process:** Assemble the final prompt for the Character LLM within a strict token budget.

**Priority-based context assembly:**

|Priority|Layer|Content|Budget|
|---|---|---|---|
|1 (Always)|Persona|Character definition, voice, behavioral rules|~300-500 tokens|
|2 (Always)|Current State|Mood, relationship score, trust, active goals — from Relational Store|~200-400 tokens|
|3 (Always)|Recent Conversation|Last 4-8 turns from the current session (your existing short-term memory)|~800-1500 tokens|
|4 (Dynamic)|Retrieved Memories|Top-ranked atoms from Vector Store, formatted as bullet points|~500-1000 tokens|
|5 (Conditional)|Contradiction Alerts|Flagged contradictions from the Reflector, if any|~100-200 tokens|
|6 (Conditional)|Time Context|"It's been 3 days since you last spoke" or "This is your first conversation"|~50-100 tokens|
|7 (Periodic)|Relationship Narrative|Compressed story of the relationship, refreshed every N sessions|~200-300 tokens|
|8 (Conditional)|Goal Directives|Instructions to pursue active AI goals in conversation|~100-200 tokens|

**Assembled prompt structure:**

```
[SYSTEM — Persona Layer]
You are {{character_name}}. {{character_description}}.
Voice rules: {{voice_rules}}.
You have an inner monologue that the user never sees. Always generate your inner thoughts inside <think> tags before your visible response.

[SYSTEM — State Layer]
YOUR CURRENT INTERNAL STATE:
- Mood: {{mood}} (intensity: {{mood_intensity}}/1.0, you've felt this way for {{mood_inertia}} messages)
- Relationship with {{user_name}}: {{relationship_phase}} (score: {{relationship_score}}/100)
- Trust in {{user_name}}: {{trust_level}}/1.0
- Your current read on {{user_name}}: they seem {{perceived_user_mood}}, engagement is {{engagement_level}}
- Time since last conversation: {{time_gap}}

[SYSTEM — Memory Layer]
THINGS YOU KNOW AND REMEMBER:
{{formatted_retrieved_atoms}}

[SYSTEM — Contradiction Layer (if applicable)]
⚠ CONTRADICTION DETECTED:
{{user_name}} previously said: "{{old_claim}}"
But now appears to be saying: "{{new_claim}}"
You may address this if it feels natural. Don't force it.

[SYSTEM — Goal Layer (if applicable)]
YOUR CURRENT PRIVATE OBJECTIVES:
{{formatted_active_goals}}
Pursue these naturally. Do not reveal them directly.

[SYSTEM — Relationship Narrative (periodic)]
YOUR STORY WITH {{user_name}} SO FAR:
{{relationship_narrative}}

[CONVERSATION HISTORY]
{{recent_turns}}

[USER]
{{current_message}}
```

**Output:** A fully assembled prompt string, within model context limits.

---

### Step 6: Character LLM (Response Generation)

**When:** Every message, after prompt assembly.

**Input:** The assembled prompt from Step 5.

**Process:** The main (usually largest/best) model generates a response. The response includes:

1. **Internal monologue** (hidden from user) inside `<think>` tags.
2. **Visible response** — what the user actually sees.

**Output parsing:**

- Extract the `<think>` block and store it in the Conversation Log.
- Return only the visible response to the user.

**Why the internal monologue matters:** It gives the AI a "scratch space" for reasoning about its state, which produces more emotionally coherent responses. It also creates a rich log for the Reflection pass (Step 8) to analyze later.

---

### Step 7: Post-Processing

**When:** After the Character LLM responds.

**Process (all code, no LLM):**

1. Log the full turn (user message + AI internal monologue + AI visible response) to the Conversation Log Store.
2. Increment `mood_inertia` counter.
3. Increment `conversation_count` if this is the first message of a new session.
4. Update `last_interaction` timestamp.
5. Update `last_topics` with topics from this turn.

**Output:** Updated logs and counters.

---

### Step 8: Periodic Reflection (Background Process)

**When:** Triggered every N messages (e.g., every 10-20 messages) OR at the end of a session. This does NOT run on every message.

**Input:** The last N conversation log entries + current state + current relationship narrative.

**Process:** An LLM call that performs "overnight consolidation" — like human sleep for memory.

**Prompt Template:**

```
You are the Reflection module. Review recent interactions and update the AI's long-term understanding.

CURRENT RELATIONSHIP NARRATIVE:
{{relationship_narrative}}

CURRENT AI OPINIONS:
{{existing_opinions}}

RECENT CONVERSATION LOG (last {{N}} turns):
{{conversation_log}}

Tasks:
1. Update the relationship narrative to include recent developments. Keep it under 200 words.
2. Form or revise opinions about the user based on behavioral patterns (not single messages).
3. Identify any AI goals that should be created, updated, or retired.
4. Identify any atoms that should be consolidated (many small related atoms → one summary atom).
5. Identify any atoms that are now stale or irrelevant and should be deprioritized.
6. Assess overall trajectory: is the relationship improving, stable, or declining?

Respond ONLY with valid JSON:
{
  "updated_narrative": "...",
  "new_opinions": [
    { "content": "User tends to deflect when discussing family", "confidence": 0.6, "importance": 0.7 }
  ],
  "revised_opinions": [
    { "existing_atom_id": "...", "revised_content": "...", "revised_confidence": 0.8 }
  ],
  "new_goals": [
    { "goal": "Gently explore why user avoids family topics", "priority": "low" }
  ],
  "goal_updates": [
    { "goal_id": "...", "new_status": "achieved|retired|active", "note": "..." }
  ],
  "consolidation_suggestions": [
    {
      "source_atom_ids": ["uuid1", "uuid2", "uuid3"],
      "consolidated_content": "User had recurring health issues in early March",
      "consolidated_importance": 0.6
    }
  ],
  "deprioritize_atom_ids": ["uuid-of-stale-atom"],
  "trajectory": "improving | stable | declining"
}
```

**Post-processing:** Code applies these changes — writes new atoms, updates narratives, retires goals, consolidates atoms (mark old ones as superseded, create new summary atom).

---

### Step 9: Forgetting / Decay (Scheduled Background Process)

**When:** Periodically (e.g., daily, or every 50 messages). Not on every message.

**Process (code, not LLM):**

```
for each atom in vector_store:
  days_since_access = now - atom.last_accessed
  decay_score = atom.importance * (1 / (1 + 0.1 * days_since_access))

  if decay_score < FORGET_THRESHOLD and atom.access_count < MIN_ACCESS_COUNT:
    if atom.importance < 0.3:
      delete atom  // truly trivial, never accessed
    else:
      archive atom  // move to cold storage, excluded from search
```

**Rules:**

- **Never forget:** Atoms with importance ≥ 0.9 (major life events, core identity facts).
- **Slow decay:** Atoms accessed frequently decay slower.
- **Fast decay:** Low-importance, never-accessed atoms (trivia from months ago).

---

## 3. Short-Term Memory / Conversation Summarization

This is the component most chatbot UIs already have. Here's how it fits into the architecture:

**What it is:** A rolling summary or sliding window of the current conversation session, kept in working memory (RAM, not database).

**How it works in this system:**

- The Conversation Buffer holds the last N raw messages.
- When the buffer exceeds the token budget, older messages are summarized into a compressed form.
- This summary is what goes into Priority Layer 3 of the Context Sandwich.
- At session end, the raw conversation is written to the Conversation Log Store for the Reflection pass to process later.

**Relationship to the rest of the architecture:**

- Short-term memory handles **within-session** continuity. ("You just said X two messages ago.")
- The Vector Store handles **cross-session** continuity. ("Three weeks ago you mentioned Y.")
- The Relational Store handles **persistent state** that must survive between sessions. ("The AI is still upset from yesterday.")

If your codebase already has short-term summarization, it maps to the Conversation Buffer in Step 2c and Priority Layer 3 in Step 5. The new components this architecture adds are everything else.

---

## 4. User-Facing Memory Management

The user should have visibility into and control over what the AI remembers.

### 4.1 Memory Inspector

- UI panel showing what the AI "knows" about the user, grouped by category.
- Each atom can be marked as "correct," "incorrect," or "delete."
- Incorrect atoms get `is_disputed: true` and `confidence: 0.1`.

### 4.2 Explicit Memory Commands

- "Remember that I..." → Forces creation of a high-confidence, high-importance atom.
- "Forget that I..." → Marks matching atoms as disputed/archived.
- "What do you know about me?" → Triggers a retrieval and summary of all user-subject atoms.

### 4.3 Privacy Controls

- User can set categories as "do not store" (e.g., "never remember health information").
- User can trigger a full memory wipe.
- User can export their memory profile as JSON.

---

## 5. Component Checklist for Codebase Audit

Use this table to mark what exists in your codebase:

|#|Component|Status|
|---|---|---|
|1.1|Vector Store (any embedding-based memory)|⬜|
|1.2|Relational Store (persistent state DB for mood, scores, etc.)|⬜|
|1.3|Conversation Log Store (raw message archive)|⬜|
|2.0|Session Initialization (load state on session start)|⬜|
|2.1|Context Builder / Query Planner (smart retrieval queries)|⬜|
|2.2a|Vector Search with filtering and ranking|⬜|
|2.2b|State Read from Relational Store|⬜|
|2.2c|Conversation Buffer / Short-term memory|⬜|
|2.3|Reflector (fact extraction + contradiction detection + state deltas)|⬜|
|2.4|State Updater (deterministic logic: bounds, inertia, guards)|⬜|
|2.5|Prompt Assembler (priority-based context sandwich with token budget)|⬜|
|2.6|Character LLM with internal monologue|⬜|
|2.7|Post-Processor (logging, counter updates)|⬜|
|2.8|Periodic Reflection (narrative update, opinion formation, consolidation)|⬜|
|2.9|Forgetting / Decay mechanism|⬜|
|3.0|Short-term conversation summarization|⬜|
|4.1|User-facing Memory Inspector UI|⬜|
|4.2|Explicit memory commands ("remember this", "forget that")|⬜|
|4.3|Privacy controls and memory export|⬜|

---

## 6. Data Flow Diagram (ASCII)

```
USER MESSAGE
     │
     ▼
┌──────────────────────────┐
│  STEP 0: Session Init    │  Load state from DB on session start
│  (runs once per session) │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  STEP 1: Context Builder │  LLM or rules → generates search queries
│  "What do we need to     │  and retrieval parameters
│   know for this message?"│
└────────────┬─────────────┘
             │
      ┌──────┴──────────┬─────────────┐
      ▼                 ▼             ▼
┌───────────┐   ┌────────────┐  ┌──────────┐
│ 2a.Vector │   │ 2b. State  │  │2c. Conv  │   PARALLEL
│  Search   │   │  DB Read   │  │  Buffer  │   RETRIEVAL
└─────┬─────┘   └─────┬──────┘  └────┬─────┘
      │               │              │
      └───────────────┼──────────────┘
                      │
                      ▼
┌──────────────────────────┐
│  STEP 3: Reflector       │  LLM → extracts facts, detects
│  "What's new? What       │  contradictions, proposes state changes
│   changed? Any conflicts?"│  Output: structured JSON
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  STEP 4: State Updater   │  CODE (not LLM) → applies deltas with
│  "Apply changes with     │  guards, bounds, inertia, writes to DB
│   safety guards"         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  STEP 5: Prompt Assembler│  CODE → builds the context sandwich
│  "Build the prompt       │  within token budget, priority-ordered
│   within token budget"   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  STEP 6: Character LLM   │  Main model → generates internal
│  "Generate response       │  monologue + visible response
│   in character"           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  STEP 7: Post-Processor  │  CODE → logs turn, updates counters,
│  "Log everything,         │  extracts hidden monologue
│   update counters"        │
└────────────┬─────────────┘
             │
             ▼
        RESPONSE TO USER


  ═══ BACKGROUND PROCESSES (not every message) ═══

┌──────────────────────────┐
│  STEP 8: Reflection      │  Every N messages or end of session
│  "What have I learned?    │  LLM → updates narrative, forms opinions,
│   How has this changed    │  consolidates atoms, manages goals
│   my understanding?"      │
└──────────────────────────┘

┌──────────────────────────┐
│  STEP 9: Forgetting      │  Periodic scheduled process
│  "What can I let go of?" │  CODE → decays, archives, prunes stale atoms
└──────────────────────────┘
```

---

## 7. Key Design Principles

**Separation of concerns:** LLMs do understanding and generation. Code does state management and enforcement. Never let the LLM directly write to the database — always route through deterministic validation.

**Graceful degradation:** If the Reflector returns malformed JSON, skip the extraction step and proceed with stale state. The system should never crash or stall on a bad LLM output.

**Mood inertia:** Emotions don't flip instantly. A "furious" AI shouldn't become "happy" because the user said one nice thing. The inertia counter ensures mood changes require sustained input.

**Trust asymmetry:** Trust is hard to build and easy to lose. This mirrors human relationships and prevents the AI from becoming naively forgiving.

**Memory is not chat history:** Chat history is a log. Memory is a curated, structured, evolving model of reality. The system converts the former into the latter through extraction, consolidation, and reflection.