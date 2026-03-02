# Development Rules & Best Practices (RisuAI)

Last updated: 2026-02-10

## Scope
These rules apply to **core app development** and **plugin development** in this repo.
Core app changes should be tracked in `CORE_CHANGES.md` and planned in `plan.md`.

## Design System Governance (Required for UI Work)
- Follow `DESIGN_SYSTEM_RULES.md` for all UI changes.
- Do not add one-off spacing, radius, color, type, or motion values if a token exists.
- Screen-level UI rewrites must not start before baseline token and primitive contracts are documented.
- If adding a new token or primitive variant, update docs in the same slice.

## Required Workflow
- Maintain a dedicated **plan/progress file** for each plugin.
- **Update the plan/progress file after every code change.**
- Keep docs updated as behavior changes (including UI/UX, errors, and setup).
- Ask before running **client rebuilds** (`pnpm build`, `pnpm tauri build`, etc.).
- After each completed slice, provide **concrete test steps** and wait for confirmation.
- For settings-related slices, run `pnpm check:settings-smoke` and `pnpm check` before manual testing.
- Use a **dev-first cadence** for UI work: validate per-slice in `pnpm dev` with `pnpm check` (and `pnpm check:settings-smoke` for settings slices).
- Run `pnpm build` + `pnpm run runserver` only at **checkpoint slices** (batched), when explicitly requested, or before final server-mode signoff.
- If server-mode behavior is being validated, ensure `dist/` is rebuilt before asking for server-mode manual checks.
- After each baseline slice, update both trackers in the same change:
  - `SETTINGS_REFACTOR_PLAN.md` progress log
  - `UI_BASELINE_MATRIX.md` touched row notes/status

## No Shortcuts, No Compromises

**The correct fix is ALWAYS better than the quick fix. No exceptions.**

- Fix bugs when you find them. If a bug affects the work being done, fix it now. Do not defer it, do not mark it out-of-scope, and do not create a follow-up task unless the fix is genuinely multi-day work and blocked by missing infrastructure.
- Take the correct approach, not the easy one. Technical debt compounds, so always choose the long-term solution.
- Never assume, always verify. Do not trust plans, comments, variable names, or intuition. Read code, docs, and data directly, then cite evidence with file paths and line references where possible.
- "Good enough" is not good enough. If there is a known issue, raise it, investigate it, and fix it.
- The user makes decisions. When there is a tradeoff, present options with evidence and let the user decide.
- Document everything verified. If a formula or behavior is verified, record exactly where it was verified so future sessions can continue without context loss.

## Plugin UI Guidelines
- Plugins use API v3 and run in **sandboxed iframes**.
- The only supported container mode is `fullscreen`; **inline settings UI is not supported**.
- If you want “inline-like” UX, style the fullscreen container to match the settings panel.

## Color Schemes & Theming
- **Color schemes (not themes) define the actual UI colors.** Read them from `db.colorScheme` via `Risuai.getDatabase()` when styling plugin settings.
- **Do not rely on computed styles** from the main document; SafeElement only exposes **inline styles**.
- If you must fall back to CSS variables, read `--risu-theme-*` from inline styles on `html`/`body`.
- For live updates, re-read `db.colorScheme` or poll for changes while the settings UI is open.

## Logging & Debugging
- Log key stages to backend via `/api/plugin-log`:
  - Input prompt to LLM (full text)
  - LLM output (full text)
  - Final payload sent to downstream services (after macro replacement)
- Keep logs tagged with a consistent prefix (e.g., `[Comfy Commander]`).

## Data & Rendering
- For web/dev builds, **insert images as data URLs** to ensure rendering in chat.
- Still save assets for persistence (e.g., `saveAsset`) even if data URLs are displayed.
- Prefer **inlay assets** when available to avoid huge base64 blobs in chat exports.
- Remove empty user/char messages created by intercepted commands.
- When a plugin manages multiple workflows/templates, store **workflows separately** and let templates reference them by ID.

## Prompt Handling
- Support macro replacement consistently.
- If LLMs output `<Thoughts>` / `<thinking>` blocks, strip them before sending to external services.

## Command Handling
- Prefer **prefix matching** for command triggers, using the **longest trigger** when multiple match.
- Commands like `/cw` should not produce any user-visible text; only final output should be inserted.

## Dev Environment Notes
- Firefox cannot use plugin hot‑reload (no File System Access API).
- Chromium supports hot‑reload via “Import plugin with hot reload”.

## Documentation Rules
- Update `COMFY_COMMANDER.md` (or equivalent) after behavior changes.
- Document all dependencies (e.g., Vite proxy, backend server).
- Record troubleshooting steps for common errors (NetworkError, Proxy failures).

## Folder & File Conventions
- Keep plugin source in `src/<plugin_name>.js`.
- Use lowercase file names with underscores (e.g., `comfy_commander.js`).
- Keep plugin‑specific docs alongside root docs (e.g., `COMFY_COMMANDER.md`).
- Each plugin must have a dedicated plan/progress file (e.g., `comfy_commander_plan.md`).

## Metadata & Versioning
- Always include metadata headers at the top:
  - `//@name`, `//@display-name`, `//@api`, `//@version`
- Increment `//@version` for any user‑visible change.
- If you add update distribution, include `//@update-url` and ensure CORS/Range support.

## Error Handling
- Wrap external calls with clear, actionable errors.
- Prefer explicit error messages (e.g., “Enable Use Proxy”) over generic failures.
- Fail gracefully; never leave the UI stuck in a progress state.

## Testing Checklist
- Run `/cw` with a valid template and confirm:
  - No empty user message
  - Image appears in chat
  - Progress indicator appears only during run
- Verify both proxy and direct modes (if applicable).
- Check logging output in backend terminal.
- Validate workflow JSON errors (if any) produce user‑friendly alerts.

## Web → Tauri Validation Checklist
- Web dev loop:
  - `pnpm run runserver`
  - `pnpm dev`
  - Import plugin (Firefox: re‑import after changes)
  - Verify `/cw` works, image renders, no blank message, logs appear
- Tauri validation:
  - Stop Vite
  - `pnpm tauri dev`
  - Re‑import plugin
  - Verify `/cw`, image persistence, settings UI, and proxy behavior

## Performance
- Avoid repeated large JSON parsing in tight loops.
- Prefer small tail‑window cleanup (don’t scan entire chat history).
- Keep logs informative but avoid excessive spam in production mode.

## Security & Sandbox
- Use pluginStorage for plugin state; avoid unsafe globals.
- Don’t access root document unless absolutely necessary.
- Only allow HTTP(S) URLs for external requests; validate if user‑supplied.

## UX Rules
- Commands should not send user‑visible empty messages.
- Progress indicator must appear near input area for long‑running tasks.
- All settings must be reachable and have clear labels.
- For input‑area hamburger actions, use `registerButton({ location: 'chat' })` (not `hamburger`).
- For large lists, use collapsible sections (e.g., `<details>` + summary) to keep settings navigable.
- Avoid full UI re‑renders on each keystroke; update local state and save to storage to **preserve input focus**.

## Account System Removal
- RisuAI account login/sync is removed in all modes.
- Account data is no longer stored or used.
- Realm upload runs without account tokens; account‑gated Realm actions are removed.
- Cold storage sync and Kei auto‑backup are removed.

## Dev Notes
- Vite dependency scan is limited to `src/main.ts` and excludes `JSZip` to avoid errors from `SillyTavern_backup/public/lib/epub.min.js`.

## Release & Update Process
- Update docs and plan/progress file before release.
- Bump `//@version` with a short changelog entry in the plugin doc.
- If distributing updates, verify `//@update-url` is reachable and correct.
