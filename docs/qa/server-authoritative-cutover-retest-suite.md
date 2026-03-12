# Server-Authoritative Route-Surface Retest Suite

## Goal
Validate that the app works only through the authoritative API model after legacy storage routes were removed.

## Preconditions
1. Deploy the latest candidate build/image you intend to validate.
2. Use one desktop browser and one mobile browser.
3. On desktop DevTools Network:
   1. Enable `Preserve log`.
   2. Enable `Disable cache`.
4. Sign in on both clients if password auth is enabled.

## Pass Rule
All batches below must pass, except noted optional checks.

---

## Batch C1: Bootstrap + Route Surface

### Steps
1. Open app on desktop and mobile.
2. On desktop Network, confirm:
   1. `GET /data/state/snapshot` returns `200`.
   2. `GET /data/sync/events?since=...` is open and `200`.
3. In browser address bar or API tool (with auth header), call:
   1. `GET /data/settings`
   2. `GET /data/characters`

### Expected
1. Snapshot and SSE endpoints are active.
2. Legacy endpoints return `404`.

---

## Batch C2: Cross-Device Character + Chat Convergence

### Steps
1. On desktop, import 2 characters.
2. On mobile, reload once.
3. Confirm both characters are visible on mobile.
4. On mobile, create a new chat and send 2 messages.
5. Wait up to 3 seconds on desktop without manual reload.

### Expected
1. Desktop receives mobile-created chat and messages automatically.
2. No selection dependency: sync works even if desktop is viewing another character.

---

## Batch C3: Mutation Path Verification

### Steps
1. On desktop, edit character description for 5-10 seconds continuously.
2. Stop typing and wait 1 second.
3. Inspect Network requests generated during edit.

### Expected
1. Writes are sent via `POST /data/state/commands`.
2. No writes to `/data/settings` or `/data/characters*`.

---

## Batch C4: Reload Persistence

### Steps
1. Reload desktop.
2. Reload mobile.
3. Re-open edited character/chat.

### Expected
1. Latest text edits/messages are preserved on both devices.

---

## Batch C5: Concurrent Edit Convergence

### Steps
1. Open same chat on desktop and mobile.
2. Edit the same message from both devices nearly at the same time.
3. Wait until UI stabilizes.

### Expected
1. No crash/freeze on either client.
2. Both clients converge to the same final state.

---

## Batch C6: Reconnect Catch-Up

### Steps
1. Disable network on desktop for 20-30 seconds.
2. While desktop is offline, send messages from mobile.
3. Re-enable desktop network.

### Expected
1. Desktop catches up automatically within a few seconds.
2. No manual reload required.

---

## Batch C7: Delete + Order Convergence

### Steps
1. On desktop, delete one character.
2. Confirm deletion appears on mobile.
3. Reorder remaining characters on desktop.
4. Reload both clients.

### Expected
1. Deletion and order match on both devices after reload.

---

## Batch C8: Server Restart Durability

### Steps
1. Restart the server/container with the same data volume.
2. Open desktop and mobile again.

### Expected
1. Characters, chats, and messages remain intact.
2. Snapshot/SSE bootstrap still works.

---

## Failure Capture Template
- Batch:
- Step:
- Expected:
- Actual:
- Device(s):
- Timestamp:
- Network URL + status:
- Server log excerpt:
