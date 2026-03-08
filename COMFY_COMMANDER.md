# Comfy Commander (Core Feature)

Last updated: 2026-03-08

Comfy Commander is a first-class core feature in RisuAI.

## Overview

- `/cw` and `/comfy` are built-in commands.
- Comfy settings, workflows, and templates are managed in core settings.
- Comfy progress uses a dedicated core progress store.
- Plugin-based Comfy Commander is no longer supported.
- Old plugin-managed Comfy data is not migrated by current builds.

## Commands

- `/cw <trigger> [prompt]`
- `/comfy <trigger> [prompt]`

Behavior:

- Command text is swallowed and not appended to chat.
- Template matching is longest-prefix on trigger.
- LLM prompt generation remains prompt-only.
- Generated image is inserted as a `char` message with `{{inlayed::id}}`.

## Settings UI

Open:

- `Settings` -> `Advanced` -> `Comfy Commander`

Available configuration:

- Base URL
- Debug toggle
- Timeout (seconds)
- Poll interval (ms)
- Workflow CRUD (name + API JSON)
- Template CRUD (trigger/prompt/negative/workflow/show-in-chat-menu/button-name)

Templates with `Show in Chat Menu` enabled appear in the chat overflow menu.

## Compatibility

- Comfy Commander now reads and writes only core `comfyCommander` state.
- Legacy plugin storage keys such as `pluginCustomStorage` are obsolete.
- If you still have plugin-era Comfy Commander data in an old save, current builds will not import it automatically.
- Base URL still falls back to legacy `db.comfyUiUrl` defaults where applicable.

## Server proxy contract

Core Comfy networking uses authenticated server proxy only:

- Route: `/data/integrations/comfy/*`
- Request headers:
  - `x-risu-comfy-base`
  - `x-risu-comfy-headers`

Generation flow is unchanged:

1. POST `/prompt`
2. Poll GET `/history`
3. GET `/view`

## Workflow macros

Supported macros in workflow JSON string inputs:

- `{{risu_prompt}}` / `%prompt%`
- `{{risu_neg}}` / `%negative_prompt%`
- `%seed%`
- `%char_avatar%`

## Troubleshooting

- `Comfy Error: No template found.`
  - Verify trigger and template mapping.
- `Comfy Error: Workflow not found.`
  - Template points to a missing workflow id.
- `Comfy Error: ... (403)`
  - Host blocked by server allowlist (`RISU_COMFY_ALLOWED_HOSTS`).
- `Comfy Error: ... (401/403)`
  - Server auth is missing/expired.
