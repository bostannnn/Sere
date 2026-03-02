#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const baselinePath = path.join(__dirname, 'strict-baseline.json');
const shouldUpdateBaseline = process.argv.includes('--update-baseline');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function readBaseline() {
    if (!fs.existsSync(baselinePath)) {
        return null;
    }
    const raw = fs.readFileSync(baselinePath, 'utf-8');
    return JSON.parse(raw);
}

function writeBaseline(errorCount) {
    const payload = {
        maxErrors: errorCount,
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function extractStrictErrorCount(output) {
    const match = output.match(/found\s+(\d+)\s+errors/i);
    if (!match) return null;
    return Number(match[1]);
}

const run = spawnSync(pnpmCmd, ['run', 'check:strict'], {
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
});

const combinedOutput = `${run.stdout || ''}\n${run.stderr || ''}`;
const strictErrorCount = extractStrictErrorCount(combinedOutput);

if (!Number.isFinite(strictErrorCount)) {
    console.error('[strict-ratchet] Failed to parse strict error count from check:strict output.');
    process.stdout.write(combinedOutput);
    process.exit(1);
}

if (shouldUpdateBaseline || !fs.existsSync(baselinePath)) {
    writeBaseline(strictErrorCount);
    console.log(`[strict-ratchet] Baseline updated: maxErrors=${strictErrorCount}`);
    process.exit(0);
}

const baseline = readBaseline();
if (!baseline || !Number.isFinite(Number(baseline.maxErrors))) {
    console.error('[strict-ratchet] Invalid baseline file. Run with --update-baseline.');
    process.exit(1);
}

const maxErrors = Number(baseline.maxErrors);
if (strictErrorCount > maxErrors) {
    console.error(
        `[strict-ratchet] Strict errors increased from ${maxErrors} to ${strictErrorCount}. ` +
        'Fix new strict errors or intentionally update baseline.'
    );
    process.exit(1);
}

const delta = maxErrors - strictErrorCount;
if (delta > 0) {
    console.log(`[strict-ratchet] OK. Strict errors improved by ${delta} (from ${maxErrors} to ${strictErrorCount}).`);
} else {
    console.log(`[strict-ratchet] OK. Strict errors unchanged at ${strictErrorCount}.`);
}
