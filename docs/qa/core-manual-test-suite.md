# Core Manual Test Suite

## Goal
Validate the product's core user-facing flows with one practical manual pass. This suite is intended to catch regressions in:
- app boot and persistence
- chat creation and message sending
- prompt template editing and preset switching
- persona management
- character state injection
- lorebook/rulebook prompt enrichment
- evolution review flow
- basic import/export

Use this as the default manual regression suite after significant prompt, storage, settings, or chat runtime changes.

## Companion Suites
Use these for deeper subsystem coverage when needed:
- [rag-manual-test-suite.md](/Users/andrewbostan/Documents/RisuAII/docs/qa/rag-manual-test-suite.md)
- [memory-tab-manual-checklist.md](/Users/andrewbostan/Documents/RisuAII/docs/qa/memory-tab-manual-checklist.md)
- [server-authoritative-manual-test-suite.md](/Users/andrewbostan/Documents/RisuAII/docs/qa/server-authoritative-manual-test-suite.md)

## Test Setup
1. Start the app with a clean or disposable data root if possible.
2. Use one working chat model/provider.
3. Prepare one test character with:
   - non-empty description
   - first message
   - one image if available
4. If testing evolution, use a character with evolution enabled.
5. If testing RAG, prepare one small PDF or text-heavy file.

## Pass/Fail Rule
- PASS: expected result happens without refresh hacks, silent corruption, or console-visible failure.
- FAIL: data disappears, wrong prompt content is used, setting changes do not persist, or the UI enters a broken state.
- SKIP: external dependency is unavailable, for example no provider key or no TTS service.

---

## Batch 1: Boot, Settings, and Persistence

### 1.1 App boot
1. Open the app.
2. Confirm the main chat UI loads.
3. Open Settings, then return to chat.

Expected:
- No blank screen or crash.
- Settings pages render.

### 1.2 Reload persistence
1. Change one simple setting, for example temperature or username.
2. Reload the page.

Expected:
- The changed setting persists.

### 1.3 Restart persistence
1. Stop and restart the server/app.
2. Re-open the same profile.

Expected:
- Characters, chats, presets, and settings are still present.

---

## Batch 2: Prompt Template and Presets

### 2.1 Default prompt template exists
1. Open Bot Settings.
2. Open Prompt Settings.
3. Inspect the prompt card list.

Expected:
- A non-empty prompt template exists.
- The template includes a `Character State` card.
- The template is editable without exposing the removed legacy builder UI.

### 2.2 Prompt card editing
1. Add a new `Plain Prompt` card.
2. Move it up and down.
3. Remove it.

Expected:
- Reordering works.
- Removing the card does not corrupt the template.
- The template never becomes an unusable empty state.

### 2.3 Character State wrapper
1. Open the `Character State` card.
2. Confirm the format contains `{{slot}}`.
3. Save changes if you modify wrapper text.

Expected:
- Wrapper text is editable.
- `{{slot}}` is preserved and not expanded inside the editor.

### 2.4 Preset switching
1. Open the preset modal.
2. Duplicate the current preset.
3. Rename the copy.
4. Switch to it.
5. Export it if desired, then import it back.

Expected:
- Preset duplicate and rename work.
- Switching presets updates model/settings immediately.
- Imported preset appears and is selectable.

---

## Batch 3: Persona and User Context

### 3.1 Persona create/select
1. Open Persona settings.
2. Create a new persona.
3. Give it a distinct description.
4. Switch between personas.

Expected:
- Persona list updates immediately.
- Selected persona changes persist.

### 3.2 Persona ordering
1. Reorder personas by drag and drop.
2. Reload the page.

Expected:
- New order persists.
- Selected persona is still valid.

### 3.3 Persona import/export
1. Export a persona.
2. Import it again.

Expected:
- Import succeeds.
- Imported persona is usable without manual repair.

---

## Batch 4: Character and Chat Core Flow

### 4.1 Character open and first response
1. Open the test character.
2. Start or open a chat.
3. Send one message.

Expected:
- Model request succeeds.
- One assistant reply is generated.
- Message order is correct.

### 4.2 Chat switching
1. Create a second chat for the same character.
2. Send one message there.
3. Switch back to the first chat.

Expected:
- Each chat keeps its own history.
- No cross-chat bleed or overwritten messages.

### 4.3 Message actions
1. Edit one user message if supported.
2. Delete one message.
3. Regenerate one assistant message if supported.

Expected:
- Operations apply to the intended message only.
- Chat remains coherent after mutation.

---

## Batch 5: Prompt Composition Sanity

### 5.1 Character description and persona are present
1. Use a character with obvious description/persona markers.
2. Send a message that depends on those markers.

Expected:
- The reply reflects the character description and selected persona.

### 5.2 Prompt-template-only runtime
1. Edit a visible prompt card text in the active template.
2. Send a message.

Expected:
- Behavior changes in a way consistent with the edited card.
- No hidden legacy prompt field is required.

### 5.3 Utility bot override
1. Toggle a utility-bot character if you have one.
2. Send a simple instruction-style request.

Expected:
- Utility behavior still works.
- Prompt assembly does not crash when utility override is used.

---

## Batch 6: Lorebook and Rulebook Smoke

### 6.1 Lorebook activation
1. Add or enable a lorebook entry with a unique keyword.
2. Send a message containing that keyword.

Expected:
- Reply reflects the lorebook information.
- No unrelated prompt corruption occurs.

### 6.2 Rulebook/RAG smoke
1. Upload one small rulebook file.
2. Enable it for the character if required.
3. Ask a question that should hit rulebook content.

Expected:
- Ingestion succeeds.
- The answer reflects rulebook content.

If this fails, use the dedicated RAG suite for deeper diagnosis.

---

## Batch 7: Evolution Smoke

### 7.1 Character State prompt injection
1. Use a character with evolution enabled and accepted state data.
2. Send a message that depends on remembered relationship or user facts.

Expected:
- The reply reflects accepted character state.
- The app does not require pending review data to inject memory.

### 7.2 Extraction handoff and review
1. Complete a chat with at least one meaningful fact or interaction change.
2. Run evolution handoff.
3. Open the review/state/history tabs.

Expected:
- Handoff completes or fails with a visible error, not silent corruption.
- Review shows proposal data.
- Accepting a proposal updates current state and history.

---

## Batch 8: Optional Feature Smoke

### 8.1 Emotion settings
1. Open Other Bots > Emotion.
2. Change one non-destructive setting.
3. Save/reload.

Expected:
- Settings persist.
- Page loads without missing-control errors.

### 8.2 TTS settings
1. Open Other Bots > TTS.
2. Enter or clear service settings without sending secrets to logs.

Expected:
- Page loads and saves normally.
- If no provider is configured, mark SKIP for playback.

### 8.3 Modules page
1. Open Modules.
2. Enable or disable one module if available.

Expected:
- Toggle persists.
- No immediate prompt/runtime crash.

---

## Batch 9: Import/Export and Recovery

### 9.1 Character export/import
1. Export a test character.
2. Re-import it.

Expected:
- Imported character is usable.
- Chats and assets expected by the format are present.

### 9.2 Settings/preset recovery
1. Export a preset or settings payload if supported by the UI.
2. Import/apply it.

Expected:
- Import succeeds.
- Prompt template remains present after import.

---

## Fast Release Gate
Run these if time is limited:
1. Batch 1.1 to 1.3
2. Batch 2.1 to 2.4
3. Batch 4.1 to 4.3
4. Batch 5.2
5. Batch 7.1 to 7.2
6. Batch 9.1

## Failure Notes Template
Record:
- batch and step
- exact action
- expected result
- actual result
- whether reload/restart changes the outcome
- screenshots or logs if available
