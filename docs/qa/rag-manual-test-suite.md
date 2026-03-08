# Rulebook RAG Manual Test Suite

Last updated: 2026-03-09

## Goal
Validate the current server-only Rulebook RAG flow end to end:
- character-level rulebook selection
- prompt-template slot placement
- current retrieval quality for rule/setup questions
- ingestion/reingestion behavior after extractor changes

## Preconditions
1. Run the app against the Node server.
2. Open browser devtools Network tab with Preserve log enabled.
3. Use at least one ingested rulebook you can verify manually.
4. For retrieval-quality checks, prefer a book with a known introduction/how-to-play section.

## Batch 1: Character Rulebook Selection
1. Open a character with Rulebook RAG enabled.
2. In character Rulebooks, clear all selected books.
3. Select exactly one book.
4. Send a chat message that should use rulebook retrieval.

Expected:
- Request payload contains `ragSettings.enabledRulebooks` with exactly one rulebook ID.
- Retrieved sources come only from that selected rulebook.

## Batch 2: Prompt Template Slot Placement
1. Use a prompt template that includes a `rulebookRag` slot.
2. Send a message that triggers RAG.
3. Inspect prompt trace/debug payload.

Expected:
- `promptBlocks` contains `Rulebook RAG` as its own indexed block.
- It should not show `mergedInto: "first-system"`.
- If the template has no `gameState` slot, `Game State` should appear as skipped with `reason: "no_template_slot"`.

## Batch 3: No-Slot Fallback Behavior
1. Remove the `rulebookRag` card from the active prompt template.
2. Send the same message again.
3. Inspect prompt trace/debug payload.

Expected:
- No `<Rules Context>` block is injected into the prompt.
- `promptBlocks` records `Rulebook RAG` as skipped with `reason: "no_template_slot"`.

## Batch 4: Broad Setup Query Ranking
1. Ask a broad onboarding question such as:
   - `Tell me what is needed to play a thousand year old vampire?`
   - `How do I start playing this game?`
2. Inspect the injected `<Rules Context>`.

Expected:
- Intro/getting-started/playing-the-game pages rank above appendix/interview/noise pages.
- Results count respects global `topK`.
- All cited sources belong to the selected rulebook only.

## Batch 5: Reingest After Extractor Change
1. Delete an existing rulebook from the library.
2. Ingest the same PDF again.
3. Rerun the same query as before.

Expected:
- Retrieved chunk text changes if extractor cleanup changed.
- Previously stored dirty chunks do not persist after reingest.

## Batch 6: Chunk Cleanliness Spot Check
1. Ask 5 queries spanning:
   - intro/setup
   - a short list
   - a table or structured content block
   - a mid-book rule explanation
2. Inspect the retrieved context each time.

Expected:
- No cross-column stitching.
- No repeated header/footer junk.
- Minimal duplicated half-lines inside a single chunk.
- Structured rows remain readable.

## Batch 7: Budget and Top-K Sanity
1. Set global RAG `topK` to a low number such as `2` or `3`.
2. Set a small global RAG budget.
3. Send a broad query.

Expected:
- Injected source block count does not exceed global `topK`.
- Context is trimmed or omitted to fit budget instead of silently expanding.
- Prompt trace still shows `Rulebook RAG` in the template slot when present.

## Failure Evidence to Capture
- Exact prompt text
- Selected rulebook IDs
- Prompt trace `promptBlocks`
- Full `<Rules Context>` block
- Rulebook ID/version if reingestion was involved
- Server log tail around ingestion or search
