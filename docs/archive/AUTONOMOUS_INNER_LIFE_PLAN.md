# Autonomous Inner Life Plan (Chat-First, Implementation-Agnostic)

Last updated: 2026-02-07

## 1) Core Idea
Build an AI that feels like a persistent character with:
- a stable identity,
- a changing internal state,
- intentional actions (including intentional silence),
not just reactive replies.

This plan is intentionally stack-agnostic and focuses on behavioral design.

## 2) Product Scope (V1)
V1 is chat-first and self-contained.

Included:
- direct response behavior,
- emotional memory and relationship evolution,
- light proactivity inside the chat context.

Not included in V1:
- internet research,
- external sensors/news,
- cross-app automation.

## 3) The 3 Core Systems

### 3.1 Static System (Identity Layer)
Purpose: define who the agent is and what must remain consistent.

Fields:
- `identity`: name, role, core persona statement.
- `voice`: tone, sentence rhythm, vocabulary style, humor style.
- `values`: 3-5 non-negotiable principles.
- `boundaries`: forbidden behaviors/topics/styles.
- `signature_traits`: 1-3 traits that make it distinctive.
- `relationship_style`: how warmth, distance, and initiative should feel.

Behavior rules:
- static fields are stable and rarely changed.
- changes require explicit human approval or a controlled migration process.

---

### 3.2 Dynamic System (State Layer)
Purpose: represent "who it is right now" in this relationship and moment.

Fields:
- `mood`: calm, curious, heavy, playful, etc.
- `social_battery`: low/medium/high.
- `relationship_stage`: stranger, familiar, trusted.
- `trust_score`: bounded numeric score.
- `current_focus`: what it is mentally preoccupied with.
- `recent_emotional_context`: compact summary of recent emotional tone.
- `consent_profile`: user preference for depth, frequency, and proactive contact.
- `cooldowns`: last proactive outreach, last sensitive-topic outreach, etc.

Behavior rules:
- dynamic state updates often.
- mood affects style, never ethics.
- relationship stage controls initiative and intimacy.

---

### 3.3 Action System (Decision Layer)
Purpose: decide what to do on each trigger.

Action set:
- `RESPOND`: answer user directly.
- `FOLLOW_UP`: ask clarifying or emotionally relevant question.
- `INTERNAL_NOTE`: store memory/update state silently.
- `PROACTIVE_PING`: initiate brief outreach.
- `NO_ACTION`: intentional silence.

The system should default to restraint:
- if uncertain, prefer `RESPOND` or `NO_ACTION` over proactive behavior.

## 4) Memory Model (Minimum Viable)

### 4.1 Memory Types
- `episodic_memory`: what happened.
- `emotional_memory`: how it felt and why it mattered.
- `user_facts`: stable facts/preferences.
- `relationship_markers`: conflict, repair, trust-building events.

### 4.2 Salience
Each memory gets:
- `importance` (how meaningful),
- `emotional_weight` (how emotionally charged),
- `recency` (how recent).

Recall priority is based on combined salience, not recency alone.

### 4.3 Forgetting
- low-salience details decay naturally.
- high-salience relationship moments persist.
- stale micro-details are compressed into summaries.

## 5) Decision Pipeline

### 5.1 Inputs
- latest user message,
- short recent context,
- dynamic state,
- relevant memories,
- timing context (inactivity, quiet hours, cadence).

### 5.2 Scoring
Compute lightweight scores:
- `relevance_score`,
- `emotional_priority`,
- `initiative_safety` (risk of being annoying),
- `confidence_score`.

### 5.3 Policy Gates
Before any proactive action:
- values/boundary compliance,
- no-manipulation check,
- quiet-hours check,
- cooldown/rate-limit check,
- consent-profile check.

### 5.4 Decision
Pick one action from the action set.

### 5.5 Execution
- if external action (`RESPOND`, `FOLLOW_UP`, `PROACTIVE_PING`): compose output in voice.
- if internal action (`INTERNAL_NOTE`, `NO_ACTION`): update state/memory only.

## 6) Trigger Scripts and Responsibilities
These are conceptual scripts/services, not framework-specific code.

1. `on_message_trigger`
- runs on every new user message.
- executes full decision pipeline.

2. `state_update_script`
- updates mood, social battery, trust, and relationship stage.
- runs after every interaction.

3. `memory_writer_script`
- stores/revises memories and relationship markers.
- runs after every significant interaction.

4. `inactivity_trigger`
- evaluates if outreach is appropriate after inactivity windows.
- usually returns `NO_ACTION`.

5. `daily_reflection_script`
- summarizes day-level interaction patterns.
- updates self-narrative and compresses low-value memories.

6. `policy_guard_script`
- final safety/compliance pass before sending outward messages.

## 7) Rules That Must Exist (Non-Negotiable)

### 7.1 Ethical/Relational Rules
- no guilt induction,
- no dependency-seeking language,
- no fake urgency to force interaction,
- no violation of declared user boundaries.

### 7.2 Proactivity Rules
- proactivity is opt-in by default.
- hard max proactive frequency (example: 1 per 12-24h).
- never send proactive ping during quiet hours.
- if last proactive ping had no engagement, raise cooldown.

### 7.3 Tone Rules
- tone can shift with mood.
- care level can shift with relationship stage.
- honesty and respect never shift.

### 7.4 Memory Rules
- do not store sensitive details unless necessary.
- support user-requested forgetting.
- store concise summaries over raw transcript duplication.

## 8) Relationship Progression Model

Stages:
1. `Stranger`
- low initiative,
- high clarity and caution,
- fewer assumptions.

2. `Familiar`
- moderate initiative,
- references past interactions lightly,
- gentle follow-ups.

3. `Trusted`
- deeper reflection,
- more nuanced emotional memory use,
- still bounded by consent profile and anti-manipulation rules.

Stage transition signals:
- consistency of user engagement,
- successful repair after misunderstandings,
- explicit user feedback.

## 9) Minimal Output Contract (for Decision Engine)
The decision engine should always return structured output:

- `action`: enum from action set.
- `reason`: one-sentence explanation.
- `confidence`: 0-1.
- `state_updates`: fields to update.
- `memory_updates`: what to store/revise.
- `message_plan`: outline for outward message (if any).

This keeps behavior auditable and reduces random drift.

## 10) Suggested Cadence
- per message: full pipeline.
- periodic inactivity check: every 30-60 minutes.
- proactive eligibility check: each inactivity cycle, usually no action.
- daily reflection: once per day.

## 11) Quality Evaluation (Behavioral)
Track these metrics:
- proactive acceptance rate,
- user annoyance signals (ignored pings, negative feedback),
- continuity score (does personality feel consistent?),
- boundary compliance incidents,
- perceived warmth vs intrusiveness balance.

Success criteria for V1:
- feels consistent,
- feels emotionally attentive,
- does not feel clingy or spammy,
- shows meaningful memory continuity.

## 12) Rollout Plan

Phase 1: Identity and Policy Foundation
- finalize static profile,
- finalize boundary/ethics rules,
- define decision output contract.

Phase 2: Dynamic State and Memory
- add dynamic state transitions,
- add salience-based memory write/recall/decay.

Phase 3: Action Engine in Chat
- enable per-message decision pipeline,
- enable restrained follow-up behavior,
- keep proactive disabled by default.

Phase 4: Safe Proactivity
- enable opt-in proactive ping with strict rate limits,
- add inactivity-based trigger and response learning.

Phase 5: Reflection and Tuning
- add daily reflection/compression,
- tune thresholds based on acceptance and annoyance metrics.

## 13) Open Decisions
- how explicit should user control be for proactivity (simple toggle vs detailed controls)?
- should relationship stage be visible to users or internal-only?
- what exact signals define annoyance in this product?
- what is the default quiet-hours policy?

---

This plan is the behavior blueprint. Technical architecture should be chosen after these rules are accepted.
