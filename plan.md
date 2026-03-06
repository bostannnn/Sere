# Plan (Single Source of Truth)

Last updated: 2026-03-02

Reference docs: `CONVENTIONS.md` (dev rules), `MOBILE_NAV_PLAN.md` (mobile IA), `plugins.md`, `COMFY_COMMANDER.md`, `docs/CODE_REVIEW_REMEDIATION_CHECKLIST.md` (ticketized post-review fixes)
Archived docs: `docs/archive/` (old plans, baselines, trackers — kept for reference)

---

## Agent Bootstrap Dependency (Mandatory)

- `CONVENTIONS.md` is mandatory pre-read for every new feature/rewrite slice.
- Before coding starts, agent must review `CONVENTIONS.md` and apply it as the default rule set.
- If a slice intentionally defers a convention in touched code, add a dated deferral note in `plan.md`.
- If `plan.md` and `CONVENTIONS.md` conflict, `CONVENTIONS.md` wins unless an explicit, dated exception is documented in this plan.

---

## Current State

## Strict Debt Progress (2026-03-01)

- CR-005 tranche completed for:
  - `src/ts/translator/bergamotTranslator.ts`
  - `src/ts/translator/translator.ts`
  - `src/ts/process/tts.ts`
  - `src/lib/Others/RulebookManager/RulebookLibrary.svelte`
- Tranche strict diagnostics reduced to zero in these files.
- Repo strict baseline improved under ratchet: `915 -> 848` errors (`pnpm run check:strict:ratchet`).
- Validation pass set:
  - `pnpm run check:strict:ratchet`
  - `pnpm run check:server`
  - `pnpm run check:server:contracts`
  - `pnpm test`

**What works:**
- Server-first storage with ETag conflict handling
- OpenRouter LLM execution via server (`/data/llm/execute`, streaming + non-streaming)
- RAG infrastructure: PDF ingestion, chunking, embedding, semantic search, all server endpoints
- RAG UI: RulebookLibrary (ingest/manage), RulebookRagSetting (per-char config), GameStateHUD, GameStateEditor
- HypaV3 memory system (periodic summarization, salience-based recall)
- Lorebook (keyword/regex matching, client-side)
- Settings pages standardized, dead routes removed
- Account system fully removed
- Plugin system (API v3, sandboxed iframes)
- Comfy Commander core feature (`/cw`, `/comfy`, migrated from plugin storage)

**What's broken or disconnected:**
- PDF chunking quality — clean selectable text gets mangled into pipe-delimited gibberish
- DevTool panel stuck in old hidden sidebar
- Legacy `/api/*` endpoints retired with 410 responses; replacements are under `/data/*`

---

## Immediate Audit Queue (2026-02-20)

Goal:
- Run a full dead-code + broken-feature review across server-first runtime paths.
- Use `pnpm run check:server` as a mandatory gate and triage all findings.

Execution:
1. Run `pnpm run check:server` and capture failures/warnings.
2. Correlate check output with code-level review findings (dead paths, stale imports, unreachable runtime branches, route mismatches, persistence regressions).
3. Produce prioritized fix list with file/line references and fix plan.

## Isolation Track — Memory vs Chat (Planned, Do Later)

Goal:
- Fully isolate memory summarization format from live chat generation so summary schema (`Entry Title / Keywords / Content`) can never leak into normal assistant replies.

Scope:
1. Server-side memory sanitization before prompt injection:
   - Normalize/remove summary labels and wrappers from memory entries before they are inserted into `/data/llm/generate` prompt context.
   - Treat memory as plain factual context only, not output schema guidance.
2. Local/client parity:
   - Apply equivalent sanitization in client-side HypaV3 path to keep behavior aligned in non-node/local execution modes.
3. Guardrails and tests:
   - Add regression coverage that fails if memory prompt payload still contains summary-schema labels.
   - Add coverage that ensures normal chat replies are not formatted as memory entries due to memory injection.
4. Runtime observability:
   - Add explicit log markers for memory-injection sanitization results (counts/shape, no content leak) to simplify future debugging.

Acceptance criteria:
- Chat response after memory injection is narrative reply (not summary template) in both server and local paths.
- Memory summaries remain stored and retrievable for recall features.
- Contract checks/tests fail on schema bleed regressions.

## Docker Deploy Follow-up (Planned, Do Later)

Goal:
- Add explicit env-driven server password bootstrap flow for containerized unattended setup.

Scope:
1. Add startup env contract (for example `SERE_SERVER_PASSWORD` and/or hash variant) with one-time initialization semantics.
2. Define idempotent behavior: set password only when missing, never overwrite existing configured password silently.
3. Add server contract tests for bootstrap path + restart behavior.
4. Document secure usage and secret handling in Docker/README docs.

---

## UI Redesign Program (2026-02-17)

Canonical spec: `docs/UI_SYSTEM_REDESIGN_RFC.md`
Core scope spec: `docs/CORE_PRODUCT_SPEC.md`

Goal:
- Converge Characters, Chats, Library (RAG), Playground, and Settings into one coherent app-shell model and shared interaction contract.

Program slices:
1. Shell + canonical route store.
2. Characters/Chats convergence on shared workspace primitives.
3. Library convergence (rulebooks + RAG workflows).
4. Playground convergence.
5. Settings convergence.
6. Legacy navigation/overlay path removal + regression gates.

Gate:
- No partial surface rewrites without route-contract compatibility and workspace parity checks from the RFC.

### UI Checklist Execution Backlog (Phase 0/1)

Status:
- Decisions locked (2026-02-21): IA/tab order, landing workspace, last-chat behavior, chat-only inspector, unified library surface, full playground toolset, single-workspace settings, staged flag rollout.
- Remaining work is implementation + validation from `docs/CONCEPT_COMPLETION_CHECKLIST.md`.
- Phase gate policy: every UI migration phase must ship both unit-style contract checks and runtime smoke checks before sign-off.
- Shell composition policy: keep `/Users/andrewbostan/Documents/RisuAII/src/App.svelte` orchestration-only; extend `/Users/andrewbostan/Documents/RisuAII/src/lib/UI/AppShellV2.svelte`, `/Users/andrewbostan/Documents/RisuAII/src/lib/UI/AppShellTopbar.svelte`, and `/Users/andrewbostan/Documents/RisuAII/src/lib/UI/AppShellStage.svelte` (or new focused shell components) for UI surface growth.
- Migration phase sequence update (2026-02-24): inserted dedicated mobile focus as Phase 5; deferred theme/background is now Phase 6 (see `docs/MIGRATION_PLAN.md`).

Immediate Slice 1 tasks (start now, no behavior changes):
- [x] S1.1 Add `ui_shell_v2` feature-flag plumbing and persisted toggle state.
- [x] S1.2 Add canonical app-route store (`workspace`, `selectedCharacterId`, `selectedChatId`, `inspector`).
- [x] S1.3 Sync canonical route from current runtime stores in `App.svelte`.
- [x] S1.4 Enforce workspace-switch transient overlay cleanup contract.
- [x] S1.4b Add dev-visible shell flag badge (`ui_shell_v2: ON/OFF`) for QA verification.
- [x] S1.4c Wire topbar rail/sidebar toggles to existing `ChatScreen` panels via controlled props (UI transplant only, no feature logic changes).
- [x] S1.5 Add lightweight runtime smoke for workspace transitions and overlay-clear behavior.

Clean transplant sequence (UI-only, behavior-parity):
1. Shell frame scaffolding:
   - top title bar/chrome container under `ui_shell_v2`
   - preserve existing view routing and content mounts
2. Left/global sidebar rail:
   - transplant visual wrapper only
   - keep existing navigation callbacks/state
3. Home/library/playground/settings wrappers:
   - transplant shell composition around existing internals
   - no feature or logic mutations
4. Right workspace sidebar host:
   - mount existing `SideChatList` + `CharConfig` in new wrapper
   - preserve all existing actions and field wiring
5. Primitive/token convergence + legacy shell cleanup:
   - remove duplicate wrappers only after parity smoke passes

Phase 4 primitive convergence matrix (initial pass, 2026-02-24):

| Primitive | Current adoption | Target surfaces (Phase 4) | Status |
|---|---|---|---|
| `panel-shell` | Home card/empty states use class but no production definition existed | Home cards, launcher/list panels, settings cards where applicable | In progress (definition + side-chat-list folder-card + char-config card/icon-gallery/group-grid + grid-catalog + bookmark-list + game-state-hud cards + trigger-v2 editor/edit panels + lorebook-data detail/folder panels + prompt-data card + settings/rulebook-rag card + request-log modal/card + chat character-catalog overlay panel + chat asset media tiles + chat creator-quote card + model list panel + Hypa modal dropdown panel + Hypa category modal + Hypa bulk-action shell + Hypa summary item root + Hypa tag manager modal + rulebook-library sidebar/main/book/staging/status shells + game-state-editor root/table/add-row shells adoption landed; item 1 surface closure complete) |
| `control-field` | Partial `ds-ui-input` usage; primitive alias missing | Topbar search, settings controls, chat-side fields (composition alias only; no behavior change) | In progress (topbar + rulebook library + grid-catalog + module settings/chat search + mobile-header search + shared GUI TextInput/NumberInput/SelectInput/TextAreaInput/TextAreaResizable base classes + chat composer/translate composed selectors + chat cardboard editor + sidebar toggles text/select controls + Hypa bulk-resummary textarea + Hypa category input + Hypa bulk select/input + Hypa footer preview textarea + Hypa summary textareas + Hypa tag manager inputs + game-state-editor add/value inputs adoption landed) |
| `control-chip` | Ad-hoc chip styling in multiple surfaces | Tag/chip-like controls (settings, char config, lorebook utility rows) | In progress (rulebook library badges + drawer footer + game-state-hud chips + settings plugin/preset chips + prompt-diff status/no-change chips + request-log status/meta chips + Hypa summary/tag/chatmemo chips adoption landed) |
| `icon-btn` | Multiple duplicate icon-button patterns (`ds-*`, feature-local) | Topbar icon buttons, card action menus, sidebar action icons | In progress (topbar + lorebook setting/actions + lorebook row actions + side-chat-list + chat-list modal actions + preset modal actions + char-config action/utility + grid-catalog + bookmark-list + suggestion actions + module settings/chat icon actions + settings close controls + prompt icon actions + prompt-data header actions + trigger-v1 add + trigger-v1/regex item controls + trigger-list mode controls + mobile-header buttons + mobile-body devtool toggle + mobile-footer nav controls + mobile-characters FAB + chat asset add button + chat creator-quote close control + chat generation-info actions + model list trigger/back/options + shared GUI IconButton base + quick-settings icon tabs + prompt-diff close action + request-log close/copy icon actions + Hypa modal header/dropdown + Hypa bulk-resummary actions + Hypa category icon controls + Hypa bulk important toggle + Hypa summary action icons + Hypa tag manager icon controls + rulebook-library view/book/staging icon controls + game-state-editor row/add icon controls + side-chat-list aria-labeled icon actions adoption landed; item 1 surface closure complete) |
| `seg-tabs` / `seg-tab` | Many segmented controls use feature-local classes | Topbar character Active/Trash, lorebook/config/settings tab strips | In progress (topbar + lorebook + settings-subtabs + char-config + chat-right-sidebar-host tab strips + mobile-sidepanel topbar strip + mobile-root-nav strip + quick-settings + multilang input/display + prompt-diff pill groups + rulebook-library view-mode toggle adoption landed; item 1 surface closure complete) |
| `list-shell` | Feature-local list shells (`ds-settings-list-shell`, lorebook/rag containers) | Settings/module lists, lorebook/rag lists, reusable list containers | In progress (alias + settings/module + drawer recent-shell + lorebook + lorebook-data nested list + rulebook-rag + side-chat-list + trigger-v1 list + trigger-v2 trigger/effect lists + sidebar toggles scroll shell + mobile-characters list-shell + request-log list-shell + Hypa category list-shell + Hypa tag manager list-shell + rulebook-library system/content/staging lists + game-state-editor table shell adoption landed; item 1 surface closure complete) |
| `empty-state` | Feature-local empty-state classes | Home/settings/library empty containers | In progress (alias + settings/module/library + drawer + lorebook + rulebook-rag + side-chat-list + char-config-empty + trigger-v1 empty-state + regex-list empty-state + bookmark-list empty-state + mobile-characters empty-state + request-log empty-state + Hypa category empty-state + Hypa tag manager empty-state + game-state-editor empty row + side-chat-list global zero-chat empty state adoption landed; item 1 surface closure complete) |
| `action-rail` | `ds-ui-action-rail` exists; plain primitive missing | Chat row actions, sidebar/list row actions, utility action groups | In progress (alias + chat/chat-list + chat-cardboard action rail + default-chat floating plugin-action rail + mobile-header actions + grid-catalog + bookmark-list + rulebook-rag + side-chat-list row/footer + char-config action-row + lorebook setting/folder actions + trigger-v1 actions + trigger-v2 toolbar + prompt-data header actions + sidebar toggles rows/dividers + chat asset rail + settings/module/provider/preset/core settings action rows + request-log header action rows + Hypa modal header/dropdown + Hypa bulk-resummary actions + Hypa category header actions + Hypa bulk action rows + Hypa summary action rows + Hypa tag manager add-row actions + rulebook-library toolbar/book/edit/staging rows + game-state-editor header/add rows adoption landed) |
| `ds-ui-menu` / `ds-ui-menu-item` | Menu styles were ad-hoc (home card + popup) | Card context menu, popup menu, future drawer/list context actions | In progress (definition + first adopters + shared TextAreaInput autocomplete menu/item composition landed; danger-item contrast/readability hardening landed) |

- Progress (2026-02-28): all-surface Phase 4 coverage scaffold landed via `dev/check-phase4-surface-coverage.js` and `dev/check-ui-shell-smoke.js`; coverage now enforces owner/classification metadata (`migrate`/`infra`) with rationale for dormant infra surfaces and closes prior uncovered `src/lib` representation gap (`57 -> 0` under contract accounting across `136` total `src/lib` Svelte surfaces).
- Progress (2026-02-28): item 1 decision closure completed for all previously unresolved surfaces (`38 verify -> 30 migrate + 8 infra`), `dev/check-phase4-surface-coverage.js` now rejects any `verify` classification, and full gates passed on closure slice (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`); `Chats.svelte` remains infra-classified to preserve reverse-scroll chat runtime behavior.

Checklist-to-task map for remaining required gates:
- Home Screen (`§2`): finalize portrait card structure, search behavior, card states, last-chat summary truncation.
  - Progress (2026-02-27): home-directory empty-state primitive + no-results/trash-empty runtime coverage + stale-menu cleanup and Escape-close behavior landed.
  - Progress (2026-02-28): home-directory action-menu semantics hardened (`HomeCharacterDirectory.svelte`) with explicit menu trigger/item button semantics (`type`, `aria-haspopup`, `aria-expanded`, `aria-controls`, item labels/titles) and runtime/contract coverage updates (`dev/home-character-directory-runtime-smoke.test.ts`, `dev/check-ui-shell-contract.js`); gates passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Chat Runtime (`§3`): finalize bubble token surfaces, composer/header behavior, long-chat scroll/sticky stability.
  - Progress (2026-02-27): `DefaultChatScreen` now has explicit icon-control button semantics (`type="button"` + labels/titles), and runtime smoke coverage now asserts fixed-composer (`ds-chat-composer-shell-fixed`), top-bar jump-button mode, long-input send/reset flow, and composer menu open/close stability.
  - Progress (2026-02-27): `DefaultChatScreen` overflow side-menu now composes `panel-shell ds-ui-menu` and uses explicit `button` menu items (with `type="button"` + `aria-disabled`/`aria-pressed` state attributes) with contract + runtime smoke assertions.
  - Progress (2026-02-28): `DefaultChatScreen` jump-button variants now carry explicit `title`/`aria-label` semantics, composer overflow trigger now exposes deterministic menu semantics (`aria-haspopup`, `aria-expanded`, `aria-controls`), side-menu container now declares stable menu semantics (`id`, `role`, `tabindex`), and invalid nested-button markup in load-more row was removed (`div` wrapper + inner `Button` only), with contract/runtime coverage updates.
  - Progress (2026-02-28): added `default-chat-screen-integration-runtime-smoke` with real `Chats`/`Chat` mounting (non-service stubs only) to cover long-content message/header/action rendering plus fixed-composer send/menu stability on the integrated chat path.
  - Progress (2026-02-28): added direct `Chats.svelte` stack regression coverage (`dev/chats-stack-runtime-smoke.test.ts`) for reverse-order rendering, `loadPages` windowing, folded-index paging window behavior, and reload-pointer refresh stability, and wired it into `dev/check-ui-shell-smoke.js` to prevent future regressions to chat history ordering/visibility semantics.
  - Progress (2026-02-28): chat generation-info long-model overflow regression hardening updated (`styles.css`) so gen-info buttons use bounded width and flex-truncating labels (`.ds-chat-geninfo-button`, `.ds-chat-geninfo-label`) to prevent wrapped/overlapping model labels in narrow chat rows.
  - Progress (2026-02-28): Phase 4 gate rerun for this chat-runtime slice passed (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`).
  - Progress (2026-02-27): `HypaV3Modal` main surfaces now compose shared primitives (`panel-shell`, `control-chip`, `control-field`, `icon-btn`, `empty-state`) for convert/search/manual/debug states with contract + runtime smoke coverage.
  - Progress (2026-02-27): `HypaV3Modal/modal-summary-item` connected-message collapse control now composes `control-chip`, and icon-only summary actions now use explicit button semantics/labels (`type` + `title` + `aria-label`) with runtime + contract assertions.
  - Progress (2026-02-27): chat-adjacent primitive/semantics pass landed for `CreatorQuote`, `Suggestion`, `AssetInput`, `GridCatalog`, `ChatList`, `BookmarkList`, `PromptDataItem`, and `PromptDiffModal` (explicit `type="button"`/labels/toggle ARIA + keyboard parity updates) with runtime + contract coverage.
  - Progress (2026-02-27): cardboard theme chat action container now composes `ds-chat-cardboard-actions action-rail` with contract + runtime coverage.
  - Progress (2026-02-27): `DefaultChatScreen` floating plugin action cluster now composes `ds-chat-floating-actions action-rail` with runtime + contract coverage.
  - Progress (2026-02-27): chat header/gen-info long-label regression hardening landed (`Chat.svelte` + `styles.css`) via constrained title text + model label truncation (`ds-chat-message-title-text`, `ds-chat-message-action-rail`, `ds-chat-message-action-inner`, `ds-chat-geninfo-label`), with runtime regression coverage in `dev/chat-message-actions-runtime-smoke.test.ts`; gates passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Right Sidebar (`§4`): finalize open/close/re-click behavior, tab-strip mode contract, layer hierarchy, per-tab section completeness.
- Progress (2026-02-27): RulebookLibrary + GameStateEditor primitive composition slice landed (shared panel/list/action/tab/empty/icon contracts + runtime smoke coverage).
- Progress (2026-02-27): `CharConfig` icon/segment action controls now include explicit `type="button"` + `title`/`aria-label` labeling (group talk segments, display asset actions, scripts actions, advanced list actions).
- Progress (2026-02-27): global + workspace sidebars now mount as slide-in drawer layers (left `GlobalLauncher` + right chat inspector wrapper) with distinct drawer elevation/skin classes and non-behavioral shell composition parity checks.
- Progress (2026-02-28): right inspector layer linkage now uses deterministic drawer identity (`chat-right-sidebar-drawer`) and topbar toggle semantics (`aria-controls` + `aria-expanded`) so open/close state is explicitly wired to the inspector layer; contract/runtime coverage updated (`dev/check-ui-shell-contract.js`, `dev/check-chat-sidebar-contract.js`, `dev/ui-shell-runtime-smoke.test.ts`, `dev/chat-sidebar-runtime-smoke.test.ts`) and gate rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Tab Coverage (`§5`): verify each required tab has represented sections matching current app feature surface.
- Progress (2026-02-27): chat-sidebar integration smoke now asserts full `CharConfig` tab ID set for character mode and restricted tab ID set for group mode.
- State & Edge Cases (`§6`): zero chats, 100+ chats, long content, no-results flows, last-chat fallback rules.
  - Progress (2026-02-27): right-sidebar chat host now has explicit zero-unfoldered-chat empty-state coverage via `side-chat-list` runtime smoke.
  - Progress (2026-02-27): home-directory runtime smoke now covers no-results and 100+ character-list rendering/regression paths.
  - Progress (2026-02-28): chat-sidebar integration runtime now includes dense `100+` chat coverage for real `SideChatList` mounting (`120` rows) with selection/click assertions and global-empty-state regression checks (`dev/chat-sidebar-integration-runtime-smoke.test.ts`); full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Responsive (`§7`): desktop/laptop/tablet validation + mobile drawer/tab/composer behavior.
- Progress (2026-02-27): RulebookLibrary now includes responsive stacked layout breakpoints (`980px` / `720px`) for header/sidebar/toolbar/staging/status shells.
- Progress (2026-02-27): right inspector drawer now uses fixed topbar-offset drawer sizing (`clamp(280px, 24vw, 360px)` + `1279px` breakpoint variant) to preserve desktop/laptop overlay behavior without shifting chat layout.
- Progress (2026-02-27): mobile sidepanel topbar (`MobileBody`) and mobile root/character nav (`MobileFooter`) now expose explicit tab-button semantics (`type`, title/label, pressed-state attributes) with runtime + contract coverage.
- Progress (2026-02-28): chat sidebar responsive lifecycle now includes explicit desktop-reopen coverage after tablet collapse (`dev/chat-sidebar-runtime-smoke.test.ts` + `dev/test-stubs/ChatScreenVisibilityProbe.svelte`), validating that `rightSidebarOpen` collapses at `<1024px`, stays closed when width returns, and only reopens after explicit user action; gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Interaction Consistency (`§8`): deterministic button behavior, scrim/overlay parity, Esc-close, focus order, active-state pattern consistency.
  - Progress (2026-02-27): `side-chat-list` icon actions now share Enter/Space keyboard activation helper and explicit icon `aria-label` coverage.
  - Progress (2026-02-27): shared `IconButton` now carries `aria-label`/`title`/`aria-pressed`/`type` attributes and RulebookLibrary/GameStateEditor icon-only controls now declare explicit accessible labels.
  - Progress (2026-02-27): `CharConfig` action buttons now use explicit accessible labels/titles and group talk-segment controls use deterministic labeled activation targets.
  - Progress (2026-02-27): `Chat.svelte` action controls now consistently declare explicit `button` semantics (`type`, `title`, `aria-label`, and `aria-pressed` where toggle-like), including translate/edit/bookmark/reroll/branch/role-toggle controls with runtime + contract coverage.
  - Progress (2026-02-27): chat list rows, bookmark expand rows, and prompt data headers now expose explicit keyboard/ARIA semantics while preserving existing handlers, and prompt-diff close control now carries explicit close labeling semantics.
  - Progress (2026-02-27): mobile header, lorebook row/folder actions, regex list actions, trigger-v2 effect/add controls, and model-list trigger/options now enforce explicit `type="button"` + title/label semantics with contract + runtime smoke coverage.
  - Progress (2026-02-27): lorebook setting tabs/actions, trigger-list mode tabs, trigger-v1 inline controls, regex-data toggle/flag controls, and mobile character row/fab controls now enforce explicit icon/button semantics (`type`, title/label, and pressed-state where segmented) with runtime + contract smoke coverage.
  - Progress (2026-02-27): `Settings.svelte` top-level nav, `GlobalLauncher.svelte` workspace/recent/menu controls, and `TriggerV2List.svelte` context/toolbar/trigger/category/type controls now enforce explicit semantics (`type`, `title`/`aria-label`, `aria-pressed` for active states where applicable), with contract + runtime coverage updates.
  - Progress (2026-02-27): Phase 4 gate rerun for this slice passed (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`).
  - Progress (2026-02-28): `AlertComp.svelte` now applies explicit button semantics across request-data/hypa/add-char/chat-options/card-export/branch/request-log controls (`type`, `title`/`aria-label`, `aria-expanded`, `aria-pressed`), and `CharConfig.svelte` display subtabs/icon-tile controls now expose deterministic `type`/label/pressed semantics; contracts + runtime smokes updated (`dev/check-ui-shell-contract.js`, `dev/check-charconfig-rulebook-contract.js`, `dev/alert-requestlogs-runtime-smoke.test.ts`, `dev/chat-sidebar-integration-runtime-smoke.test.ts`) and full gates passed (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`).
  - Progress (2026-02-28): remaining raw-control semantics slice for shared/legacy surfaces landed (`Help.svelte`, `HypaV3Progress.svelte`, `PluginAlertModal.svelte`, `PlaygroundMenu.svelte`, `MainMenu.svelte`, `HotkeySettings.svelte`, `Accordion.svelte`, `GUI/Button.svelte`, `BaseRoundedButton.svelte`, `NewGUI/Button.svelte`, `PopupButton.svelte`), plus runtime verification in `dev/button-primitives-runtime-smoke.test.ts`; full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`).
  - Progress (2026-02-28): shell/settings interaction semantics hardening landed for top-level shell and shared settings subtabs (`AppShellTopbar.svelte`, `SettingsSubTabs.svelte`) with explicit `type="button"` semantics plus pressed/label metadata (`aria-pressed`, `title`, `aria-label`) and contract/runtime updates (`dev/check-ui-shell-contract.js`, `dev/check-settings-shell.js`, `dev/ui-shell-runtime-smoke.test.ts`, `dev/settings-runtime-smoke.test.ts`, `dev/test-stubs/SettingsTabbedStub.svelte`); full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`).
  - Progress (2026-02-28): home character-card context menu now exposes deterministic menu semantics and explicit button metadata for trigger/actions (`aria-haspopup`/`aria-expanded`/`aria-controls`, menu item labels/titles, explicit `type`) with runtime assertions for expanded-state transitions and menu wiring; gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
  - Progress (2026-02-28): chat inspector toggle semantics now include explicit expanded/controls linkage to the right drawer layer id (`chat-right-sidebar-drawer`) and runtime coverage catches linkage regressions; `BindableFieldStub` was hardened to accept undefined bind targets without `props_invalid_value` crashes during charconfig integration smoke, and full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
  - Progress (2026-02-28): global nav rail toggle now exposes explicit expanded/controls linkage to `global-navigation-rail` across shell-hosted and chat-hosted launcher mounts (`AppShellTopbar.svelte`, `AppShellV2.svelte`, `AppShellStage.svelte`, `ChatScreen.svelte`, `GlobalLauncher.svelte`), with contract/runtime coverage updates (`dev/check-ui-shell-contract.js`, `dev/check-chat-sidebar-contract.js`, `dev/ui-shell-runtime-smoke.test.ts`, `dev/global-launcher-runtime-smoke.test.ts`, `dev/chat-sidebar-runtime-smoke.test.ts`) and full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
  - Progress (2026-02-28): `SideChatList` row/footer/new-chat controls now explicitly declare `type="button"` semantics (including shared `Button` wrapper passthrough usage), with contract/runtime coverage updates (`src/lib/SideBars/SideChatList.svelte`, `dev/check-chat-sidebar-contract.js`, `dev/chat-sidebar-integration-runtime-smoke.test.ts`, `dev/test-stubs/ComponentActionButtonStub.svelte`) and full gates rerun passed (`pnpm run check:ui-shell-smoke`, `pnpm check`).
- Definition of Done (`§10`): final walkthrough evidence + sign-off metadata.
  - Current sign-off evidence logs: `docs/UI_PHASE1_SIGNOFF.md`, `docs/UI_PHASE2_SIGNOFF.md`, `docs/UI_PHASE3_SIGNOFF.md`.
  - Progress (2026-02-28): Phase 4 closure sign-off draft added in `docs/UI_PHASE4_SIGNOFF.md` with final gate evidence (`pnpm run check:ui-shell-smoke`, `pnpm check`, `pnpm run check:settings-smoke`) and contract closure evidence (`node dev/check-phase4-surface-coverage.js`).
  - Progress (2026-02-28): Phase 4 checklist sections `§2`, `§3`, `§4`, `§5`, `§6`, `§7`, `§8`, and `§10` are complete for migration scope (UI transplant/composition + regression hardening only, no feature redesign), pending explicit owner approval for final Phase 4 PASS.

---

## Codebase Risk Register (2026-02-16)

### Priority problems (actual high-risk debt)

1. **Critical security risk: plugin execution still uses dynamic code evaluation.**
   - `src/ts/plugins/plugins.svelte.ts` (`new Function`, `eval`)
   - `src/ts/plugins/apiV3/factory.ts` (`eval`)
   - Impact: untrusted plugin execution can escape intended sandbox boundaries.

2. **Critical security risk: markdown-to-DOM conversion includes direct HTML insertion path.**
   - `src/ts/parser.svelte.ts` (`span.innerHTML = markdown` in `applyMarkdownToNode`)
   - Impact: XSS risk if sanitization assumptions drift or inputs bypass expected path.

3. **Post-decomposition server consistency risk.**
   - `server/node/server.cjs` has been decomposed (now bootstrap-focused); risk moved to consistency across extracted route/service modules.
   - Remaining hotspots:
     - mixed response helper usage (`res.send` vs `sendJson`) across route modules
     - expiring async-handler suppression debt (`ERR-001` in legacy/content/storage routes)
     - large-route/service slices that still need incremental splitting
   - Impact: behavior drift and contract inconsistency risk across server endpoints.

4. **LLM request pipeline monoliths are hard to evolve safely.**
   - `src/ts/process/request/request.ts`
   - `src/ts/process/request/openAI.ts`
   - `src/ts/process/request/google.ts`
   - `src/ts/process/request/anthropic.ts`
   - Impact: provider parity bugs and migration friction.

5. **Core quality gates are not green.**
   - Typecheck failures:
     - `src/lib/SideBars/DevTool.svelte`
     - `src/lib/Others/RulebookManager/RulebookLibrary.svelte`
   - Test environment failures:
     - `src/ts/platform.ts` (`__RISU_DEV_NODE_SERVER__` in tests)
     - `src/ts/process/mcp/risuaccess/tests/modules.test.ts` (mock hoisting/import cycle failure)

6. **State management inconsistency + direct DOM state reads/writes.**
   - `src/ts/stores.svelte.ts` (mixed runes + writable + DOM writes)
   - `src/lib/Others/AlertComp.svelte` (`document.querySelector(...).value`)
   - Impact: hidden coupling and runtime fragility.

7. **Type-safety debt is materially high.**
   - 400+ `any` usages across src/server paths.
   - Impact: refactor risk and runtime schema drift.

### Rewrite ASAP (execution order)

1. **Plugin runtime hardening**
   - Remove `eval/new Function` execution path from plugin runtime and move to strictly isolated execution boundary.

2. **Parser/render sanitization hardening**
   - Remove unsafe `innerHTML` insertion path in parser flow; enforce sanitize-at-render for all HTML sinks.

3. **Server consistency hardening after decomposition**
   - Keep `server/node/server.cjs` bootstrap-only and continue normalizing extracted route/service modules (error shape, response helpers, file-size limits).

4. **Request-layer decomposition**
   - Split provider-specific request handling from shared transport/validation/retry logic.

5. **Green baseline first**
   - Make `pnpm check` + `pnpm test` pass and keep them passing before large refactors continue.

### Rules to enforce ASAP (ratchet, not big-bang)

- **No `eval()` / `new Function()` in production code paths.**
- **No unsanitized `innerHTML` / unsafe `{@html}` usage.**
- **No new `any`, `as any`, `@ts-ignore`, `@ts-nocheck` in touched lines.**
- **No new files over 500 LOC; touched files over 800 LOC must be split in follow-up slices.**
- **`pnpm check` and `pnpm test` must pass before merge.**
- **No direct DOM queries for application state flow (`document.querySelector` for value/state).**
- **No new core-app use of legacy `/api`, `/proxy`, `/proxy2` endpoints.**

---

## P0 — Fix What's Broken

### 1. RAG end-to-end (server-side)

**Goal:** User enables RAG on a character, sends a message, server searches rulebooks and injects context, AI uses it.

a) ~~**Wire RulebookRagSetting into CharConfig**~~ — DONE (shipped in P2 sidebar migration)
   - File: `src/lib/SideBars/CharConfig.svelte`
   - Import `RulebookRagSetting`, add it inside LoreBook tab (`$CharConfigSubMenu === 3`) after `<LoreBook />`
   - Behavior: Lorebook controls remain in `LoreBook`, Rulebook RAG now renders directly in the same CharConfig section without duplicated inner rulebook tab.

b) ~~**Send ragSettings in LLM payload**~~ — DONE (confirmed in logs)

c) ~~**Remove hardcoded VtM instruction — inject raw data only**~~ — DONE

d) ~~**Fix non-streaming newCharEtag propagation**~~ — DONE (both streaming and non-streaming paths return it)

e) ~~**Sync gameState back to client after server updates**~~ — DONE (`syncGameStateFromServer()` called in both paths)

f) ~~**Fix RAG query — sliding window**~~ — DONE (last 3 non-system turns instead of single user message)

### 2. ~~Fix logging~~ — DONE

All logging was already implemented and working:
- Client-side request logs: `fetchLog` populated in all server execution paths (preview, streaming, non-streaming)
- Server-side durable logs: `appendLLMAudit` calls on all RAG and LLM endpoints
- UI: Settings → Advanced → Show Request Logs shows both client and server logs with expand/collapse, copy, metadata badges
- RAG metadata (`_ragMeta`) attached to LLM execution logs

### 3. ~~Clean up server debug logging~~ — N/A

Debug logs in `engine.cjs` were already gated behind `RISU_DEBUG=1`. Terminal logs in RAG/PDF/embedding are operational (not debug spam).

### 4. Export/Import regression automation

**Goal:** Automatically catch character export/import regressions (asset/image edge cases) during migration.

- Add Playwright CLI smoke script for:
  - export character (`png`, `json`, `charx`)
  - re-import exported file
  - verify avatar/image renders and no runtime error modal appears
- Wire this as a documented migration gate in `docs/MIGRATION_SMOKE_CHECKLIST.md`
- Keep API smoke pack (`dev/run-migration-smoke-pack.js`) as mandatory precheck

### 5. Data durability backlog (scheduled later)

- Add server-side backup snapshots with retention/TTL for:
  - settings
  - characters
  - chats
  - assets
- Consider splitting plugin runtime settings from `settings.json`:
  - move `pluginCustomStorage` to file-backed per-plugin state (e.g. `/data/plugins/state/<plugin-id>.json`)
  - keep backward-compatible read fallback to `settings.json` during migration
  - add one-time migration + rollback strategy
- Evaluate/implement character directory naming migration from `<characterId>` to `<name>-<id>` with:
  - safe slugging
  - collision handling
  - rename-on-name-change policy
  - backward-compatible lookup/migration for existing folders

### 6. Emotion detection reliability research

**Goal:** Verify that emotion-image selection is functionally correct and stable after server-side migration.

- Build a small reproducible evaluation set:
  - chat snippets with expected emotion label(s)
  - edge cases (sarcasm, mixed emotions, neutral fallback)
- Compare both emotion paths:
  - `emotionProcesser: submodel`
  - `emotionProcesser: embedding`
- Add lightweight diagnostics for emotion selection runs:
  - selected label
  - whether fallback path was used
  - model/provider/mode metadata
- Define acceptance threshold before rollout:
  - mismatch/fallback rate targets
  - no silent failures in aux path when `chatId`/context is missing

---

## P1 — Server-First Migration

**Goal:** Move all LLM execution and prompt processing to the server. Client becomes a thin UI that sends user input and renders responses. Like SillyTavern.

**Current state:** OpenRouter + OpenAI + DeepSeek + Anthropic + Google + Mistral + Cohere + Ollama + Kobold + NovelAI + Horde + Ooba + Reverse Proxy + Custom (`xcustom:::`) are server-side. Client still builds the full prompt/messages array in B1, and server injects RAG context + executes with server-side keys.

**Strategy:** Incremental migration in 4 phases. Each phase is independently testable and shippable.

### Server-side Rewrite Completion Checklist (strict)

- [x] Remove `useClientAssembledRequest` passthrough for normal `mode=model` `/data/llm/generate` calls.
- [x] Split server prompt pipeline into dedicated modules:
  `server/node/llm/prompt.cjs`, `server/node/llm/tokenizer.cjs`, `server/node/llm/lorebook.cjs`, `server/node/llm/scripts.cjs`.
- [x] Make `/data/llm/generate` the default node-server path for model mode with no client prompt assembly dependency.
- [x] Keep `/data/llm/execute` focused on raw execution modes (`memory`, `emotion`, `submodel`) and explicit internal tasks.
- [x] Move manual HypaV3 summarize/resummarize operations to server-owned endpoints (not client-side summarize calls).
- [x] Add memory trace visibility equivalent to generate trace (`/data/llm/generate/trace`) for manual/periodic summary runs.
- [x] Remove or retire legacy `/api/*` endpoints after dependency audit.
- [x] Remove or retire legacy reverse-proxy compatibility endpoints after migrating remaining client callers (`/proxy` retired; no active `/proxy2` runtime route/caller in core app paths).
- [x] Run end-to-end migration verification checklist and record pass/fail evidence in `SESSION_SUMMARY.md`.

---

### Server Decomposition Slices (Execution)

- [x] Slice A (part 1): extracted LLM route registration from `server/node/server.cjs` into `server/node/routes/llm_routes.cjs` with parity behavior (`/data/llm/execute`, `/data/llm/generate`, `/data/llm/generate/trace`, `/data/llm/logs`, `/data/openrouter/models`).
- [x] Slice A (part 2): extracted HypaV3 memory route group into route modules (`server/node/routes/memory_routes.cjs`, `server/node/routes/hypav3_trace_routes.cjs`, `server/node/routes/hypav3_manual_routes.cjs`, `server/node/routes/hypav3_resummary_routes.cjs`) with no behavior changes.
- [x] Slice A (part 3): extracted RAG route group into `server/node/routes/rag_routes.cjs` (no behavior changes).
- [x] Slice B (part 1): removed dead duplicate prompt/template/lore/token helper logic from `server/node/server.cjs`; server now uses `server/node/llm/*` pipeline helpers for generate assembly and trace shaping.
- [x] Slice B (part 2): moved shared request/response/audit utility helpers out of `server/node/server.cjs` into dedicated module (`server/node/llm/audit_payloads.cjs`) and wired server/routes via injected builders.
- [x] Slice C (part 1): moved shared server runtime helpers (json/sse response helpers, path validation, auth helper factories, audit append factory) from `server/node/server.cjs` into `server/node/server_helpers.cjs`.
- [x] Slice C (part 2): moved generate execution utility helpers (mode normalization, provider/model selection, internal execution detection, non-model output sanitization) from `server/node/server.cjs` into `server/node/llm/execution_helpers.cjs`.
- [x] Slice D (part 1): extracted settings/characters/chats server CRUD route registration from `server/node/server.cjs` into `server/node/routes/storage_routes.cjs` with parity behavior.
- [x] Slice D (part 2): extracted assets/plugins/prompt-theme-color-scheme route registration from `server/node/server.cjs` into `server/node/routes/content_routes.cjs` with parity behavior.
- [x] Slice E (part 1): extracted legacy auth/storage/oauth route registration from `server/node/server.cjs` into `server/node/routes/legacy_routes.cjs` and moved `/data/plugins/log` into `content_routes.cjs`.
- [x] Slice E (part 2): extracted proxy route registration and helper logic (`/data/proxy*`) from `server/node/server.cjs` into `server/node/routes/proxy_routes.cjs`.
- [x] Slice E (part 3): extracted Comfy integration proxy endpoint (`/data/integrations/comfy/*`) from `server/node/server.cjs` into `server/node/routes/integration_routes.cjs`.
- [x] Slice E (part 4): moved `/data/llm/preview` route registration from `server/node/server.cjs` into `server/node/routes/llm_routes.cjs`.
- [x] Slice F (part 1): extracted root and legacy-retired endpoint handlers (`/`, `/proxy`, `/api*`) from `server/node/server.cjs` into `server/node/routes/system_routes.cjs`.
- [x] Slice F (part 2): moved storage/http utility helpers (`safeResolve`, `computeEtag`, `requireIfMatch`, `isIfMatchAny`) from `server/node/server.cjs` into `server/node/storage_utils.cjs`.
- [x] Slice F (part 3): moved Hypa summarization helper functions from `server/node/server.cjs` into `server/node/llm/hypa_helpers.cjs` and rewired server usage through injected helper factory.
- [x] Slice F (part 4): moved trace-audit appenders (`appendGenerateTraceAudit`, `appendMemoryTraceAudit`) from `server/node/server.cjs` into `server/node/llm/trace_audit.cjs`.
- [x] Slice G (part 1): moved generate-mode orchestration helpers (`executeInternalLLMTextCompletion`, periodic Hypa summary execution planning, `buildGenerateExecutionPayload`) from `server/node/server.cjs` into `server/node/llm/generate_helpers.cjs` with DI wiring preserved.
- [x] Slice G (part 2): moved LLM execute endpoint orchestration (`handleLLMExecutePost`) and `[SYSTEM]` game-state extraction updater from `server/node/server.cjs` into `server/node/llm/execute_route_handler.cjs`.
- [x] Slice G (part 3): moved server startup/runtime concerns (global error middleware, SSL option loading, HTTP/HTTPS boot logic) from `server/node/server.cjs` into `server/node/server_runtime.cjs`.
- [x] Slice G (part 4): moved server data bootstrap helpers (`ensureDir`, `readJsonWithEtag`, `writeJsonWithEtag`, conflict responder, `/data` middleware install) from `server/node/server.cjs` into `server/node/server_data_helpers.cjs`.
- [x] Slice G (part 5): moved password/save bootstrap state (`save/` init, password/authcode paths, mutable password state accessors) from `server/node/server.cjs` into `server/node/server_password_state.cjs`.
- [x] Slice G (part 6): moved HTTP app bootstrap middleware wiring (static dist serving, body parsers, low-level request logger) from `server/node/server.cjs` into `server/node/server_http_setup.cjs`.
- [x] Slice G (part 7): moved full route registration wiring from `server/node/server.cjs` into `server/node/server_route_bootstrap.cjs` (`registerServerRoutes`) while preserving dependency injection behavior.
- [x] Slice G (part 8): moved LLM factory bootstrap/composition wiring from `server/node/server.cjs` into `server/node/server_llm_bootstrap.cjs` (`createServerLlmBootstrap`), keeping existing helper modules and DI intact.
- [x] Slice G (part 9): moved server path/constants bootstrap (`sslPath`, `hubURL`, `dataRoot`, `dataDirs`) from `server/node/server.cjs` into `server/node/server_paths.cjs`.

---

### Phase 1: Provider Migration (all LLM calls go through server)

**Goal:** Every LLM API call goes through `/data/llm/execute`. No direct browser→API calls.

**Architecture:** Client still builds the full messages array. Server receives it and forwards to the correct provider with server-side API keys. This is the smallest change with the biggest security win (API keys never touch the browser).

#### 4a. Generalize server execution routing

- File: `server/node/llm/engine.cjs`
- Expand `execute()` to route by provider: openrouter, openai, anthropic, google, novelai, ooba, kobold, ollama, cohere
- Each provider gets a handler module in `server/node/llm/`

#### 4b. OpenAI-compatible handler (covers GPT, Mistral, custom proxies)

- Create: `server/node/llm/openai.cjs`
- Accept OpenAI-format body (messages array, model, max_tokens, stream, tools)
- Read API key + endpoint URL from server settings
- Handle streaming (SSE passthrough) and non-streaming
- Add to `MIGRATED_PROVIDERS` in `constants.cjs`

#### 4c. Anthropic/Claude handler

- Create: `server/node/llm/anthropic.cjs`
- Convert OpenAI-format messages to Claude format (content blocks, separate system prompt, user-first rule)
- Read API key from server settings
- Handle streaming (Claude SSE format → OpenAI SSE format for client compatibility)
- Add to `MIGRATED_PROVIDERS`

#### 4d. Google Gemini handler

- Create: `server/node/llm/google.cjs`
- Convert OpenAI-format messages to Gemini format (role: 'model', parts array, systemInstruction)
- Handle auth (API key or JWT)
- Handle streaming (SSE with `?alt=sse`)
- Add to `MIGRATED_PROVIDERS`

#### 4e. Local model handlers (Ooba, Kobold, Ollama)

- Create: `server/node/llm/local.cjs` (shared handler for OpenAI-compatible local APIs)
- Read endpoint URL from server settings
- Forward requests to local server
- Add to `MIGRATED_PROVIDERS`

#### 4f. Other providers (NovelAI, Cohere, Horde)

- Create individual handlers or a generic one
- Lower priority — do after the main 4 are working

#### 4g. Client-side gate expansion

- File: `src/ts/process/request/openAI.ts`
- Expand the `isNodeServer` check at line 771 from `aiModel === 'openrouter'` to all migrated providers
- File: `src/ts/process/request/request.ts`
- Add server-first routing in `requestChatDataMain()` for Claude, Gemini, etc.

#### 4h. Server-side API key management

- File: `server/node/server.cjs`
- Store all provider API keys in server settings (already has OpenRouter key)
- Add settings fields for: OpenAI key, Anthropic key, Google key, NovelAI key
- Never send keys to client

**Test Phase 1:**
1. Send a message with OpenAI model → verify request goes through `/data/llm/execute`, response works (streaming + non-streaming)
2. Send a message with Claude model → same verification
3. Send a message with Gemini model → same verification
4. Send a message with Ooba/Ollama → same verification
5. Check request logs (Settings → Advanced → Show Request Logs) — all requests should show `/data/llm/execute` as URL, not external API endpoints
6. Verify API keys are NOT in client-side request logs (body/headers)
7. Verify RAG injection still works with all providers
8. Verify streaming works with all providers (text appears incrementally)

---

### Phase 2: Prompt Assembly Migration (server builds the prompt)

**Goal:** Server receives raw inputs (character data, chat history, settings) and builds the messages array. Client no longer does token budgeting or prompt template processing.

Progress (2026-02-15):
- `/data/llm/generate` server baseline assembly now includes main prompt, global note, author note, and character depth prompt (in addition to history + current user message).

#### 5a. Server-side prompt assembly module

- Create: `server/node/llm/prompt.cjs`
- Port the core logic from `src/ts/process/index.svelte.ts` stages 1+3:
  - Load character data, chat history, settings from server filesystem
  - Apply prompt template (iterate cards, build messages)
  - Token budgeting (reserve maxResponse, fit components within maxContext)
  - Format order application
  - Depth prompt insertion

#### 5b. Server-side tokenizer

- Create: `server/node/llm/tokenizer.cjs`
- Port tokenizer from `src/ts/tokenizer.ts`
- Support: tiktoken (GPT), Claude, Mistral, Llama, etc.
- Must produce identical token counts to client tokenizer

#### 5c. Server-side lorebook matching

- Create: `server/node/llm/lorebook.cjs`
- Port from `src/ts/process/lorebook.svelte.ts`
- Keyword/regex matching against chat history
- Decorator handling (@depth, @position, @role, @inject)
- Token budget management

#### 5d. Server-side script processing

- Create: `server/node/llm/scripts.cjs`
- Port regex scripts from `src/ts/process/scripts.ts`
- Port `risuChatParser` variable substitution
- Lua triggers can be deferred (complex, needs Lua runtime)

#### 5e. New server endpoint: full pipeline execution

- File: `server/node/server.cjs`
- New endpoint: `POST /data/llm/generate`
- Input: `{ characterId, chatId, userMessage, continue?, streaming? }`
- Server does everything: load data → build prompt → lorebook → RAG → execute → return response
- Keep `/data/llm/execute` as fallback for client-assembled prompts

#### 5f. Client simplification

- File: `src/ts/process/index.svelte.ts`
- When `isNodeServer`: skip prompt assembly, call `/data/llm/generate` with just characterId + chatId + userMessage
- Keep client-side assembly as fallback for Tauri/web mode

**Test Phase 2:**
1. Send a message → verify server builds prompt (check server logs for token counts, lorebook matches)
2. Compare server-built prompt with client-built prompt (use DevTool "Preview Prompt" vs server log) — they should be equivalent
3. Verify lorebook entries appear in the prompt when keywords match
4. Verify prompt template cards are applied in correct order
5. Verify token budgeting works (long chats should trim old messages)
6. Verify depth prompts are inserted at correct positions
7. Verify author notes, persona prompts, global notes all appear
8. Test with different prompt templates
9. Test with group chats

---

### Phase 3: Memory Migration (server handles summarization)

**Goal:** HypaV3 summarization runs on the server. Client no longer makes LLM calls for memory.
Secondary goal: reduce long-chat prompt growth by replacing older raw turns with memory summaries.

Progress (2026-02-16):
- `/data/llm/generate` now supports template `memory` cards via server-side HypaV3 summary injection (from persisted `chat.hypaV3Data`) instead of always marking HypaMemory as `not_migrated`.
- Memory selection now supports embedding-backed similarity (using server embedding pipeline + stored summary embeddings) with token-budget-aware injection.
- Added initial server-side periodic HypaV3 summarization trigger on `/data/llm/generate`:
  - when interval is reached, server summarizes next batch using `mode: memory` internal execution
  - persists updated `chat.hypaV3Data` (`summaries`, `lastSummarizedMessageIndex`) before prompt assembly
  - stores summary embeddings for subsequent similarity-based memory retrieval
  - uses internal no-assembly execution path to avoid prompt contamination during summarization

#### 6a. Server-side HypaV3

- Create: `server/node/llm/memory.cjs`
- Port from `src/ts/process/memory/hypav3.ts`
- Periodic summarization: detect when interval reached, batch chats, call LLM for summary
- Memory selection: important + recent + similar + random summaries
- Store summaries in character data on server filesystem

#### 6b. Server-side embedding for memory

- Reuse existing `server/node/rag/embedding.cjs` for memory similarity search
- Generate embeddings for summaries, store alongside summary data

#### 6c. Integrate memory into server pipeline

- File: `server/node/llm/prompt.cjs`
- After lorebook, before final assembly: run memory selection
- Inject selected summaries into prompt at correct position (per template)

**Test Phase 3:**
1. Chat long enough to trigger summarization → verify summaries appear in server logs
2. Verify memory selection picks relevant summaries (check prompt content)
3. Verify token budget for memory is respected
4. Verify summaries persist across server restarts
5. Compare memory behavior with client-side HypaV3 (should be equivalent)

---

### Phase 4: Cleanup & Hardening

#### 7a. Remove legacy `/api/*` endpoints

- Confirm no active client paths depend on them
- Remove: `/api/password`, `/api/set_password`, `/api/read`, `/api/write`, `/api/list`, `/api/remove`, `/api/crypto`
- Remove legacy reverse-proxy passthrough endpoints once callers are migrated:
  - `/proxy`
  - `/proxy2`

#### 7b. Remove client-side provider code (optional, can keep as Tauri fallback)

- Gate all client-side LLM request code behind `!isNodeServer`
- Remove API key fields from client-side settings UI when in server mode

#### 7c. PDF chunking quality (from P1 #6)

- [x] Investigate `server/node/rag/pdf.cjs` text extraction
- [x] Remove markdown-style pipe table emission from server PDF extraction (plain-text rows now use `;` separators)
- [x] Filter low-signal extracted lines (page-number noise, symbol-only lines, high pipe-density lines, low alphanumeric density, adjacent duplicates)
- [x] Minimum content-length/signal threshold per chunk (`server/node/rag/engine.cjs`)

#### 7d. Embedding model verification

- [x] Verify model name from client payload reaches `searchRulebooks()` → `generateEmbeddings()`
- [x] Add shared embedding model resolver (`server/node/rag/model.cjs`) and use it in embedding/search/ingest paths
- [x] Persist ingested rulebook embedding model (`embeddingModel`) for cross-checking during search
- [x] Add model-requested/model-resolved fields to RAG ingest/search durable audit entries
- [x] Search now supports per-book query embedding model selection and logs dimension-mismatch skips explicitly

#### 7e. RAG upload transport hardening (in progress, partial)

- [ ] Replace large base64 JSON upload path with multipart/streaming upload for RAG ingest to avoid full in-memory body + decode spikes.
- [x] Keep global parser limits conservative for `/data/*`; allow large payload handling only on authenticated RAG upload route(s).
- [ ] Use backpressure-friendly streaming and temporary-file buffering with cleanup-on-failure/disconnect.
- [x] Add contract tests for auth-before-heavy-parse, route-scoped size limits, and oversized-upload rejection behavior.
- [ ] Keep backward compatibility during rollout (feature flag or dual-path) and remove legacy base64 path after migration validation.

**Test Phase 4:**
1. Verify no client code calls legacy `/api/*` endpoints
2. Verify API keys are not accessible from browser in any way
3. Re-ingest a PDF → verify chunks are clean text, no pipe-delimited gibberish
4. Full end-to-end test: new character → enable RAG → enable lorebook → chat → verify everything works through server

---

## P2 — UI & UX

### 7. Mobile navigation redesign

See `MOBILE_NAV_PLAN.md` for full spec. Key phases:
- Phase 1: Mobile shell hotfix (partially done)
- Phase 2: Global nav redesign
- Phase 3: In-chat nav
- Phase 4: Polish

### 8. UI baseline completion

Remaining work from the UI baseline gate (tracked in archived `UI_BASELINE_MATRIX.md`):
- Overlay surfaces (modals/tooltips/toasts) — partial tokenization
- Mobile settings rendering — stacked shell parity
- Mobile character/chat switching — runtime regressions

### 9. Desktop layout — remove old left sidebar

- Remove old left sidebar (`src/lib/SideBars/Sidebar.svelte`) completely
- Migrate all functionality to the new right sidebar:
  - DevTool panel (with Server Logs + Request Log buttons)
  - Chat/Character mode switcher
  - Any remaining navigation that only exists in the old sidebar
- Single-panel rendering enforcement — no dual-panel states

### 10. Remove unnecessary features

- Trim Playground menu to only tools needed in server-first workflow
- Remove onboarding chat/home feed UI for server-first UX
- Remove unused memory models (keep only HypaV3 + what's needed)

---

## P3 — Future

### 19. Conventions Rewrite Program (explicit track)

**Goal:** Bring the codebase into sustained compliance with `CONVENTIONS.md` via phased, measurable rewrites (not only opportunistic cleanup in touched files).

**Status:** In progress (incremental); dedicated program now tracked.

#### Phase A — Baseline and guardrails
- Build and publish a baseline report:
  - count and location of `any` / `as any`
  - `eval` / `new Function` usage
  - HTML sink usage (`innerHTML`, `{@html}`) with sanitizer ownership
  - oversized files (>500 LOC) and high-risk monoliths
  - mixed state-pattern hotspots (runes/store mixing, direct DOM state reads)
- Add CI/static checks where feasible to prevent regressions in touched files.
- Exit criteria:
  - baseline snapshot committed and referenced in `SESSION_SUMMARY.md`
  - no net-new violations in PR slices touching guarded areas

#### Phase B — Security-first mandatory rewrites
- Remove dynamic code execution from production plugin runtime paths.
- Remove/replace unsafe HTML insertion paths with sanitize-at-render ownership.
- Add boundary validation for external payloads in migrated server routes (schema-based where non-trivial).
- Exit criteria:
  - no production `eval/new Function` execution path
  - no unsanitized HTML sink in active render pipeline
  - security-focused smoke checks pass

#### Phase C — Type and boundary hardening
- Replace high-risk `any` usage at boundaries first (network/storage/plugin/parser IO).
- Introduce/expand typed contracts + structured error objects in server/client integration points.
- Remove `@ts-ignore`/`@ts-nocheck` in touched paths unless explicitly deferred with date and reason.
- Exit criteria:
  - measurable reduction in `any` at boundary modules each slice
  - `pnpm check` passes on target slices and stays green

#### Phase D — Modular decomposition and state consistency
- Split oversized files touched by ongoing work into service/store/component boundaries.
- Remove direct DOM state query/write patterns in application flow.
- Normalize state handling per feature (no ad-hoc writable/runes mixing in same logic flow).
- Exit criteria:
  - touched files follow separation rules and shrink trend
  - no new circular dependency introduced

#### Phase E — Networking and lifecycle consistency
- Standardize request wrappers and error mapping in shared transport paths.
- Remove remaining legacy endpoint usage in core flows (`/api`, `/proxy`, `/proxy2`).
- Add durable-log lifecycle controls (compact mode/retention) under planned hardening.
- Exit criteria:
  - core paths use unified networking behavior
  - legacy routes not used by default app flows

#### Program operating rules
- Every rewrite slice must declare:
  - targeted convention rule(s),
  - measurable before/after delta,
  - deferrals (if any) with date and rationale.
- If a convention is deferred in touched code, record it under this section and in `SESSION_SUMMARY.md`.
- This track runs in parallel with functional roadmap phases; security and correctness slices take precedence.

### 11. TTRPG enhancements (after RAG is stable)
- Dice tray UI with roll history
- Character sheet panel with quick-edit values
- Citation panel showing sources used in rulings
- Beginner-assist mode (step-by-step explanations, legal action suggestions)
- System-specific adapters (D&D, VtM, The One Ring)
- House-rules layer per campaign
- Session audit log (rulings, dice, citations)

### 12. Additional provider migration
- Provider parity hardening (all migrated providers):
  - consistent preview/execute contracts
  - streaming capability matrix + clear client fallbacks
  - regression smoke coverage for provider-specific edge cases

### 13. Advanced memory
- Fact extraction from chat (structured memory)
- Semantic lorebook search (vector-based, not just keyword)
- Autonomous inner life system (see archived `AUTONOMOUS_INNER_LIFE_PLAN.md`)

### 14. Other
- Add `showReasoningThoughts` toggle (UI + parser path):
  - default off for hidden thought traces in chat rendering
  - normalize provider-specific thought syntaxes (`<Thoughts>`, `<think>`, `reasoning_content`) behind one display gate
- Durable LLM log lifecycle hardening:
  - add compact logging mode (metadata-only or truncated request/response bodies)
  - evaluate per-entry on-disk log files (instead of single growing JSONL)
  - add retention/TTL purge policy (age- and/or size-based cleanup)
- Multi-message responses (split prose into separate bubbles)
- Theme/color-scheme redesign (Telegram/iMessage style)
- VN mode (character behind text)
- [x] Comfy Commander as core feature (shipped 2026-03-02)
- Per-chat background menu
- Safari/WebKit select rendering fix
- HypaV3 periodic summarization trigger diagnosis

### 15. Prompt optimization (low priority)
- Reduce prompt payload size while preserving response quality:
  - introduce optional server-side history compression/summarization for older turns
  - deduplicate overlapping template blocks/instructions before final assembly
  - add configurable caps for static system sections and RAG insert size
  - add per-request token budget diagnostics by prompt block in trace logs
  - defer implementation until core server-side refactor phases are stable (do not prioritize now)
  - use HypaV3/HypaMemory integration as the primary long-chat optimization path

### 16. Emotion generation system rewrite (low priority)
- Rewrite the emotion generation pipeline for stricter reliability and lower token overhead:
  - isolate emotion mode from roleplay/server-prompt assembly side effects
  - define a small, stable classifier contract (input/output schema + fallback behavior)
  - evaluate moving emotion selection to dedicated lightweight model/config path
  - add deterministic diagnostics for label choice, confidence proxy, and fallback reason
  - defer implementation until higher-priority server refactor milestones are complete

### 17. HypaV3 auto re-summarization of old memories (low priority)
- Add optional background consolidation of older summaries to reduce long-tail memory bloat:
  - trigger only when summary count exceeds a threshold (configurable), never on fresh/small chats
  - merge oldest adjacent summaries in bounded batches (for example 2-4 at a time), preserving `chatMemos`
  - keep recent and/or important summaries excluded from auto-merge by policy
  - add per-run trace/debug fields (selected indices, before/after counts, model used, skip reason)
  - implement strict safety guards (max merges per run, idempotent apply, rollback on failure)
  - keep manual re-summarization UX unchanged; auto mode is additive and toggleable

### 21. RAG ingest UX error messaging (low priority)
- Improve upload failure UX in `RulebookLibrary` / RAG ingest flow:
  - surface specific server error reasons in UI alerts/toasts when available (not only generic "N failed")
  - include explicit copy for zero-content PDFs (for example: "No text found in PDF. File not ingested.")
  - ensure failed ingest never appears as success and no empty rulebook card is shown
  - keep generic fallback messaging when server error details are unavailable

### 22. Local connector SSRF hardening (low priority)
- Harden URL handling for local connector providers in:
  - `server/node/llm/ollama.cjs`
  - `server/node/llm/ooba.cjs`
  - `server/node/llm/kobold.cjs`
- Scope:
  - remove or strictly gate client-provided URL overrides (`ollama_url`, `ooba_url`, `kobold_url`) in server execution paths
  - enforce host allowlist defaults (loopback-only by default)
  - reject non-`http:`/`https:` schemes and private/link-local targets unless explicitly allowed by env toggle
  - add runtime contract coverage for both rejection path and expected local-allow path
- Status: deferred by decision (do not implement now)

### 18. Full app automated smoke suite
- Expand automated coverage beyond memory-only checks:
  - maintain one-command smoke runner for UI settings runtime + server API contracts (`smoke:app:auto`)
  - keep migration API smoke pack inclusive of storage, LLM, memory, and fixture flow checks
  - enforce durable log assertions for newly migrated endpoints to prevent silent regressions
  - keep tests deterministic by default (no live provider dependency), with optional live checks gated by env flags

---

## Key Files Reference

| Area | Files |
|------|-------|
| Chat processing | `src/ts/process/index.svelte.ts` |
| Prompt assembly | `src/ts/process/prompt.ts` |
| OpenAI/OpenRouter request | `src/ts/process/request/openAI.ts` |
| Server LLM engine | `server/node/llm/engine.cjs` |
| Server OpenRouter | `server/node/llm/openrouter.cjs` |
| Server main | `server/node/server.cjs` |
| RAG engine (server) | `server/node/rag/engine.cjs` |
| RAG embedding (server) | `server/node/rag/embedding.cjs` |
| RAG client | `src/ts/process/rag/rag.ts` |
| Database schema | `src/ts/storage/database.svelte.ts` |
| Server DB adapter | `src/ts/storage/serverDb.ts` |
| Character config sidebar | `src/lib/SideBars/CharConfig.svelte` |
| DevTool | `src/lib/SideBars/DevTool.svelte` |
| GameState HUD | `src/lib/SideBars/GameStateHUD.svelte` |
| GameState editor | `src/lib/SideBars/GameStateEditor.svelte` |
| Rulebook RAG settings | `src/lib/SideBars/LoreBook/RulebookRagSetting.svelte` |
| Rulebook library | `src/lib/Others/RulebookManager/RulebookLibrary.svelte` |
| Fetch logging | `src/ts/globalApi.svelte.ts` |
| Server audit logs | `server/node/llm/audit.cjs` |
