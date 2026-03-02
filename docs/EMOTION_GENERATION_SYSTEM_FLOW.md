# Emotion Generation System (Current Flow)

Last updated: 2026-02-16

## Summary

Emotion selection is a post-generation step that runs after every assistant reply. It has three paths:

1. **Fast path** — if the main generation returned a pre-selected emotion in `req.special.emotion`, record it immediately and skip everything else.
2. **Embedding mode** (`emotionProcesser === 'embedding'`) — no extra LLM call; similarity-matches the assistant text against configured emotion labels using client-side embeddings with recency penalties.
3. **Classifier mode** (default) — sends a 4-message classifier prompt to a secondary model (`db.subModel`) via `/data/llm/execute`. Server returns a single emotion token; client normalizes it (exact match → substring match → `'neutral'` fallback).

Emotion requests always go through `/data/llm/execute`, never `/data/llm/generate` — the generate endpoint is model-mode only.

---

## Entry point

Emotion selection runs after a normal assistant reply is generated in:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2145`

It only runs when:

- `currentChar.inlayViewScreen === false`
- `currentChar.viewScreen === 'emotion'`
- no emotion was already set by `req.special.emotion`
- request was not aborted

## Fast path: preselected emotion from special payload

If the main generation returns `req.special.emotion`, the client immediately records it in `CharEmotion` history:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2119`

This bypasses the secondary emotion model call.

## Mode A: embedding-based emotion selection

If `DBState.db.emotionProcesser === 'embedding'`, the client:

1. Builds a temporary embedding corpus from configured emotion labels.
2. Similarity-matches against the final assistant text.
3. Applies recency penalties to recently used emotions.
4. Picks top score and stores it.

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2162`

No LLM request is made in this branch.

## Mode B: submodel/classifier emotion selection

If not in embedding mode, the client builds a 4-message classifier prompt:

1. system: instruction + shuffled emotion list (`emotionPrompt2` fallback)
2. user: fixed example input
3. assistant: fixed example output (`happy`)
4. user: the actual generated assistant text

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2238`

Then it builds token bias:

- positive prior for all emotion tokens
- negative recency penalty for recently selected emotions

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2215`

The request is sent as:

- `requestChatData(..., 'emotion', ...)`

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2257`

## Client request routing for emotion mode

`requestChatDataMain` sets:

- `targ.mode = 'emotion'`
- model = `db.subModel` (unless overridden)

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/request/request.ts:581`

For OpenAI-compatible providers, `requestServerExecution` chooses endpoint:

- `/data/llm/generate` only when `mode === 'model'`
- otherwise `/data/llm/execute`

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/request/openAI.ts:73`

So emotion requests now go through `/data/llm/execute`, not `/data/llm/generate`.

## Server-side handling for emotion mode

### 1) Input parsing

Server normalizes request mode/provider in:

- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/engine.cjs:46`

### 2) Prompt assembly side effects

`assembleServerPrompt()` is called for execute/preview for all modes, including emotion:

- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/engine.cjs:338`

If character RAG is enabled, it can prepend `<Rules Context>` to the first system/developer message and append `promptBlocks` metadata.

Core code:

- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/engine.cjs:126`
- `/Users/andrewbostan/Documents/RisuAII/server/node/llm/engine.cjs:227`

### 3) Provider execution + output normalization

Server sanitizes output by mode. For `emotion`, if sanitized text is empty, server forces:

- `'neutral'`

Code:

- `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:2522`

## Client-side post-processing of emotion output

Returned text is normalized to lowercase and resolved in this order:

1. exact label match
2. substring contains known label
3. fallback to `neutral` (if available in configured list)

Code:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:2284`

## Inlay screen special case

When `inlayViewScreen` is active and `viewScreen === 'emotion'`, emotion instructions are injected into post-everything prompt content instead of running the above selector flow:

- `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts:632`

## Logging/trace view details

- Durable audit request for `/generate` is compacted (counts/keys/chars), not full payload:
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:2005`
- Generate trace is separately stored with truncation:
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:1917`

