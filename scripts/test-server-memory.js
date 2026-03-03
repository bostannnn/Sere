#!/usr/bin/env node
/**
 * Integration smoke tests for the HypaV3 memory pipeline.
 * Requires a running server. Creates and cleans up its own test data.
 *
 * Usage:
 *   RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-memory.js
 *
 * Environment variables:
 *   RISU_DATA_TEST_URL            — server base URL (default: http://localhost:6001)
 *   RISU_STORAGE_TEST_ALLOW_WRITE — must be "1" to allow write operations
 */
'use strict';

const baseUrl = process.env.RISU_DATA_TEST_URL || 'http://localhost:6001';
const ALLOW_WRITE = process.env.RISU_STORAGE_TEST_ALLOW_WRITE === '1';
// Optional auth token (the hashed password, as returned by POST /data/auth/crypto).
// Required when the server has password auth enabled.
const authToken = process.env.RISU_TEST_AUTH_TOKEN || '';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const testCharId = `test-mem-${runId}`;
const testChatId = `test-chat-${runId}`;
const characterPromptOverrideA = 'Character-level summarization prompt A';
const requestPromptOverrideB = 'Request-level summarization prompt B';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function req(urlPath, options = {}) {
  const url = `${baseUrl}${urlPath}`;
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('risu-auth', authToken);
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  const etag = res.headers.get('etag');
  return { res, text, json, etag };
}

async function getSettings() {
  const r = await req('/data/settings');
  if (r.res.status === 404) return { json: null, etag: null };
  assert(r.res.status === 200, `GET /data/settings expected 200 or 404, got ${r.res.status}: ${r.text}`);
  return { json: r.json, etag: r.etag };
}

async function putSettings(body, etag) {
  // When settings don't exist yet (etag null), use a placeholder — the server
  // skips ETag validation when the file is absent.
  const ifMatch = etag || '"init"';
  const r = await req('/data/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'if-match': ifMatch },
    body: JSON.stringify(body),
  });
  assert(r.res.status === 200, `PUT /data/settings expected 200, got ${r.res.status}: ${r.text}`);
  return { json: r.json, etag: r.etag };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testCharBody = {
  character: {
    chaId: testCharId,
    name: 'Test Memory Character',
    supaMemory: true,
    hypaV3PromptOverride: {
      summarizationPrompt: characterPromptOverrideA,
      reSummarizationPrompt: '',
    },
  },
};

// 5 chat messages so that periodic summarization (interval=2) sees enough
// new messages (lastSummarizedMessageIndex=0, newMessages=5 >= batchSize=2).
const testChatBody = {
  chat: {
    id: testChatId,
    name: 'Test Memory Chat',
    message: [
      { role: 'char', data: 'Hello, how can I help you today?',    chatId: 'tmsg-1' },
      { role: 'user', data: 'I need help with my project.',        chatId: 'tmsg-2' },
      { role: 'char', data: 'Of course! Tell me more.',            chatId: 'tmsg-3' },
      { role: 'user', data: 'It involves building a new feature.', chatId: 'tmsg-4' },
      { role: 'char', data: 'Great, what kind of feature?',        chatId: 'tmsg-5' },
    ],
    // Two summaries pre-seeded so resummarize-preview can select indices [0,1]
    hypaV3Data: {
      summaries: [
        { text: 'The user asked for help with their project.', isImportant: false },
        { text: 'The character offered to assist with feature development.', isImportant: true },
      ],
      lastSummarizedMessageIndex: 0,
      metrics: {},
    },
  },
};

/**
 * Build a settings object that enables HypaV3 with a test preset.
 * Spreads over the original settings so unrelated keys are preserved.
 */
function makeTestSettings(base, extraPreset = {}) {
  return {
    ...(base || {}),
    hypaV3: true,
    hypaV3PresetId: 0,
    hypaV3Presets: [{
      name: 'SmokeTestPreset',
      settings: {
        periodicSummarizationEnabled: true,
        periodicSummarizationInterval: 2,
        summarizationPrompt: '',
        ...extraPreset,
      },
    }],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ALLOW_WRITE) {
    console.error(
      'FAIL test-server-memory: set RISU_STORAGE_TEST_ALLOW_WRITE=1 to allow write operations.'
    );
    process.exit(1);
  }

  // Verify server is reachable
  try {
    const ping = await req('/data/settings');
    assert(
      ping.res.status === 200 || ping.res.status === 404,
      `Unexpected server response: ${ping.res.status}`
    );
  } catch (err) {
    console.error(`FAIL test-server-memory: cannot reach server at ${baseUrl}: ${err.message}`);
    process.exit(1);
  }
  console.log(`test-server-memory: server reachable at ${baseUrl}`);

  let origSettings = null;
  let origSettingsEtag = null;
  let charCreated = false;

  try {
    // ── Setup ────────────────────────────────────────────────────────────────

    // Back up existing settings before touching anything
    { const s = await getSettings(); origSettings = s.json; origSettingsEtag = s.etag; }
    console.log(`  Backed up settings (etag=${origSettingsEtag || 'null (none existed)'})`);

    // Create test character (supaMemory:true is required for memory pipeline)
    {
      const r = await req('/data/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(testCharBody),
      });
      assert(r.res.status === 201, `Create character expected 201, got ${r.res.status}: ${r.text}`);
      charCreated = true;
      console.log(`  Created character: ${testCharId}`);
    }

    // Create test chat with pre-seeded messages and summaries
    {
      const r = await req(`/data/characters/${testCharId}/chats`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(testChatBody),
      });
      assert(r.res.status === 201, `Create chat expected 201, got ${r.res.status}: ${r.text}`);
      console.log(`  Created chat: ${testChatId}`);
    }

    // Patch settings — Config A: empty preset summarizationPrompt.
    // Character-level prompt override remains set on the test character.
    {
      const overlay = makeTestSettings(origSettings);
      await putSettings(overlay, origSettingsEtag);
      console.log('  Patched settings → Config A (default template, periodicSummarizationEnabled=true)');
    }

    // ── T1: manual-summarize/trace — non-{{slot}} template → messageCount=2 ──
    {
      const r = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId, start: 1, end: 5 }),
      });
      assert(r.res.status === 200, `T1: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T1: expected type='success', got '${r.json?.type}'`);
      assert(r.json?.shouldRun === true,  `T1: expected shouldRun=true`);
      assert(r.json?.reason === 'ready',  `T1: expected reason='ready', got '${r.json?.reason}'`);
      // Non-{{slot}} template: two messages — [user: chat content] + [system: template]
      assert(
        r.json?.messageCount === 2,
        `T1: expected messageCount=2 (default template), got ${r.json?.messageCount}`
      );
      assert(Array.isArray(r.json?.promptMessages), `T1: promptMessages should be an array`);
      console.log('  T1 PASS: manual-summarize/trace — non-{{slot}} template, messageCount=2');
    }

    // ── T1A: manual-summarize/trace — request promptOverride wins ────────────
    {
      const r = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          characterId: testCharId,
          chatId: testChatId,
          start: 1,
          end: 5,
          promptOverride: {
            summarizationPrompt: requestPromptOverrideB,
            reSummarizationPrompt: '',
          },
        }),
      });
      assert(r.res.status === 200, `T1A: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T1A: expected type='success', got '${r.json?.type}'`);
      assert(Array.isArray(r.json?.promptMessages), 'T1A: promptMessages should be an array');
      assert(r.json?.promptMessages?.[1]?.content === requestPromptOverrideB, 'T1A: system prompt should use request override');
      console.log('  T1A PASS: request promptOverride overrides stored character prompt');
    }

    // ── T1B: manual-summarize/trace — blank request override falls back ──────
    {
      const r = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          characterId: testCharId,
          chatId: testChatId,
          start: 1,
          end: 5,
          promptOverride: {
            summarizationPrompt: '',
            reSummarizationPrompt: '',
          },
        }),
      });
      assert(r.res.status === 200, `T1B: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T1B: expected type='success', got '${r.json?.type}'`);
      const prompt = r.json?.promptMessages?.[1]?.content || '';
      assert(prompt !== requestPromptOverrideB, 'T1B: blank request override should not keep request override prompt');
      assert(prompt !== characterPromptOverrideA, 'T1B: blank request override should not use stored character override');
      assert(prompt.includes('Summarize the ongoing role story'), 'T1B: blank request override should fall back to preset/default prompt');
      console.log('  T1B PASS: blank request override falls back to preset/default prompt');
    }

    // ── T1C: manual-summarize — returns scoped debug payload ─────────────────
    {
      const start = 1;
      const end = 3;
      const r = await req('/data/memory/hypav3/manual-summarize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          characterId: testCharId,
          chatId: testChatId,
          start,
          end,
          promptOverride: {
            summarizationPrompt: requestPromptOverrideB,
            reSummarizationPrompt: '',
          },
        }),
      });
      assert(r.res.status === 200, `T1C: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T1C: expected type='success', got '${r.json?.type}'`);
      assert(r.json?.debug?.characterId === testCharId, `T1C: debug.characterId expected '${testCharId}', got '${r.json?.debug?.characterId}'`);
      assert(r.json?.debug?.chatId === testChatId, `T1C: debug.chatId expected '${testChatId}', got '${r.json?.debug?.chatId}'`);
      assert(r.json?.debug?.start === start, `T1C: debug.start expected ${start}, got ${r.json?.debug?.start}`);
      assert(r.json?.debug?.end === end, `T1C: debug.end expected ${end}, got ${r.json?.debug?.end}`);
      assert(r.json?.debug?.source === 'manual', `T1C: debug.source expected 'manual', got '${r.json?.debug?.source}'`);
      assert(r.json?.debug?.prompt === requestPromptOverrideB, 'T1C: debug.prompt should match request override');
      assert(Array.isArray(r.json?.debug?.formatted) && r.json.debug.formatted.length > 0, 'T1C: debug.formatted should be non-empty array');
      console.log('  T1C PASS: manual-summarize returns scoped debug payload with resolved prompt');
    }

    // ── T2: periodic-summarize/trace — shouldRun=true ─────────────────────────
    // Conditions: supaMemory=true, hypaV3=true, periodicSummarizationEnabled=true,
    //             interval=2, 5 unsummarized messages → batchSize=2 → shouldRun
    {
      const r = await req('/data/memory/hypav3/periodic-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId }),
      });
      assert(r.res.status === 200, `T2: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T2: expected type='success', got '${r.json?.type}'`);
      assert(
        r.json?.shouldRun === true,
        `T2: expected shouldRun=true (interval=2, 5 unsummarized msgs), got shouldRun=${r.json?.shouldRun} reason='${r.json?.reason}'`
      );
      assert(r.json?.reason === 'ready', `T2: expected reason='ready', got '${r.json?.reason}'`);
      assert(r.json?.messageCount >= 1,  `T2: expected at least 1 prompt message`);
      console.log('  T2 PASS: periodic-summarize/trace — shouldRun=true, reason=ready');
    }

    // ── T3: resummarize-preview/trace ─────────────────────────────────────────
    // Uses the 2 pre-seeded summaries at indices [0,1]
    {
      const r = await req('/data/memory/hypav3/resummarize-preview/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId, summaryIndices: [0, 1] }),
      });
      assert(r.res.status === 200, `T3: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T3: expected type='success', got '${r.json?.type}'`);
      assert(r.json?.shouldRun === true, `T3: expected shouldRun=true`);
      assert(r.json?.messageCount >= 1,  `T3: expected at least 1 prompt message`);
      console.log('  T3 PASS: resummarize-preview/trace — shouldRun=true');
    }

    // ── T4: manual-summarize/trace — {{slot}} template → messageCount=1 ───────
    // Regression guard for Bug 2: {{slot}} in template must embed chat content
    // into a single merged user message instead of two separate messages.
    {
      // Patch settings to Config B: {{slot}} template
      const s = await getSettings();
      const overlay = makeTestSettings(origSettings, {
        summarizationPrompt: 'Summarize this roleplay scene: {{slot}}',
      });
      await putSettings(overlay, s.etag);
      console.log('  Patched settings → Config B ({{slot}} template)');

      const r = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          characterId: testCharId,
          chatId: testChatId,
          start: 1,
          end: 5,
          promptOverride: {
            summarizationPrompt: 'Summarize this roleplay scene: {{slot}}',
            reSummarizationPrompt: '',
          },
        }),
      });
      assert(r.res.status === 200, `T4: expected 200, got ${r.res.status}: ${r.text}`);
      assert(r.json?.type === 'success', `T4: expected type='success', got '${r.json?.type}'`);
      // {{slot}} template → single merged user message (Bug 2 fix verification)
      assert(
        r.json?.messageCount === 1,
        `T4: expected messageCount=1 ({{slot}} template), got ${r.json?.messageCount}`
      );
      assert(
        Array.isArray(r.json?.promptMessages) && r.json.promptMessages.length === 1,
        `T4: expected 1 entry in promptMessages, got ${r.json?.promptMessages?.length}`
      );
      assert(
        r.json.promptMessages[0]?.role === 'user',
        `T4: merged message should have role='user', got '${r.json.promptMessages[0]?.role}'`
      );
      // The merged content should include both the template prefix and chat content
      const mergedContent = r.json.promptMessages[0]?.content || '';
      assert(
        mergedContent.includes('Summarize this roleplay scene:'),
        `T4: merged message should contain template prefix`
      );
      assert(
        !mergedContent.includes('{{slot}}'),
        `T4: no literal {{slot}} should remain in merged message`
      );
      console.log('  T4 PASS: manual-summarize/trace — {{slot}} template, messageCount=1 (Bug 2 regression guard)');
    }

    // ── T5: periodicSummarizationEnabled=false → shouldRun=false ─────────────
    // Regression guard for Bug 3: the gate check was missing from
    // planPeriodicHypaV3Summarization.
    {
      const s = await getSettings();
      const overlay = makeTestSettings(origSettings, {
        periodicSummarizationEnabled: false,
      });
      await putSettings(overlay, s.etag);
      console.log('  Patched settings → Config C (periodicSummarizationEnabled=false)');

      const r = await req('/data/memory/hypav3/periodic-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId }),
      });
      assert(r.res.status === 200, `T5: expected 200, got ${r.res.status}: ${r.text}`);
      assert(
        r.json?.shouldRun === false,
        `T5: expected shouldRun=false when periodicSummarizationEnabled=false, got ${r.json?.shouldRun}`
      );
      assert(
        r.json?.reason === 'periodic_summarization_disabled',
        `T5: expected reason='periodic_summarization_disabled', got '${r.json?.reason}'`
      );
      console.log('  T5 PASS: periodic-summarize/trace — periodicSummarizationEnabled=false → shouldRun=false (Bug 3 regression guard)');
    }

    // ── T6: Input validation — 400 errors ────────────────────────────────────
    {
      // manual-summarize: missing characterId
      const r6a = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: testChatId, start: 1, end: 3 }),
      });
      assert(r6a.res.status === 400, `T6a: missing characterId expected 400, got ${r6a.res.status}`);

      // manual-summarize: start > end
      const r6b = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId, start: 5, end: 1 }),
      });
      assert(r6b.res.status === 400, `T6b: start>end expected 400, got ${r6b.res.status}`);

      // resummarize-preview: only 1 summary index
      const r6c = await req('/data/memory/hypav3/resummarize-preview/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: testCharId, chatId: testChatId, summaryIndices: [0] }),
      });
      assert(r6c.res.status === 400, `T6c: summaryIndices.length<2 expected 400, got ${r6c.res.status}`);

      // periodic: missing characterId
      const r6d = await req('/data/memory/hypav3/periodic-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatId: testChatId }),
      });
      assert(r6d.res.status === 400, `T6d: periodic missing characterId expected 400, got ${r6d.res.status}`);

      // manual-summarize: nonexistent character
      const r6e = await req('/data/memory/hypav3/manual-summarize/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ characterId: 'no-such-char-xyz', chatId: testChatId, start: 1, end: 2 }),
      });
      assert(r6e.res.status === 404, `T6e: nonexistent character expected 404, got ${r6e.res.status}`);

      console.log('  T6 PASS: input validation (400/404 for all invalid inputs)');
    }

  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────

    // Restore original settings
    try {
      const { etag: freshEtag } = await getSettings();
      if (freshEtag) {
        const restoreBody = origSettings !== null ? origSettings : {};
        await putSettings(restoreBody, freshEtag);
        console.log(origSettings !== null ? '  Restored original settings' : '  Cleared test settings (none existed originally)');
      }
    } catch (err) {
      console.warn(`  WARNING: Could not restore settings: ${err.message}`);
    }

    // Delete test character (recursively removes chats sub-directory too)
    if (charCreated) {
      try {
        const charRead = await req(`/data/characters/${testCharId}`);
        if (charRead.res.status === 200 && charRead.etag) {
          const del = await req(`/data/characters/${testCharId}`, {
            method: 'DELETE',
            headers: { 'if-match': charRead.etag },
          });
          if (del.res.status === 204) {
            console.log(`  Deleted test character: ${testCharId}`);
          } else {
            console.warn(`  WARNING: Delete character returned ${del.res.status}`);
          }
        }
      } catch (err) {
        console.warn(`  WARNING: Could not delete test character: ${err.message}`);
      }
    }
  }

  console.log('PASS test-server-memory');
}

main().catch((err) => {
  console.error('FAIL test-server-memory');
  console.error(err?.stack || err);
  process.exit(1);
});
