# Character Evolution Retention Implementation Spec

This document turns the retention remediation plan into an implementation-ready engineering spec.

It covers:

- subsystem checklist
- settings schema and API shapes
- version-management endpoints and UI actions
- test plan

It assumes the product decisions captured in:

- `/Users/andrewbostan/Documents/RisuAII/docs/planning-artifacts/character-evolution-retention-remediation-plan.md`

## Implementation Status

Implemented:

- retention settings types/defaults/normalization
- retention settings UI
- non-active decay/deletion and stored caps
- duplicate/refinement tightening
- prompt-side compact rendering
- malformed-JSON retry during accept flow
- version mutation endpoints and UI previews/actions
- next-handoff retention preview route and bulk dry-run CLI
- current-state compaction/apply CLI with backups and manifest output

Intentional current behavior:

- rollback semantics are global from the selected version/range, not same-chat-only
- `POST /data/character-evolution/:charId/retention/dry-run` remains a next-handoff preview
- cleanup execution is CLI-first, not an API/UI mutation path

## 1. Implementation Checklist By Subsystem

### A. Types, defaults, normalization

- Add a new global defaults object for retention policy under `characterEvolutionDefaults`.
- Add storage types for:
  - bucket-based archive thresholds
  - bucket-based deletion thresholds
  - per-section stored caps
- Add normalizers with safe defaults and bounds.
- Add schema defaults so existing installs load with retention defaults automatically.
- Keep retention global-only in the first pass.

Files likely touched:

- `src/ts/storage/database.types.ts`
- `src/ts/character-evolution/schema.ts`
- `src/ts/character-evolution/normalizers.ts`
- `server/node/llm/character_evolution/normalizers.cjs`
- `server/node/llm/character_evolution/schema.cjs`

### B. Retention engine

- Replace hardcoded archive thresholds with retention-policy reads.
- Extend decay so `corrected` and `archived` also advance inactivity counters.
- Add removal of stale non-active items from `currentState`.
- Add stored-cap enforcement after merge and decay.
- Keep `processedRanges`, `stateVersions`, and snapshot files untouched by retention cleanup.
- Ensure confirmed slow-memory deletion uses the special slow-confirmed threshold.

Files likely touched:

- `src/ts/character-evolution/decay.ts`
- `server/node/llm/character_evolution/decay.cjs`
- possibly a new helper such as `src/ts/character-evolution/retention.ts`

### C. Duplicate/refinement handling

- Tighten matching so wording refinements update-in-place more often.
- Prioritize `activeThreads`.
- Ensure `corrected` is reserved for real semantic supersession.

Files likely touched:

- `src/ts/character-evolution/items.ts`
- `src/ts/character-evolution/conflicts.ts`
- server CJS mirrors

### D. Prompt-side compacting

- Keep current projection system.
- Add compact extractor-facing text generation from stored items.
- Avoid rewriting canonical stored values just to save prompt space.

Files likely touched:

- `server/node/llm/character_evolution/prompt_builder.cjs`
- optionally add TS mirror helper for compact rendering

### E. Version-management backend

- Add mutation endpoints for:
  - clear accepted coverage for a range
  - revert current state to a version
  - delete a version under rollback-safe rules
- Cascade invalidation of later dependent ranges in the same chat.
- Recompute `processedRanges`, `stateVersions`, and `lastProcessedMessageIndexByChat`.
- Clear stale pending proposals.

Files likely touched:

- `server/node/routes/evolution_version_routes.cjs`
- new helper/service for version mutation logic
- `src/ts/character-evolution/workflow.ts` or a new shared mutation helper

### F. Version-management UI

- Add retention settings panel to Evolution Defaults.
- Add controls in Evolution History / Accepted Coverage views for:
  - revert version
  - delete version
  - clear accepted coverage
  - rerun handoff from cleared range
- Add previews/warnings for destructive operations.

Files likely touched:

- `src/lib/Setting/Pages/EvolutionDefaultsSettings.svelte`
- new retention settings editor component
- evolution history UI components

### G. Recovery / cleanup tooling

- Add dry-run report for retention cleanup on existing states.
- Add an offline CLI apply command for one-time cleanup rollout.
- Keep current-state compaction/apply separate from next-handoff preview semantics.

## 2. Settings Schema And API Shapes

### A. Proposed settings types

Add to `database.types.ts`:

```ts
export type CharacterEvolutionRetentionBucket = "fast" | "medium" | "slow"

export interface CharacterEvolutionRetentionThresholds {
  archive: Record<CharacterEvolutionRetentionBucket, number>
  deleteNonActive: Record<CharacterEvolutionRetentionBucket, number>
  deleteConfirmedSlow: number
}

export interface CharacterEvolutionRetentionSectionCap {
  active: number
  nonActive: number
}

export interface CharacterEvolutionRetentionPolicy {
  thresholds: CharacterEvolutionRetentionThresholds
  caps: Partial<Record<CharacterEvolutionProjectedItemSectionKey, CharacterEvolutionRetentionSectionCap>>
}
```

Add to `CharacterEvolutionDefaults`:

```ts
retention?: CharacterEvolutionRetentionPolicy
```

No character-level override in first pass.

### B. Default values

Recommended defaults:

```ts
retention: {
  thresholds: {
    archive: {
      fast: 2,
      medium: 5,
      slow: 8,
    },
    deleteNonActive: {
      fast: 6,
      medium: 12,
      slow: 24,
    },
    deleteConfirmedSlow: 36,
  },
  caps: {
    activeThreads: { active: 6, nonActive: 10 },
    keyMoments: { active: 12, nonActive: 12 },
    characterHabits: { active: 6, nonActive: 8 },
  },
}
```

### C. Normalization rules

- all thresholds must be integers `>= 0`
- all caps must be integers `>= 1`
- missing values fall back to defaults
- unknown keys are ignored

### D. Settings persistence shape

Stored under:

```json
{
  "characterEvolutionDefaults": {
    "promptProjection": { ... },
    "retention": { ... }
  }
}
```

### E. Client/server API impact

No separate server API is required just for retention defaults if settings already persist through the normal settings save path.

If settings persistence already writes the DB blob directly, reuse that flow.

## 3. Version-Management Endpoints And UI Actions

### A. Existing read endpoints

Already present:

- `GET /data/character-evolution/:charId/versions`
- `GET /data/character-evolution/:charId/versions/:version`

### B. New mutation endpoints

Recommended shapes:

#### 1. Clear accepted coverage for a range

`POST /data/character-evolution/:charId/coverage/clear`

Request:

```json
{
  "chatId": "chat-id",
  "startMessageIndex": 161,
  "endMessageIndex": 180,
  "cascade": true
}
```

Behavior:

- require an exact match to one accepted processed range
- remove that accepted coverage
- invalidate later dependent ranges globally from that rollback point
- restore `currentState` to the last valid version before the cleared range
- clear stale pending proposal
- recompute coverage cursor from surviving `processedRanges`

Response:

```json
{
  "ok": true,
  "clearedVersions": [17, 18],
  "currentStateVersion": 16,
  "nextUnprocessedMessageIndex": 161
}
```

#### 2. Revert to a version

`POST /data/character-evolution/:charId/versions/:version/revert`

Request:

```json
{
  "cascade": true
}
```

Behavior:

- restore `currentState` from that snapshot
- invalidate later dependent versions/ranges globally from that rollback point
- clear stale pending proposal
- recompute cursor

Response:

```json
{
  "ok": true,
  "currentStateVersion": 16,
  "invalidatedVersions": [17, 18]
}
```

#### 3. Delete version

`POST /data/character-evolution/:charId/versions/:version/delete`

Request:

```json
{
  "mode": "tail_safe" | "rollback_from_here"
}
```

Behavior:

- if latest tail version: delete directly
- if interior version: require rollback semantics and invalidate later dependent versions/ranges
- delete both metadata and snapshot file
- restore `currentState` accordingly
- clear stale pending proposal

Response:

```json
{
  "ok": true,
  "deletedVersions": [18],
  "invalidatedVersions": [],
  "currentStateVersion": 17
}
```

### C. Backend rules

- `processedRanges` is source of truth
- `lastProcessedMessageIndexByChat` is recomputed after every mutation
- rollback invalidation is global from the selected version/range in the current implementation
- old snapshots are not touched by retention cleanup
- version deletion explicitly removes snapshot files only for the user-requested rollback/delete operation

### D. UI actions

#### Evolution Defaults

Add a new tab:

- `Retention`

Fields:

- fast archive threshold
- medium archive threshold
- slow archive threshold
- fast delete-non-active threshold
- medium delete-non-active threshold
- slow delete-non-active threshold
- confirmed slow delete threshold
- section caps for:
  - activeThreads
  - keyMoments
  - characterHabits

#### Evolution History

Actions per version:

- `View`
- `Revert`
- `Delete`

Actions per accepted range:

- `Clear Coverage`
- `Rerun From Here`

Preview modal should show:

- versions to invalidate
- message ranges to clear
- target restored current version
- pending proposal clearing warning if applicable

## 4. Test Plan

### A. Retention policy defaults / normalization

- defaults created correctly when missing
- invalid threshold/cap values normalize safely
- retention settings round-trip through storage

### B. Active decay

- active fast items archive at configured threshold
- active medium items archive at configured threshold
- active slow non-confirmed items archive at configured threshold
- confirmed slow items do not archive early and use confirmed slow delete rule only after non-active state

### C. Non-active deletion

- corrected items increment unseen count
- archived items increment unseen count
- corrected items delete at configured threshold
- archived items delete at configured threshold
- confirmed slow non-active items delete at confirmed-slow threshold

### D. Stored caps

- non-active items trimmed before active items
- active items are archived before deletion
- caps apply only to configured sections
- merge semantics are preserved for omitted active items until archive/cap logic runs

### E. Duplicate/refinement control

- same-idea wording refinement updates existing item
- true contradiction produces corrected item
- activeThreads duplicate chains shrink compared to current behavior

### F. Prompt-side compacting

- extractor prompt state gets shorter
- canonical stored values are unchanged unless explicitly intended
- projection limits still apply normally

### G. Version-management backend

- clear coverage for exact range
- global cascade invalidation works from the selected rollback point
- `currentState` restores to prior valid version
- `processedRanges` recompute correctly
- `lastProcessedMessageIndexByChat` recomputes correctly
- pending proposal clears on rollback-like operations
- latest-tail delete works
- interior delete triggers rollback semantics

### H. Version-management UI

- retention settings render and persist
- destructive actions show preview
- rerun action lands on the right next-unprocessed point
- deleted / reverted versions disappear from visible history as expected

### I. Cleanup rollout

- next-handoff dry-run remains available for prompt-lifecycle preview
- current-state compaction preview/apply is available through the offline CLI
- cleanup does not rewrite historical snapshots
- cleaned `currentState` shrinks while version history remains intact

## Recommended Delivery Order

1. Types/defaults/normalizers for retention settings
2. Retention engine changes
3. Stored caps
4. Duplicate/refinement tightening
5. Version-management backend mutations
6. Version-management UI
7. Retention settings UI
8. Prompt compacting
9. Invalid-JSON hardening
10. Dry-run cleanup tooling
11. Rollout validation
