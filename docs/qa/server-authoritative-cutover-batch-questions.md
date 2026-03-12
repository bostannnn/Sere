# Server-Authoritative Route-Surface Batch Questions

Use with:
- `docs/qa/server-authoritative-cutover-retest-suite.md`

Reply batch-by-batch only.

## Reply Format
1. `PASS` or `FAIL`
2. One short note
3. If fail: include failure capture fields

---

## Batch C1
1. `GET /data/state/snapshot` seen and `200`? (`PASS`/`FAIL`)
2. `GET /data/sync/events?since=...` open and `200`? (`PASS`/`FAIL`)
3. `GET /data/settings` returns `404`? (`PASS`/`FAIL`)
4. `GET /data/characters` returns `404`? (`PASS`/`FAIL`)

## Batch C2
1. Mobile sees both imported characters after reload? (`PASS`/`FAIL`)
2. Mobile-created chat/messages appear on desktop within 3s? (`PASS`/`FAIL`)
3. Works when desktop is on another character? (`PASS`/`FAIL`)

## Batch C3
1. Edits produce `POST /data/state/commands`? (`PASS`/`FAIL`)
2. No writes to legacy endpoints (`/data/settings`, `/data/characters*`)? (`PASS`/`FAIL`)

## Batch C4
1. Latest edits/messages persist after reload on desktop? (`PASS`/`FAIL`)
2. Latest edits/messages persist after reload on mobile? (`PASS`/`FAIL`)

## Batch C5
1. Concurrent same-message edit did not crash/freeze? (`PASS`/`FAIL`)
2. Both devices converged to same final state? (`PASS`/`FAIL`)

## Batch C6
1. Desktop auto-caught up after reconnect? (`PASS`/`FAIL`)
2. Manual reload needed? (`YES`/`NO`)

## Batch C7
1. Character delete on desktop reflected on mobile? (`PASS`/`FAIL`)
2. Character order consistent on both after reload? (`PASS`/`FAIL`)

## Batch C8
1. Data preserved after server restart? (`PASS`/`FAIL`)
2. Snapshot + SSE bootstrap still healthy after restart? (`PASS`/`FAIL`)

---

## Failure Capture
- Batch:
- Step:
- Expected:
- Actual:
- Device(s):
- Timestamp:
- Network URL + status:
- Server log excerpt:
