#!/usr/bin/env node
const assert = require('node:assert/strict');
const { __test } = require('../server/node/rag/pdf.cjs');

function test(name, fn) {
    try {
        fn();
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error instanceof Error ? error.stack : error);
        process.exitCode = 1;
    }
}

if (!__test) {
    throw new Error('Missing test exports from server/node/rag/pdf.cjs');
}

test('filters recurring header/footer lines', () => {
    const recurring = new Set(['chapter 1']);
    const cleaned = __test.cleanExtractedLines([
        'Chapter 1',
        'The vampire wakes in a cellar.',
        'Chapter 1',
    ], recurring);
    assert.deepEqual(cleaned, ['The vampire wakes in a cellar.']);
});

test('merges hyphenated wrapped words', () => {
    const cleaned = __test.cleanExtractedLines([
        'The chroni-',
        'cle continues into the next night.',
    ], new Set());
    assert.equal(cleaned[0], 'The chronicle continues into the next night.');
});

test('dedupes nearby repeated lines', () => {
    const cleaned = __test.cleanExtractedLines([
        'The Prince waits in silence.',
        'A cold draft moves through the hall.',
        'The Prince waits in silence.',
    ], new Set());
    assert.deepEqual(cleaned, [
        'The Prince waits in silence.',
        'A cold draft moves through the hall.',
    ]);
});

test('drops noisy semicolon-heavy rows', () => {
    const noisy = 'm ; e ; a ; n ; i ; n ; g ; f ; u ; l';
    assert.equal(__test.isLowSignalLine(noisy), true);
    const cleaned = __test.cleanExtractedLines([noisy, 'Useful narrative line.'], new Set());
    assert.deepEqual(cleaned, ['Useful narrative line.']);
});

test('keeps meaningful structured rows', () => {
    const meaningful = 'Clan ; Discipline ; Weakness of the bloodline';
    assert.equal(__test.isLowSignalLine(meaningful), false);
    const cleaned = __test.cleanExtractedLines([meaningful], new Set());
    assert.deepEqual(cleaned, [meaningful]);
});

test('detects recurring margin lines beyond only the first or last line', () => {
    const recurring = __test.detectRecurringMarginLines([
        ['Vampire: The Masquerade', 'Combat', 'Body line one', 'Page 10'],
        ['Vampire: The Masquerade', 'Combat', 'Body line two', 'Page 11'],
        ['Vampire: The Masquerade', 'Combat', 'Body line three', 'Page 12'],
    ]);
    assert.equal(recurring.has('vampire: the masquerade'), true);
    assert.equal(recurring.has('combat'), true);
});

test('merges softly wrapped paragraph lines', () => {
    const cleaned = __test.cleanExtractedLines([
        'A vampire who fails the test becomes ravenous and lashes out at the nearest vessel',
        'before regaining control over their hunger.',
    ], new Set());
    assert.deepEqual(cleaned, [
        'A vampire who fails the test becomes ravenous and lashes out at the nearest vessel before regaining control over their hunger.',
    ]);
});

test('preserves list items instead of merging them together', () => {
    const cleaned = __test.cleanExtractedLines([
        '1. Roll initiative',
        '2. Resolve intent',
        '3. Apply damage',
    ], new Set());
    assert.deepEqual(cleaned, [
        '1. Roll initiative',
        '2. Resolve intent',
        '3. Apply damage',
    ]);
});

test('does not treat repeated table headers as recurring margin noise', () => {
    const recurring = __test.detectRecurringMarginLines([
        ['Clan ; Discipline ; Bane', 'Brujah ; Celerity ; Short temper', 'Page 10'],
        ['Clan ; Discipline ; Bane', 'Gangrel ; Fortitude ; Bestial features', 'Page 11'],
        ['Clan ; Discipline ; Bane', 'Malkavian ; Auspex ; Fractured insight', 'Page 12'],
    ]);
    assert.equal(recurring.has('clan ; discipline ; bane'), false);
});

test('does not merge soft-wrapped lines across column boundaries', () => {
    const cleaned = __test.cleanExtractedLines([
        'A vampire who fails the test becomes ravenous and lashes out at the nearest vessel',
        __test.COLUMN_BREAK_MARKER,
        'before regaining control over their hunger.',
    ], new Set());
    assert.deepEqual(cleaned, [
        'A vampire who fails the test becomes ravenous and lashes out at the nearest vessel',
        'before regaining control over their hunger.',
    ]);
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
console.log('PDF cleanup regression tests passed.');
