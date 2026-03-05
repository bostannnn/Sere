# Server Functional + Authoritative Batch Questions

Use this with:
- `docs/qa/server-authoritative-manual-test-suite.md`

Reply in batches only. Do not run all batches at once.

## Reply Format
For each batch:
1. `PASS` or `FAIL`
2. One short note
3. If fail: include failure capture template from bottom

---

## Stage A (`NO_REBUILD_SANITY`) Questions

### Batch A1
1. Desktop app loaded successfully? (`PASS`/`FAIL`)
2. Mobile app loaded successfully? (`PASS`/`FAIL`)
3. Auth/login worked on both? (`PASS`/`FAIL`)

### Batch A2
1. Import 2 characters on desktop succeeded? (`PASS`/`FAIL`)
2. Created/sent messages in Character A and Character B without error? (`PASS`/`FAIL`)
3. Any obvious UI corruption/crash? (`YES`/`NO`)

### Batch A3
1. After mobile reload, are both characters visible? (`PASS`/`FAIL`)
2. Are Character A chats/messages visible on mobile? (`PASS`/`FAIL`)

### Batch A4
1. After reload + server restart, was data preserved? (`PASS`/`FAIL`)
2. Any missing chats/messages after restart? (`YES`/`NO`)

---

## Stage B (`AUTHORITATIVE_ACCEPTANCE`) Questions

### Batch B1
1. Mobile shows both imported characters without reimport? (`PASS`/`FAIL`)
2. Desktop network shows `GET /data/state/snapshot` on startup? (`PASS`/`FAIL`)
3. Desktop has open `GET /data/sync/events?since=...` stream? (`PASS`/`FAIL`)

### Batch B2
1. Mobile-created chat/messages appeared on desktop within 1-3 seconds? (`PASS`/`FAIL`)
2. Worked even when desktop had another character selected? (`PASS`/`FAIL`)
3. User mutations produced `POST /data/state/commands`? (`PASS`/`FAIL`)

### Batch B3
1. Final typed field value survived reload on desktop? (`PASS`/`FAIL`)
2. Same final value visible on mobile? (`PASS`/`FAIL`)
3. Request pattern looked debounced/event-driven (not periodic loop)? (`PASS`/`FAIL`)

### Batch B4
1. Concurrent same-message edit stayed stable (no crash/freeze)? (`PASS`/`FAIL`)
2. Both devices converged to one final version? (`PASS`/`FAIL`)
3. Any visible conflict error text? (paste exact text or `NONE`)

### Batch B5
1. Desktop auto-caught-up after reconnect? (`PASS`/`FAIL`)
2. Manual refresh needed to recover? (`YES`/`NO`)
3. Repeating reconnect/error loop observed? (`YES`/`NO`)

### Batch B6
1. Character deletion on mobile reflected quickly on desktop? (`PASS`/`FAIL`)
2. Character order stayed identical after reload on both? (`PASS`/`FAIL`)

### Batch B7
1. After restart with same data volume, all data preserved? (`PASS`/`FAIL`)
2. Any missing data after restart? (`YES`/`NO`)

---

## Failure Capture Template
- Stage:
- Batch:
- Step:
- Expected:
- Actual:
- Device(s):
- Timestamp:
- Network URL + status:
- Server log excerpt:
