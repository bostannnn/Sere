#!/usr/bin/env node
/* Runs the server migration smoke pack (storage + llm + memory + fixture flow) */

import { spawnSync } from 'node:child_process';

const baseUrl = process.env.RISU_DATA_TEST_URL || 'http://localhost:6001';
const env = {
  ...process.env,
  RISU_DATA_TEST_URL: baseUrl,
  RISU_STORAGE_TEST_ALLOW_WRITE: '1',
};

const checks = [
  { name: 'Storage API', cmd: ['node', 'scripts/test-server-storage.js'] },
  { name: 'LLM Migration API', cmd: ['node', 'scripts/test-server-llm-phaseA.js'] },
  { name: 'Memory API', cmd: ['node', 'scripts/test-server-memory.js'] },
  { name: 'Fixture Flow API', cmd: ['node', 'dev/test-server-fixture-flow.js'] },
];

function runCheck(check) {
  const [bin, ...args] = check.cmd;
  const res = spawnSync(bin, args, {
    env,
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  return res.status === 0;
}

console.log(`[MigrationSmokePack] Base URL: ${baseUrl}`);
for (const check of checks) {
  console.log(`[MigrationSmokePack] Running: ${check.name}`);
  const ok = runCheck(check);
  if (!ok) {
    console.error(`[MigrationSmokePack] FAILED: ${check.name}`);
    process.exit(1);
  }
}
console.log('[MigrationSmokePack] OK');
