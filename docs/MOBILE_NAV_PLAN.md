# Mobile Navigation Plan (Server-First)

## Scope
- Fix dead-end navigation states on phone.
- Define a stable mobile information architecture (IA).
- Align desktop and mobile navigation concepts.

## Phase 1 — Mobile Shell Hotfix (Current)
- Goal: Always render mobile navigation shell on phone-like devices.
- Rule:
  - Enable `MobileGUI` when:
    - `betaMobileGUI` is on and width is small, or
    - device is phone-like (small width + coarse pointer or mobile user-agent), or
    - Lite mode is enabled.
- Expected result:
  - Mobile devices show `MobileHeader`, `MobileBody`, `MobileFooter`.
  - No dead-end “home feed with no nav” screen.

## Phase 2 — Mobile IA Redesign
- Global bottom nav:
  - `Chats`
  - `Characters`
  - `Settings`
- In-chat top bar:
  - Back
  - Character name
  - Context menu
- In-chat context menu:
  - `Chat`
  - `Character`
  - `Tools`

## Phase 3 — Desktop Alignment
- Keep far-left strip.
- Keep center chat.
- Right contextual panel with tabs:
  - `Chat`
  - `Character`
- Remove overlapping legacy side controls.

## Phase 4 — Onboarding/Home Feed Removal
- Remove default onboarding home feed as primary route.
- Keep Realm/Get-more as explicit destination.

## Validation Matrix
- iPhone Safari portrait/landscape.
- Android Chrome portrait/landscape.
- Desktop narrow/normal/ultra-wide.
- `pnpm dev`.
- `pnpm build && pnpm run runserver`.

