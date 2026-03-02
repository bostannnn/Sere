# RisuAII Project Memory

## Project Overview
RisuAI is a **server-first AI chat application**. The Node.js server owns all LLM execution, prompt assembly, RAG, and memory. The client is a Svelte 5 SPA that renders results and delegates work to the server via HTTP.

## Key Files
- `src/ts/platform.ts` — `isNodeServer` flag (THE client/server gate, always `true`)
- `src/ts/globalApi.svelte.ts` — `globalFetch`, all client HTTP calls
- `src/ts/process/index.svelte.ts` — Chat orchestration
- `server/node/server.cjs` — Server entry point
- `server/node/server_helpers.cjs` — `sendJson`, `sendSSE`, `requireSafeSegment`
- `server/node/storage_utils.cjs` — `safeResolve`, `computeEtag`, `requireIfMatch`
- `CONVENTIONS.md` — All repo rules
- `docs/SERVER_RULES.md` — Server coding rules
- `docs/DESIGN_RULES.md` — UI design contracts
- `docs/TESTING_RULES.md` — Testing mandate

## Tech Stack
- **Client**: Svelte 5, TypeScript, Vite, Tailwind CSS 4
- **Server**: Node.js, Express (CommonJS `.cjs`)
- **Test**: Vitest (unit), custom smoke scripts (integration)
- **Package manager**: pnpm
- **Linter**: ESLint 9 with typescript-eslint and eslint-plugin-svelte

## Architecture Notes
- All server files use `.cjs` extension (CommonJS)
- Server uses DI pattern: all deps destructured from `arg` at top of handler
- Path safety: `requireSafeSegment` / `safeResolve` on every user-supplied ID
- Response helpers: `sendJson` used, never `res.json()` / `res.send()` directly
- File size limit: 500 LOC max for new files

## Detailed Docs
- See `suggested_commands.md` for all dev commands
- See `conventions.md` for coding rules summary
- See `task_completion.md` for pre-commit checklist
