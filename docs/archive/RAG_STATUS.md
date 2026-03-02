# RAG System Status - Final Stable Release (Debugging Edition)

## Overview
The RAG (Retrieval-Augmented Generation) system is conceptually integrated, but facing critical issues with prompt injection and reliable data flow to the LLM. Autonomous state tracking is functional server-side but UI updates are hindered by parsing issues.

## Implementation Details

### Core Architecture
- **Server-Authoritative Storage:** The server's filesystem (`data/rag/rulebooks`) is the sole source of truth. Manually copying rulebook `.json` files is now supported and recognized instantly.
- **Autonomous State Bridge:** 
  - **State Parser:** Extracts session variables (e.g., `[Hunger: 2]`) from the AI's `[SYSTEM]` block.
  - **Normalization:** Automatically maps varied phrasing (e.g., "Active Candles" vs "Remaining Candles") to stable keys.
  - **Data Integrity:** Numeric strings are automatically converted to `number` types for math/logic consistency.
- **Advanced Retrieval Engine:**
  - **Sliding Window:** Searches use the last 3 chat turns for deep scene context.
  - **Sequential Merging:** Retrieves natural rule "blocks" by pulling neighbors from the same page.
  - **Source Diversity:** Round-robin selection pulls rules from multiple enabled books before taking duplicates from one.
  - **Priority System:** Starred books receive a `0.05` boost to semantic scores.

### UI & UX
- **Dynamic HUD Ribbon:** A sticky, mobile-responsive bar at the top of the chat area showing live session stats with horizontal scroll and fade effects.
- **Game State Editor:** A dedicated tab in the Character Card for manual viewing and overrides of tracked variables.
- **Unified RAG Dashboard:** A full-screen library manager with hierarchical system/edition tree filtering.
- **Prompt Constructor:** Official `Game State` and `Rulebook RAG` blocks added to the template builder with support for custom `{{slot}}` formatting.

### Hardening & Safety
- **Request Synchronization:** Fixed 404 and authentication issues for local server requests.
- **Flicker-Free HUD:** State updates only trigger after the AI finishes its stream.
- **Concurrent Safety:** Manual edits in the Game State Editor temporarily lock out AI updates to prevent data loss.
- **Ingestion Cleanup:** Server-side listeners terminate embedding immediately if the user closes or refreshes the page.
- **Comprehensive Logging:** Real-time terminal logs for server RAG activity and browser console logs for state updates.

## Current State (Debugging Active)
- [x] Rulebook Data Bank (Stable)
- [x] Filesystem Discovery (Stable)
- [x] Autonomous State Tracking (Server-side working)
- [ ] Dynamic Chat HUD (UI update failure due to `[SYSTEM]` parsing)
- [x] Manual State Override (Stable)
- [x] Advanced Context Retrieval (Server-side search working)
- [x] Stable Server-Side Storage & Search

## Active Issues
- **RAG Prompt Injection Failure:** The `<Rules Context>` is not being reliably injected into the LLM's prompt. This causes the AI to hallucinate rules and game mechanics.
  - **Diagnosis:** `[Server-Assembly] Total assembly time: 2ms` in logs indicates RAG processing is being skipped or not fully executed for injection. Last known issue was an `INVALID_MESSAGES` error after attempting a fix.
  - **Symptom:** AI ignores `MECHANICAL CONSTRAINTS` in prompt, outputs V5 terms, and uses incorrect Revised Edition stats (e.g., `candles`, `brink`, `traits`).
- **HUD Update Failure:** Despite server-side state parsing, the HUD sometimes fails to update.
  - **Diagnosis:** The `[SYSTEM]` block parser in `server/node/server.cjs` is currently too strict, failing to extract variables if there's a newline immediately after `[SYSTEM]`.
- **Client-Side Log Display Bug:** The UI's "Request Logs" are not updating, hindering client-side debugging.

## Next Steps (Debugging Focus)
1. **Verify `assembleServerPrompt` conditions:** Diagnose why `ragEnabled`, `enabledRulebooks.length`, or `lastUserMessage` might be causing RAG injection to be skipped in `server/node/llm/engine.cjs`.
2. **Re-implement lenient `[SYSTEM]` parser:** Ensure `server/node/server.cjs` correctly parses `[SYSTEM]` blocks with newlines.
3. **Trace message array flow:** Confirm that `input.request.requestBody.messages` is correctly modified by `assembleServerPrompt` and passed to OpenRouter.
4. **Fix client-side log display.**

## Next Steps (Future Phases)
- **Visual Dice Integration:** Automating the [SYSTEM] roll math into dice results.
- **Multimodal RAG (Low Priority):** Image/Illustration extraction and semantic visual search from PDFs.
