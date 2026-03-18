# LLM Prompt / Execution Refactor Baseline

Scope inspected:
- `server/node/routes/llm_routes.cjs`
- `server/node/llm/generate_helpers.cjs`
- `server/node/llm/prompt.cjs`
- `server/node/llm/engine.cjs`
- `server/node/llm/execute_route_handler.cjs`
- `src/ts/process/request/openAI.ts`
- `src/ts/process/request/google.ts`
- `src/ts/process/request/providers/*`

## Current Data Flow

1. Client entry points build provider-native request bodies.
   - OpenAI/OpenRouter/DeepSeek: `buildOpenAIRequestPayload()` shapes `messages`, tool calls, multimodal content, model overrides, and provider flags (`src/ts/process/request/providers/openai.payload.ts`).
   - Google: `buildGoogleBaseRequestPayload()` shapes `contents`, `systemInstruction`, tool declarations, and Gemini-specific thinking config (`src/ts/process/request/providers/google.payload.ts`).

2. Client decides whether to call raw provider APIs or the node server.
   - `requestOpenAI()` chooses between direct HTTP and node-server execution helpers (`src/ts/process/request/openAI.ts`).
   - `requestGoogleCloudVertex()` does the same for Google (`src/ts/process/request/google.ts`).

3. Node-server client helpers decide `/data/llm/generate` vs `/data/llm/execute`.
   - OpenAI/OpenRouter/DeepSeek do this in `requestServerExecution()` (`src/ts/process/request/providers/openai.server.ts`).
   - Google reimplements the same decision and payload shaping in `requestGoogleServerExecution()` (`src/ts/process/request/google.ts`).

4. Server routes split into three entry modes.
   - `/data/llm/execute` delegates straight to `handleLLMExecutePost()`.
   - `/data/llm/generate` first calls `buildGenerateExecutionPayload()`, then reuses `handleLLMExecutePost()`.
   - `/data/llm/generate/trace` builds the same generate payload, runs server prompt assembly, and emits prompt trace/audit output (`server/node/routes/llm_routes.cjs`).

5. `/generate` builds the authoritative server-side prompt.
   - `buildGenerateExecutionPayload()` loads settings/character/chat, persists the latest user message, runs periodic memory summarization, calls `buildGeneratePromptMessages()`, trims to context budget, then builds a provider request via `buildGenerateProviderRequest()` (`server/node/llm/generate_helpers.cjs`).
   - `buildGeneratePromptMessages()` builds template-driven prompt messages and prompt block metadata (`server/node/llm/prompt.cjs`).

6. Server execution normalizes, injects server-only context, then dispatches.
   - `parseExecutionInput()` produces the normalized execution envelope.
   - `assembleServerPrompt()` injects RAG and game-state context into provider request messages or template slots.
   - `execute()` / `previewExecution()` dispatch by provider (`server/node/llm/engine.cjs`).

7. The route handler owns execution-side response policy.
   - `handleLLMExecutePost()` enforces `/generate` for character-bound model mode, handles streaming/non-streaming response framing, visible-output validation, game-state writeback, audits, and trace persistence (`server/node/llm/execute_route_handler.cjs`).

## Duplicated Logic

- Generate-vs-execute routing is duplicated across `resolveServerExecutionEndpoint()` (`src/ts/process/request/request.transport.ts`), `requestServerExecution()` for OpenAI-family providers, and `requestGoogleServerExecution()` for Google.
- Raw-generate eligibility rules are duplicated but not identical.
  - OpenAI-family checks multimodal, non-string messages, prompt-only payloads, preview mode, and character/chat context (`src/ts/process/request/providers/openai.server.ts`).
  - Google checks a smaller subset (`src/ts/process/request/google.ts`).
- Provider request normalization exists in both client and server.
  - Client builds provider-native bodies in `openai.payload.ts` / `google.payload.ts`.
  - Server rebuilds provider request bodies from normalized prompt messages in `buildGenerateProviderRequest()` (`server/node/llm/prompt.cjs`).
- Nested request traversal is ad hoc in multiple places.
  - `getExecutionRequestPayload()` in `engine.cjs`.
  - `getNestedRequestCandidates()` plus trace readers in `prompt.cjs`.
- SSE parsing/normalization is split across layers.
  - Server parses upstream provider SSE and emits normalized `{type:'chunk'|'done'|'fail'}` events in `execute_route_handler.cjs`.
  - Client has separate server-stream readers in `request.transport.ts`, `openai.stream.ts`, and `google.stream.ts`.
- Tool-call text decoding is provider-specific and duplicated in request builders.
  - `<tool_call>...</tool_call>` handling exists in both `openai.payload.ts` and `google.payload.ts`.

## Proposed Extraction Boundaries

1. Execution envelope helpers
   - Shared helpers for:
     - resolving the deepest request payload
     - reading/writing prompt messages
     - reading/writing prompt blocks
     - extracting model/maxTokens/tool metadata
   - First target files:
     - logic now in `server/node/llm/engine.cjs:getExecutionRequestPayload()`
     - logic now in `server/node/llm/prompt.cjs:getNestedRequestCandidates()`

2. Client server-execution payload planner
   - One shared client helper that decides:
     - `/generate` vs `/execute`
     - raw-generate eligibility
     - compact vs full server payload shape
   - First target files:
     - `src/ts/process/request/providers/openai.server.ts`
     - `src/ts/process/request/google.ts`

3. Prompt assembly boundary
   - Keep `prompt.cjs` focused on template-to-messages conversion.
   - Move `/generate` orchestration concerns out of `generate_helpers.cjs`:
     - user-message persistence
     - periodic memory summarization
     - prompt budget trimming
     - provider-request finalization

4. Stream normalization boundary
   - Separate:
     - upstream provider SSE parsing
     - normalized server event framing
     - downstream client accumulation/tool continuation
   - This should reduce cross-file coupling between `execute_route_handler.cjs`, `request.transport.ts`, `openai.stream.ts`, and `google.stream.ts`.

## Risk Areas And Test Points

- Payload shape drift between client-built and server-built requests.
  - Test: raw `/generate` vs full `/execute` should produce equivalent provider request bodies for the same logical conversation where raw generate is allowed.
- Prompt block / slot metadata drift.
  - Test: keep `prompt.test.ts` slot, memory-range, characterState, and semanticRecall coverage green.
- RAG and game-state injection against nested request shapes.
  - Test: keep `engine.test.ts` coverage for slot injection, no-slot skip behavior, and RAG budgeting.
- Streaming contract regressions.
  - Test: keep `execute_route_handler.test.ts` coverage for partial frames, missing done signal, disconnect handling, reasoning-only guards, and fallback SSE behavior.
  - Test: keep `openai.server.test.ts` coverage for generate-endpoint reuse and streaming passthrough.
- User-message durability before generation.
  - Test point: `buildGenerateExecutionPayload()` path where the tail user message already exists vs must be appended.
- Google-specific risk.
  - `requestGoogleServerExecution()` currently uses `useClientAssembledRequest` only on the non-raw path; extraction must not accidentally change when server-side assembly is skipped or duplicated.

## Exact Next Extraction Targets

1. Extract a server-side `execution_payload_accessors` helper from:
   - `server/node/llm/engine.cjs`
   - `server/node/llm/prompt.cjs`

2. Extract a client-side `buildServerExecutionPayload()` helper from:
   - `src/ts/process/request/providers/openai.server.ts`
   - `src/ts/process/request/google.ts`

3. Extract `trimPromptMessagesToContext()` and its prompt-block index helpers from:
   - `server/node/llm/generate_helpers.cjs`

4. Extract stream envelope normalization helpers from:
   - `server/node/llm/execute_route_handler.cjs`
   - `src/ts/process/request/request.transport.ts`

These targets preserve behavior while reducing the highest-risk duplication first.
