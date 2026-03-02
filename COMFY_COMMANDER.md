# Comfy Commander (Core Feature)

Last updated: 2026-03-02

Comfy Commander is now a first-class core feature in RisuAI.

## What changed

- `/cw` and `/comfy` are built-in commands.
- Comfy settings/workflows/templates are managed in core settings (no plugin iframe).
- Comfy progress uses a dedicated core progress store.
- Existing plugin data is migrated one-time into core state.
- If migration succeeds and the legacy plugin is enabled, the plugin is automatically disabled to prevent duplicate command handlers.

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

## Migration details

One-time migration source:

- `db.pluginCustomStorage.templates`
- `db.pluginCustomStorage.workflows`
- `db.pluginCustomStorage.config`

Migration gates:

- Runs only when plugin presence is detected (`name === "Comfy Commander"`).
- Runs only if `db.comfyCommander.migratedFromPlugin !== true`.

Mapping:

- `config.comfy_url -> comfyCommander.config.baseUrl`
- `config.debug -> comfyCommander.config.debug`
- Plugin-only `use_proxy` / `proxy_auth` are ignored in core.

Fallback seeding:

- Base URL falls back to legacy `db.comfyUiUrl` (or `http://127.0.0.1:8188`).
- If no migrated workflows but legacy `db.comfyConfig.workflow` exists, a `Legacy Workflow` is created.

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
