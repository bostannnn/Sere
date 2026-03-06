## Project Overview

Risuai is a cross-platform AI chatting application built with:
- **Frontend**: Svelte 5 + TypeScript
- **Desktop**: Tauri 2.5 (Rust backend)
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **Package Manager**: pnpm

The application allows users to chat with various AI models (OpenAI, Claude, Gemini, and more) through a single unified interface. It features a rich user interface with support for themes, plugins, custom assets, and advanced memory systems.

## AI Guardrails (Do Not Skip)

- Never invent file paths, APIs, schema fields, or behavior. If a fact is not confirmed in repo files, say “unknown” and ask.
- Always open or search files before claiming details.
- Cite source files with paths when stating decisions, specs, or behavior.
- If a requirement is missing or ambiguous, stop and ask.
- Do not proceed with large refactors without a staged plan and explicit checkpoints.

## No Shortcuts, No Compromises

**The correct fix is ALWAYS better than the quick fix. No exceptions.**

- Fix bugs when you find them. If a bug affects the work being done, fix it now. Do not defer it, do not mark it out-of-scope, and do not create a follow-up task unless the fix is genuinely multi-day work and blocked by missing infrastructure.
- Take the correct approach, not the easy one. Technical debt compounds, so always choose the long-term solution.
- Never assume, always verify. Do not trust plans, comments, variable names, or intuition. Read code, docs, and data directly, then cite evidence with file paths and line references where possible.
- "Good enough" is not good enough. If there is a known issue, raise it, investigate it, and fix it.
- The user makes decisions. When there is a tradeoff, present options with evidence and let the user decide.
- Document everything verified. If a formula or behavior is verified, record exactly where it was verified so future sessions can continue without context loss.

## UI Design System Guardrails (Do Not Skip)

- UI rewrite and component work must follow `DESIGN_SYSTEM_RULES.md`.
- Use a token-first approach: do not invent new spacing, radius, color, type, or motion values ad-hoc.
- Before screen rewrites, define baseline tokens and core primitives first.
- If a new token or primitive variant is needed, document it in the relevant plan/doc before broad usage.

## Source of Truth (Current Work)

- Server storage refactor: `SERVER_STORAGE_PLAN.md` is the primary specification.
- Any deviation from the spec must be documented in `plan.md` with rationale and date.

## Testing & Logging (Server Storage Refactor)

- Testing cadence:
  - After each endpoint or storage feature: run a **small API smoke set** (settings + one character + one chat + ETag conflict).
  - After each batch of related changes: run the **full API suite** (all resources + assets).
  - Before merge/ship: full suite + server restart reload check.
- Automated tests should be **minimal integration tests** (single script) unless otherwise required.
- Logging must include: request id, method, path, resource id (if applicable), `ETag`, `If-Match`, status, duration, and conflict reason.
- After each completed slice, explicitly ask the user to run the relevant test(s) and provide the exact commands.
- UI execution cadence is **dev-first**: use `pnpm dev` + lightweight checks for per-slice iteration; avoid rebuilding on every slice.
- If server-mode client behavior is being tested, ensure `dist/` is rebuilt after code changes; if build hasn’t run or failed, ask the user to rebuild.
- Use `pnpm build` + `pnpm run runserver` at checkpoints/batched milestones, before final server-mode signoff, or when explicitly requested.
- Clarify mode rules: `pnpm run runserver` serves `dist/` (requires rebuild for UI changes). `pnpm dev` serves live source (no rebuild needed).

## Directory Structure

```
risuai-newest/
├── src/                    # Main application source code
│   ├── ts/                 # TypeScript business logic
│   ├── lib/                # Svelte UI components
│   ├── lang/               # Internationalization (i18n)
│   ├── etc/                # Documentation and extras
│   └── test/               # Test files
├── src-tauri/              # Tauri desktop backend (Rust)
├── server/                 # Self-hosting server implementations
│   └── node/               # Node.js server
├── public/                 # Static assets
├── dist/                   # Build output
├── resources/              # Application resources
└── .github/workflows/      # CI/CD pipelines
```

### Source Code Structure (`/src`)

#### `/src/ts` - TypeScript Business Logic

| Directory/File | Purpose |
|----------------|---------|
| `storage/` | Data persistence layer (database, save files, platform adapters) |
| `process/` | Core processing logic (chat, requests, memory, models) |
| `plugins/` | Plugin system (API v3.0, sandboxing, security) |
| `gui/` | GUI utilities (colorscheme, highlight, animation) |
| `drive/` | Cloud sync and backup |
| `translator/` | Translation system |
| `model/` | Model definitions and integrations |
| `sync/` | Multi-user synchronization |
| `cbs.ts` | Callback system |
| `characterCards.ts` | Character card import/export |
| `parser.svelte.ts` | Message parsing |
| `stores.svelte.ts` | Svelte stores for state management |
| `globalApi.svelte.ts` | Global API methods |
| `bootstrap.ts` | Application initialization |

#### `/src/ts/process` - Core Processing

| Directory/File | Purpose |
|----------------|---------|
| `index.svelte.ts` | Main chat processing orchestration |
| `request/` | API request handlers (OpenAI, Anthropic, Google) |
| `memory/` | Memory systems (HypaMemoryV2/V3, SupaMemory, HanuraiMemory) |
| `models/` | AI model integrations (NAI, OpenRouter, Ooba, local models) |
| `templates/` | Prompt templates and formatting |
| `mcp/` | Model Context Protocol support |
| `files/` | File handling (inlays, multisend) |
| `embedding/` | Vector embeddings |
| `lorebook.svelte.ts` | Lorebook/world info management |
| `scriptings.ts` | Scripting system |
| `triggers.ts` | Event triggers |
| `stableDiff.ts` | Stable Diffusion integration |
| `tts.ts` | Text-to-speech |

#### `/src/lib` - Svelte UI Components

| Directory | Purpose |
|-----------|---------|
| `ChatScreens/` | Chat interface components |
| `UI/` | General UI components (GUI, NewGUI, Realm) |
| `Setting/` | Settings panels |
| `SideBars/` | Sidebar components (Scripts, LoreBook) |
| `Others/` | Miscellaneous components |
| `Mobile/` | Mobile-specific UI |
| `Playground/` | Testing/playground features |
| `VisualNovel/` | Visual novel mode |
| `LiteUI/` | Lightweight UI variant |

## Building and Running

### Prerequisites

- Node.js and pnpm
- Rust and Cargo (for Tauri builds)

### Development

```bash
# Web development server
pnpm dev

# Tauri desktop development
pnpm tauri dev
```

### Production Builds

```bash
# Web build
pnpm build

# Web build for hosting
pnpm buildsite

# Tauri desktop build
pnpm tauribuild
pnpm tauri build

```

### Type Checking

```bash
pnpm check
```

## Development Conventions

### Coding Style

- The project uses Prettier for code formatting
- Ensure code is formatted before committing

### State Management

The project uses Svelte 5 Runes system:
- `$state`, `$derived`, `$effect` for reactive state
- Svelte stores (writable, readable) in `stores.svelte.ts`

Key stores:
- `DBState` - Database state
- `selectedCharID` - Current character
- `settingsOpen`, `sideBarStore`, `MobileGUI` - UI state
- `loadedStore`, `alertStore` - Application state
- `DynamicGUI` - Responsive layout switching

### File Naming Conventions

- `.svelte.ts` - Svelte 5 files with runes
- `.svelte` - Svelte component files
- Use camelCase for file names

### Testing

- Basic test file in `src/test/runTest.ts`
- Run `pnpm check` for type checking
- No comprehensive test suite; relies on TypeScript for type safety

### Streaming & Tokenization

- **Response Streaming** is a single toggle shown only when the selected model reports streaming support.
- If streaming is enabled but responses still arrive all at once, the model/provider likely does not support streaming.
- **Tokenizer** affects local token estimation only; it does not change model output.

### Memory & Summaries

- HypaV3 summaries are injected into the prompt under a memory tag (e.g., `Past Events Summary`).
- Summary headings/keywords should be stripped before injection to reduce “summary‑style” responses.

## Key Architectural Patterns

### Data Layer

- Database abstraction with multiple storage backends:
  - Tauri FS, LocalForage, Mobile, Node, OPFS
- Save file format: `.bin` files with encryption support
- Character cards: Import/export in various formats (.risum, .risup, .charx)

### Processing Pipeline

1. Chat processing in `process/index.svelte.ts`
2. Request handling with provider abstraction
3. Memory systems for context management
4. Lorebook integration for world info

### Plugin System (API v3.0)

- Iframe-based sandboxing for security
- SafeDocument/SafeElement wrappers for DOM access
- Plugin storage (save-specific and device-specific)
- Custom AI provider support
- Hot reload support for development

See `plugins.md` for comprehensive plugin development guide.

### UI Architecture

- Component-based with Svelte 5
- Responsive design with mobile/desktop variants
- Theme system with custom color schemes
- Multiple UI modes: Classic, WaifuLike, WaifuCut
- Dynamic GUI switching based on viewport
- No traditional router; uses conditional rendering in App.svelte

## Supported AI Providers

- OpenAI (GPT series)
- Anthropic (Claude)
- Google (Gemini)
- DeepInfra
- OpenRouter
- AI Horde
- Ollama
- Ooba (Text Generation WebUI)
- Custom providers via plugins

## Internationalization

Supported languages:
- English (en)
- Korean (ko)
- Chinese Simplified (cn)
- Chinese Traditional (zh-Hant)
- Vietnamese (vi)
- German (de)
- Spanish (es)

Language files are located in `/src/lang/`.

## Deployment Targets

- **Web**: Vite static site
- **Desktop (Tauri)**: Windows (NSIS), macOS (DMG, APP), Linux (DEB, RPM, AppImage)
- **Docker**: Container (port 6001)
- **Self-hosted**: Node.js server

## Security

- Plugin sandboxing with iframe isolation
- DOM sanitization with DOMPurify
- Buffer encryption/decryption utilities
- CORS handling with proxy support
- Tauri HTTP plugin for native fetch

## Documentation

| File | Description |
|------|-------------|
| `README.md` | Main project documentation |
| `plugins.md` | Plugin development guide |
| `AGENTS.md` | AI assistant documentation |
| `src/ts/plugins/migrationGuide.md` | Plugin API migration guide |
| `server/node/readme.md` | Node server documentation |

## Contribution Guidelines

1. Follow the existing coding style and conventions
2. Run `pnpm check` before submitting a pull request
3. Ensure your code is well-tested
4. Format code with Prettier before committing
