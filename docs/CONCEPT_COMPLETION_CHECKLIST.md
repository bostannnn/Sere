# Concept Completion Checklist

Purpose: gate the prototype until it is implementation-ready.
Rule: do not move to production implementation until every required item is marked ✅.

## 1) Information Architecture (Required)
- [x] Sidebar tab order is final and approved: `Chats`, `Basics`, `Display`, `Lorebook`, `Voice`, `Scripts`, `Advanced`, `GameState`, `Share`.
- [x] Primary navigation model is final: character-card home + chat runtime + right workspace sidebar.
- [x] Character-scoped chat selector exists only in right sidebar `Chats`; left drawer `Recent Chats` is quick-open only.
- [x] Home-to-chat entry rule is final: click character -> open last selected chat for that character.

## 2) Home Screen (Required)
- [ ] Portrait card layout finalized (ratio, spacing, title, subtitle, metadata).
- [ ] Search behavior finalized (empty query, no results, partial match).
- [ ] Card states finalized: default, hover, selected, loading, empty avatar.
- [ ] "Last chat" summary on card is clear and truncates safely.

## 3) Chat Runtime (Required)
- [ ] Message area structure finalized (assistant/user bubble system).
- [ ] Message bubble surfaces are tokenized (`--chat-assistant-bg`, `--chat-user-bg`) with no hardcoded shell colors.
- [ ] Theme/background behavior is explicitly deferred from prototype and documented in migration artifacts.
- [ ] Composer behavior finalized (enter to send, multiline rule, disabled state placeholder).
- [ ] Header behavior finalized (title/subtitle truncation and responsiveness).
- [ ] Long conversation behavior validated (scrolling, sticky composer, no clipping).

## 4) Right Sidebar Structure (Required)
- [ ] Sidebar opens/closes from top-right button and close button.
- [ ] Re-click toggle works: clicking an open-sidebar button closes it.
- [ ] Tab strip mode contract is final: hidden for single-tab modes, visible for multi-tab modes.
- [ ] Tab strips do not horizontally scroll at any width.
- [ ] Sidebar profile block finalized (character identity + chat context).
- [ ] Visual layer hierarchy is finalized (topbar < panels < rows/inputs < overlays).
- [ ] Each tab has complete visual section blocks matching current app surface area.

## 5) Tab-by-Tab Content Coverage (Required)
- [ ] `Chats`: list rows, search, row actions, footer actions represented.
- [ ] `Basics`: name/description/personality/scenario/first-message/global-note/chat-note represented.
- [ ] `Display`: avatar/portrait/viewscreen/emotion/additional-assets represented.
- [ ] `Lorebook`: character + chat lorebook controls represented.
- [ ] `Voice`: TTS mode/model/config sections represented.
- [ ] `Scripts`: background HTML/CSS + regex + trigger script sections represented.
- [ ] `Advanced`: legacy/low-level/depth/default-vars/etc. sections represented.
- [ ] `GameState`: state fields, NPC table, plot thread sections represented.
- [ ] `Share`: upload/update/export/metadata sections represented.

## 6) State & Edge Cases (Required)
- [ ] Character with zero chats.
- [ ] Character with many chats (100+) and long names.
- [ ] Very long setting content in each tab.
- [ ] No results for home search and chat search.
- [ ] Switching characters preserves per-character last selected chat.
- [ ] Deleting or missing remembered chat falls back to first valid chat.

## 7) Responsive & Device Behavior (Required)
- [ ] Desktop wide layout validated.
- [ ] Laptop narrow layout validated.
- [ ] Tablet layout validated.
- [ ] Mobile behavior defined (drawer width, tab overflow, composer fit).

## 8) Interaction Consistency (Required)
- [ ] All major buttons have deterministic behavior (no dead controls).
- [ ] Overlay/scrim interactions are consistent.
- [ ] Esc-close rule defined and tested.
- [ ] Keyboard focus order acceptable for prototype stage.
- [ ] Active-state patterns are consistent (`tab-pattern` accent-edge for tab controls, `list-pattern` fill for list/chip controls).
- [ ] Display color-scheme switching finalized (original scheme set, live token updates, generated color ramps, persisted choice).

## 9) Implementation Readiness Artifacts (Required)
- [x] Migration map completed and approved.
- [x] Component mapping completed (concept -> actual Svelte components).
- [x] Slice plan created with estimated risk per slice.
- [x] Feature-flag strategy defined for rollout.

## 10) Definition of Done
The concept is considered complete only when:
- [ ] All "Required" items above are ✅.
- [ ] Final walkthrough recorded and approved.
- [ ] No open IA or behavior decisions remain.

## Sign-off
- Concept version:
- Date:
- Approved by:
- Notes: Product decisions locked on 2026-02-21 (UI transplant only; no logic/feature changes).
