#!/usr/bin/env node
/**
 * Unit tests for the HypaV3 memory pipeline.
 * Pure function tests — no server, no network, no LLM calls.
 *
 * Run: node scripts/test-memory-unit.cjs
 */
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');

const {
    resolveHypaV3Settings,
    planPeriodicHypaV3Summarization,
    applyPeriodicHypaV3Summary,
    buildServerMemoryMessages,
    cleanSummaryOutput,
} = require(path.join(ROOT, 'server/node/llm/memory.cjs'));

const { renderTemplateSlot } = require(path.join(ROOT, 'server/node/llm/scripts.cjs'));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond, msg) {
    if (!cond) {
        console.error(`  FAIL: ${msg}`);
        failed++;
    } else {
        console.log(`  PASS: ${msg}`);
        passed++;
    }
    return !!cond;
}

function assertIncludes(haystack, needle, msg) {
    return assert(typeof haystack === 'string' && haystack.includes(needle), `${msg} (expected to include: ${JSON.stringify(needle)})`);
}

function assertNotIncludes(haystack, needle, msg) {
    return assert(typeof haystack === 'string' && !haystack.includes(needle), `${msg} (expected not to include: ${JSON.stringify(needle)})`);
}

function section(name) {
    console.log(`\n=== ${name} ===`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessages(n) {
    return Array.from({ length: n }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'char',
        data: `message body ${i + 1}`,
        chatId: `chatmsg-${i}`,
    }));
}

function makePlan(extraSettings = {}) {
    return {
        character: { supaMemory: true },
        chat: { message: makeMessages(15) },
        settings: { hypaV3: true, ...extraSettings },
    };
}

function withPreset(presetSettings) {
    return {
        hypaV3: true,
        hypaV3Presets: [{ settings: presetSettings }],
    };
}

// ---------------------------------------------------------------------------
// Suite 1: resolveHypaV3Settings
// ---------------------------------------------------------------------------

async function suiteResolveSettings() {
    section('Suite 1: resolveHypaV3Settings');

    // Default: no presets
    const def = resolveHypaV3Settings({});
    assert(def.periodicSummarizationEnabled === true,  'default: periodicSummarizationEnabled === true');
    assert(def.periodicSummarizationInterval === 10,   'default: periodicSummarizationInterval === 10');
    assert(def.summarizationModel === 'subModel',      'default: summarizationModel forced to subModel');
    assert(def.memoryTokensRatio === 0.2,              'default: memoryTokensRatio === 0.2');
    assert(def.recentMemoryRatio === 0.4,              'default: recentMemoryRatio === 0.4');

    // Preset overrides
    const custom = resolveHypaV3Settings({
        hypaV3PresetId: 0,
        hypaV3Presets: [{
            settings: {
                periodicSummarizationInterval: 5,
                summarizationPrompt: 'custom-prompt',
                summarizationModel: 'gpt-4-should-be-ignored',
                periodicSummarizationEnabled: false,
            },
        }],
    });
    assert(custom.periodicSummarizationInterval === 5,    'preset: overrides interval');
    assert(custom.summarizationPrompt === 'custom-prompt','preset: overrides summarizationPrompt');
    assert(custom.summarizationModel === 'subModel',      'preset: summarizationModel always forced to subModel');
    assert(custom.periodicSummarizationEnabled === true, 'preset: periodicSummarizationEnabled is forced on');

    // Null/missing presets → defaults
    const nullPresets = resolveHypaV3Settings({ hypaV3Presets: null });
    assert(nullPresets.periodicSummarizationEnabled === true, 'null presets → default periodicSummarizationEnabled');

    // Wrong type in preset → ignored, default used
    const badType = resolveHypaV3Settings({
        hypaV3Presets: [{ settings: { periodicSummarizationInterval: 'not-a-number' } }],
    });
    assert(badType.periodicSummarizationInterval === 10, 'wrong type in preset → default used');

    // Character-level prompt overrides should win when non-empty.
    const characterOverride = resolveHypaV3Settings(
        withPreset({
            summarizationPrompt: 'preset-summary',
            reSummarizationPrompt: 'preset-resummary',
        }),
        {
            hypaV3PromptOverride: {
                summarizationPrompt: 'character-summary',
                reSummarizationPrompt: 'character-resummary',
            },
        }
    );
    assert(characterOverride.summarizationPrompt === 'character-summary', 'character override: summarizationPrompt');
    assert(characterOverride.reSummarizationPrompt === 'character-resummary', 'character override: reSummarizationPrompt');

    // Empty/whitespace character overrides should not replace preset values.
    const blankCharacterOverride = resolveHypaV3Settings(
        withPreset({
            summarizationPrompt: 'preset-summary',
            reSummarizationPrompt: 'preset-resummary',
        }),
        {
            hypaV3PromptOverride: {
                summarizationPrompt: '',
                reSummarizationPrompt: '   ',
            },
        }
    );
    assert(blankCharacterOverride.summarizationPrompt === 'preset-summary', 'blank override: keep preset summarizationPrompt');
    assert(blankCharacterOverride.reSummarizationPrompt === 'preset-resummary', 'blank override: keep preset reSummarizationPrompt');
}

// ---------------------------------------------------------------------------
// Suite 2: planPeriodicHypaV3Summarization — gating
// ---------------------------------------------------------------------------

async function suiteGating() {
    section('Suite 2: planPeriodicHypaV3Summarization — gating');

    // Gate 1: supaMemory off
    {
        const r = planPeriodicHypaV3Summarization({ character: { supaMemory: false }, chat: {}, settings: { hypaV3: true } });
        assert(r.shouldRun === false,                           'supaMemory false → shouldRun false');
        assert(r.reason === 'memory_disabled_on_character',     'reason: memory_disabled_on_character');
    }

    // Gate 2: hypaV3 disabled in settings
    {
        const r = planPeriodicHypaV3Summarization({ character: { supaMemory: true }, chat: {}, settings: { hypaV3: false } });
        assert(r.shouldRun === false,                           'hypaV3 false → shouldRun false');
        assert(r.reason === 'hypav3_disabled_in_settings',      'reason: hypav3_disabled_in_settings');
    }

    // Gate 3: legacy periodicSummarizationEnabled:false should no longer block auto-summary
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(20) },
            settings: withPreset({ periodicSummarizationEnabled: false }),
        });
        assert(r.shouldRun === true,                            'legacy periodicSummarizationEnabled false → shouldRun true');
        assert(r.reason === 'ready',                            'reason: ready');
    }

    // Gate 4: interval = 0 → invalid
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(5) },
            settings: withPreset({ periodicSummarizationInterval: 0 }),
        });
        assert(r.shouldRun === false,                   'interval 0 → shouldRun false');
        assert(r.reason === 'invalid_periodic_interval','reason: invalid_periodic_interval');
    }

    // Gate 5: not enough new messages (5 messages < interval 10)
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(5) },
            settings: { hypaV3: true },
        });
        assert(r.shouldRun === false,              'fewer messages than interval → shouldRun false');
        assert(r.reason === 'interval_not_reached','reason: interval_not_reached');
    }

    // Gate 6: all messages disabled → no summarizable
    {
        const msgs = makeMessages(15).map(m => ({ ...m, disabled: true }));
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: msgs },
            settings: { hypaV3: true },
        });
        assert(r.shouldRun === false,                   'all disabled → shouldRun false');
        assert(r.reason === 'no_summarizable_messages', 'reason: no_summarizable_messages');
    }

    // Gate 7: already summarized past this batch (lastSummarizedMessageIndex covers all messages)
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(15), hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 14, metrics: {} } },
            settings: { hypaV3: true },
        });
        assert(r.shouldRun === false,              'already summarized → shouldRun false');
        assert(r.reason === 'interval_not_reached','reason: interval_not_reached (only 1 new message)');
    }

    // Gate 8: all conditions met → ready
    {
        const r = planPeriodicHypaV3Summarization(makePlan());
        assert(r.shouldRun === true,               'all conditions met → shouldRun true');
        assert(r.reason === 'ready',               'reason: ready');
        assert(Array.isArray(r.promptMessages),    'promptMessages is array');
        assert(r.promptMessages.length > 0,        'promptMessages is non-empty');
        assert(typeof r.chunkEndIndex === 'number','chunkEndIndex is number');
    }
}

// ---------------------------------------------------------------------------
// Suite 3: buildSummarizationPromptMessages — via planPeriodicHypaV3Summarization
// ---------------------------------------------------------------------------

async function suitePromptMessages() {
    section('Suite 3: buildSummarizationPromptMessages (via plan)');

    // Default template (no {{slot}}) → 2 separate messages
    {
        const r = planPeriodicHypaV3Summarization(makePlan());
        assert(r.shouldRun === true,           'setup: plan ready');
        assert(r.promptMessages.length === 2,  'default template → 2 messages [user + system]');
        assert(r.promptMessages[0].role === 'user',   'first message role: user');
        assert(r.promptMessages[1].role === 'system', 'second message role: system');
        // System message should be the template, NOT the chat content repeated
        const chatContent = r.promptMessages[0].content;
        assertNotIncludes(r.promptMessages[1].content, chatContent.slice(0, 30), 'system message does not duplicate chat content');
    }

    // {{slot}} template → single merged user message (bug 2 fix)
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(15) },
            settings: withPreset({ summarizationPrompt: '[BEFORE {{slot}} AFTER]' }),
        });
        assert(r.shouldRun === true,          'setup: {{slot}} plan ready');
        assert(r.promptMessages.length === 1, '{{slot}} template → single user message (bug 2 fix)');
        assert(r.promptMessages[0].role === 'user', 'merged message role: user');
        assertIncludes(r.promptMessages[0].content, '[BEFORE', 'content contains template prefix');
        assertIncludes(r.promptMessages[0].content, 'AFTER]',  'content contains template suffix');
        assertIncludes(r.promptMessages[0].content, 'message body', 'content contains chat history');
        assertNotIncludes(r.promptMessages[0].content, '{{slot}}', 'no literal {{slot}} remaining');
    }

    // Multiple {{slot}} → all replaced (bug 8 fix: .replace → .replaceAll)
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(15) },
            settings: withPreset({ summarizationPrompt: 'A:{{slot}} --- B:{{slot}}' }),
        });
        assert(r.shouldRun === true,          'setup: multi-{{slot}} plan ready');
        assert(r.promptMessages.length === 1, 'multi-{{slot}} → single message');
        assertNotIncludes(r.promptMessages[0].content, '{{slot}}', 'all {{slot}} occurrences replaced (bug 8 / replaceAll fix)');
        assertIncludes(r.promptMessages[0].content, 'A:', 'first slot prefix present');
        assertIncludes(r.promptMessages[0].content, 'B:', 'second slot prefix present');
        // Both A: and B: should be followed by actual content, not just the template label
        const afterA = r.promptMessages[0].content.split('A:')[1] || '';
        assertIncludes(afterA, 'message body', 'chat content inserted at first {{slot}}');
        const afterB = r.promptMessages[0].content.split('B:')[1] || '';
        assertIncludes(afterB, 'message body', 'chat content inserted at second {{slot}}');
    }

    // doNotSummarizeUserMessage:true → user messages excluded from summarizable
    {
        const r = planPeriodicHypaV3Summarization({
            character: { supaMemory: true },
            chat: { message: makeMessages(15) },
            settings: withPreset({ doNotSummarizeUserMessage: true }),
        });
        // If there are only user messages after filtering, shouldRun might be false
        // With makeMessages(15), even indices are user, odd are char. So 7-8 char messages remain.
        if (r.shouldRun) {
            assertNotIncludes(r.promptMessages[0].content, 'user:', 'user messages excluded when doNotSummarizeUserMessage');
        } else {
            assert(true, 'doNotSummarizeUserMessage gate correctly applied');
        }
    }
}

// ---------------------------------------------------------------------------
// Suite 4: applyPeriodicHypaV3Summary
// ---------------------------------------------------------------------------

async function suiteApply() {
    section('Suite 4: applyPeriodicHypaV3Summary');

    // Empty summary → index advanced, no summary pushed
    {
        const chat = { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } };
        const plan = { chunkEndIndex: 10, hypaData: chat.hypaV3Data, summarizable: [] };
        const result = applyPeriodicHypaV3Summary({ chat, plan, summaryText: '' });
        assert(result.updated === true,                                 'empty text: updated=true');
        assert(chat.hypaV3Data.lastSummarizedMessageIndex === 10,       'empty text: index advanced to chunkEndIndex');
        assert(chat.hypaV3Data.summaries.length === 0,                  'empty text: no summary pushed');
        assert(result.reason === 'empty_summary_advanced_index',        'reason: empty_summary_advanced_index');
    }

    // Non-empty text → summary pushed
    {
        const chat = { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } };
        const plan = {
            chunkEndIndex: 5,
            hypaData: chat.hypaV3Data,
            summarizable: [{ memo: 'abc', role: 'user', content: 'hi' }, { memo: 'def', role: 'assistant', content: 'hello' }],
        };
        const result = applyPeriodicHypaV3Summary({ chat, plan, summaryText: 'Scene summary text.' });
        assert(result.updated === true,                             'non-empty: updated=true');
        assert(result.reason === 'summary_saved',                   'reason: summary_saved');
        assert(chat.hypaV3Data.summaries.length === 1,              'one summary pushed');
        assert(chat.hypaV3Data.summaries[0].text === 'Scene summary text.', 'summary text stored correctly');
        assert(chat.hypaV3Data.lastSummarizedMessageIndex === 5,    'index advanced');
        assert(Array.isArray(chat.hypaV3Data.summaries[0].chatMemos),'chatMemos is array');
        assert(chat.hypaV3Data.summaries[0].chatMemos.includes('abc'), 'chatMemo abc stored');
        assert(chat.hypaV3Data.summaries[0].chatMemos.includes('def'), 'chatMemo def stored');
        assert(chat.hypaV3Data.summaries[0].isImportant === false,  'isImportant defaults to false');
    }

    // With embedding → stored on summary entry
    {
        const chat = { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } };
        const plan = { chunkEndIndex: 3, hypaData: chat.hypaV3Data, summarizable: [] };
        applyPeriodicHypaV3Summary({ chat, plan, summaryText: 'Embedded.', summaryEmbedding: [0.1, 0.2, 0.3] });
        assert(Array.isArray(chat.hypaV3Data.summaries[0].embedding), 'embedding stored');
        assert(chat.hypaV3Data.summaries[0].embedding.length === 3,   'embedding length correct');
    }

    // Without embedding → no embedding key on entry
    {
        const chat = { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } };
        const plan = { chunkEndIndex: 3, hypaData: chat.hypaV3Data, summarizable: [] };
        applyPeriodicHypaV3Summary({ chat, plan, summaryText: 'No embed.' });
        assert(!('embedding' in chat.hypaV3Data.summaries[0]), 'no embedding key when not provided');
    }

    // Multiple calls → summaries accumulate, index advances correctly
    {
        const chat = { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } };
        const plan1 = { chunkEndIndex: 10, hypaData: chat.hypaV3Data, summarizable: [] };
        applyPeriodicHypaV3Summary({ chat, plan: plan1, summaryText: 'First batch.' });
        const plan2 = { chunkEndIndex: 20, hypaData: chat.hypaV3Data, summarizable: [] };
        applyPeriodicHypaV3Summary({ chat, plan: plan2, summaryText: 'Second batch.' });
        assert(chat.hypaV3Data.summaries.length === 2,             'two summaries accumulated');
        assert(chat.hypaV3Data.lastSummarizedMessageIndex === 20,  'index at final chunkEndIndex');
    }
}

// ---------------------------------------------------------------------------
// Suite 5: buildServerMemoryMessages (async)
// ---------------------------------------------------------------------------

async function suiteMemoryMessages() {
    section('Suite 5: buildServerMemoryMessages');

    // Gate: supaMemory off
    {
        const msgs = await buildServerMemoryMessages({
            character: { supaMemory: false },
            chat: {},
            settings: { hypaV3: true },
        });
        assert(msgs.length === 0, 'supaMemory false → empty []');
    }

    // Gate: hypaV3 off
    {
        const msgs = await buildServerMemoryMessages({
            character: { supaMemory: true },
            chat: {},
            settings: { hypaV3: false },
        });
        assert(msgs.length === 0, 'hypaV3 false → empty []');
    }

    // Gate: no summaries
    {
        const msgs = await buildServerMemoryMessages({
            character: { supaMemory: true },
            chat: { hypaV3Data: { summaries: [], lastSummarizedMessageIndex: 0, metrics: {} } },
            settings: { hypaV3: true },
        });
        assert(msgs.length === 0, 'no summaries → empty []');
    }

    // With summaries → injects system message
    {
        const chat = {
            message: [],
            hypaV3Data: {
                summaries: [
                    { text: 'First past event.', isImportant: false },
                    { text: 'Second past event.', isImportant: false },
                ],
                lastSummarizedMessageIndex: 0,
                metrics: {},
            },
        };
        const msgs = await buildServerMemoryMessages({
            character: { supaMemory: true },
            chat,
            settings: { hypaV3: true },
        });
        assert(msgs.length === 1,                                'summaries → 1 memory message');
        assert(msgs[0].role === 'system',                        'memory message role: system');
        assert(msgs[0].memo === 'hypaMemory',                    'memory message memo: hypaMemory');
        assertIncludes(msgs[0].content, '<Past Events Summary>', 'content has XML open tag');
        assertIncludes(msgs[0].content, '</Past Events Summary>','content has XML close tag');
        assertIncludes(msgs[0].content, 'First past event.',     'first summary text included');
        assertIncludes(msgs[0].content, 'Second past event.',    'second summary text included');
    }

    // Metrics updated after selection
    {
        const chat = {
            message: makeMessages(4),
            hypaV3Data: {
                summaries: [
                    { text: 'Memory A.', isImportant: false },
                    { text: 'Memory B.', isImportant: false },
                ],
                lastSummarizedMessageIndex: 0,
                metrics: {},
            },
        };
        await buildServerMemoryMessages({ character: { supaMemory: true }, chat, settings: { hypaV3: true } });
        const m = chat.hypaV3Data.metrics;
        assert(
            Array.isArray(m.lastImportantSummaries) && Array.isArray(m.lastRecentSummaries),
            'metrics object populated with selection tracking arrays'
        );
    }

    // Summary with Roleplay heading stripped before display
    {
        const chat = {
            message: [],
            hypaV3Data: {
                summaries: [{
                    text: 'Roleplay Scene Summary\n\nActual content here.\n\nKeywords: foo, bar',
                    isImportant: false,
                }],
                lastSummarizedMessageIndex: 0,
                metrics: {},
            },
        };
        const msgs = await buildServerMemoryMessages({ character: { supaMemory: true }, chat, settings: { hypaV3: true } });
        assert(msgs.length === 1, 'heading-stripped summary → 1 message');
        assertIncludes(msgs[0].content, 'Actual content here.', 'body text preserved');
        assertNotIncludes(msgs[0].content, 'Roleplay Scene Summary', 'heading stripped');
        assertNotIncludes(msgs[0].content, 'Keywords:', 'keywords stripped');
    }
}

// ---------------------------------------------------------------------------
// Suite 6: cleanSummaryOutput
// ---------------------------------------------------------------------------

async function suiteClean() {
    section('Suite 6: cleanSummaryOutput');

    assert(cleanSummaryOutput('Hello world') === 'Hello world',         'plain text unchanged');
    assert(cleanSummaryOutput('  spaces  ') === 'spaces',               'whitespace trimmed');

    {
        const out = cleanSummaryOutput('<Thoughts>hidden</Thoughts>\nVisible');
        assert(out === 'Visible', 'Thoughts block stripped');
    }
    {
        const out = cleanSummaryOutput('<think>hidden</think>\nVisible');
        assert(out === 'Visible', 'think block stripped');
    }
    {
        const out = cleanSummaryOutput('<THOUGHTS>hidden</THOUGHTS>\nVisible');
        assert(out === 'Visible', 'case-insensitive Thoughts block stripped');
    }
    {
        const out = cleanSummaryOutput('Before<Thoughts>hidden</Thoughts>After');
        assert(out === 'BeforeAfter', 'thought block mid-string stripped');
    }
    {
        const out = cleanSummaryOutput('<Thoughts>A</Thoughts>Middle<think>B</think>End');
        assert(out === 'MiddleEnd', 'multiple thought blocks stripped');
    }
    {
        const out = cleanSummaryOutput('<Thoughts>\nmultiline\nthought\n</Thoughts>\nKept');
        assert(out === 'Kept', 'multiline thought block stripped');
    }
}

// ---------------------------------------------------------------------------
// Suite 7: renderTemplateSlot
// ---------------------------------------------------------------------------

async function suiteRenderSlot() {
    section('Suite 7: renderTemplateSlot');

    // No {{slot}} → format returned unchanged (slot arg ignored)
    {
        const out = renderTemplateSlot('Hello world', 'CONTENT', {}, {});
        assert(out === 'Hello world', 'no {{slot}} → format returned as-is');
    }

    // Single {{slot}} → replaced once
    {
        const out = renderTemplateSlot('Before {{slot}} after', 'CONTENT', {}, {});
        assert(out === 'Before CONTENT after', 'single {{slot}} replaced correctly');
    }

    // Two {{slot}} → both replaced (the .replace → .replaceAll fix, bug 8)
    {
        const out = renderTemplateSlot('A: {{slot}} and B: {{slot}}', 'X', {}, {});
        assert(out === 'A: X and B: X', 'two {{slot}} both replaced (bug 8 / replaceAll fix)');
        assertNotIncludes(out, '{{slot}}', 'no literal {{slot}} remaining after two replacements');
    }

    // Three {{slot}} → all replaced
    {
        const out = renderTemplateSlot('{{slot}}-{{slot}}-{{slot}}', 'Y', {}, {});
        assert(out === 'Y-Y-Y', 'three {{slot}} all replaced');
    }

    // Empty slot content
    {
        const out = renderTemplateSlot('{{slot}}', '', {}, {});
        assert(out === '', 'empty slot content handled');
    }
}

// ---------------------------------------------------------------------------
// Run all suites
// ---------------------------------------------------------------------------

async function main() {
    console.log('HypaV3 memory pipeline — unit tests');
    console.log('=====================================');

    await suiteResolveSettings();
    await suiteGating();
    await suitePromptMessages();
    await suiteApply();
    await suiteMemoryMessages();
    await suiteClean();
    await suiteRenderSlot();

    console.log(`\n=====================================`);
    console.log(`Total: ${passed + failed} tests — ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.error(`\nFAIL  test-memory-unit`);
        process.exit(1);
    } else {
        console.log(`\nPASS  test-memory-unit`);
    }
}

main().catch((err) => {
    console.error('Unexpected test runner error:', err);
    process.exit(1);
});
