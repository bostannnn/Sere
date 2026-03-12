# Server Functional + Authoritative Test Suite

## Goal
Test in two stages so you can validate core behavior first against the currently running deployment, then verify server-authoritative behavior against the candidate build you actually plan to ship.

## Stage Model
1. Stage A (`NO_REBUILD_SANITY`): Run against currently deployed container/image. Goal is only to confirm app is basically functional.
2. Stage B (`AUTHORITATIVE_ACCEPTANCE`): Run against the latest candidate build/image from the current branch or release artifact. Goal is to confirm cross-device persistence and convergence guarantees.

---

## Stage A: No Rebuild Sanity

### Scope
- Login/auth works
- Character import works
- Basic chat create/send works
- Data survives reload and server restart

### Not In Scope
- New authoritative API guarantees
- Snapshot/SSE endpoint contract checks
- Conflict/retry correctness

### Preconditions
1. Use current running container/image as-is (no rebuild).
2. Use isolated data root if possible.
3. Two clients:
   - Device A: desktop
   - Device B: mobile

### Batch A1: Basic Boot and Auth
1. Open desktop URL.
2. Confirm app loads to chat UI.
3. Authenticate if required.
4. Open same URL on mobile and authenticate.

Expected:
- Both devices can enter app without crash.

### Batch A2: Core Character and Chat Flow
1. On desktop, import 2 characters.
2. Open Character A and send 2 messages.
3. Create a second chat under Character A and send 1 message.
4. Switch to Character B and send 1 message.

Expected:
- All operations succeed on the same device.
- No immediate UI corruption.

### Batch A3: Cross-Device Visibility (Best Effort Baseline)
1. On mobile, reload app once.
2. Check if both characters are visible.
3. Open Character A and verify chats/messages exist.

Expected:
- If data appears, mark PASS.
- If not, record exact mismatch (this is baseline evidence, not yet a blocker for Stage A).

### Batch A4: Durability Baseline
1. Reload both devices.
2. Restart current server container/process.
3. Open both devices again.

Expected:
- Previously created characters/chats/messages still exist.

### Stage A Exit Criteria
- Must pass A1, A2, A4.
- A3 can fail and still proceed to Stage B (it becomes baseline evidence for why rebuild validation is needed).

---

## Stage B: Authoritative Acceptance (After Rebuild)

### Scope
Validate server-authoritative design:
- Every mutation persisted via `/data/state/commands`
- Snapshot + SSE convergence across devices
- No selection-dependent persistence gaps
- Conflict/retry convergence

### Preconditions
1. Target environment is rebuilt or redeployed from the candidate build you intend to validate.
2. Fresh test data directory.
3. Desktop devtools Network open with:
   - Preserve log ON
   - Disable cache ON
4. Same two-client setup (desktop + mobile).

### Batch B1: Snapshot + Event Stream Bootstrap
1. On desktop, import Character A and Character B.
2. Open mobile and reload once.
3. On desktop Network, confirm:
   - `GET /data/state/snapshot` returns 200.
   - `GET /data/sync/events?since=...` stays open.

Expected:
- Mobile sees both characters without reimport.
- Snapshot and SSE are active.

### Batch B2: Immediate Cross-Device Message Sync
1. On mobile, open Character A, create chat, send 2 messages.
2. Keep desktop on Character B while mobile writes.
3. Wait up to 3 seconds, then check Character A on desktop.

Expected:
- New chat/messages appear without manual refresh.
- Sync does not depend on selected character/chat.

### Batch B3: Typing Debounce Save
1. On desktop, edit a text-heavy character field for ~5 seconds continuously.
2. Stop typing, wait 1 second.
3. Reload desktop and then check mobile.

Expected:
- Final value persists on both devices.
- Writes appear as event-driven/debounced, not periodic loop behavior.

### Batch B4: Concurrent Edit Conflict Handling
1. Open same chat/message on both devices.
2. Edit same message nearly at the same time on both devices.
3. Wait until sync stabilizes.

Expected:
- App stays stable.
- One final consistent result converges across devices.

### Batch B5: Reconnect Gap Recovery
1. Disable desktop network for 20-30 seconds.
2. Send 2 messages from mobile during outage.
3. Re-enable desktop network.

Expected:
- Desktop catches up automatically.
- No permanent divergence.

### Batch B6: Delete + Order Convergence
1. Delete Character B on mobile.
2. Verify desktop reflects deletion quickly.
3. Reorder characters on desktop.
4. Reload both devices.

Expected:
- Deletion and ordering are consistent on both devices after reload.

### Batch B7: Restart Durability
1. Restart server with same data volume.
2. Re-open desktop and mobile.

Expected:
- Data is preserved; no rollback/loss.

### Stage B Exit Criteria
- All B1-B7 pass.

---

## Evidence to Capture on Failures
- Batch + step
- Expected vs actual
- Device(s)
- Timestamp
- Network request URL + status
- Relevant server log tail
