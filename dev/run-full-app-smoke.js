#!/usr/bin/env node
/* Full app smoke runner (UI settings smoke + server API smoke pack) */

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = Number(process.env.RISU_SMOKE_PORT || process.env.PORT || 6001);
const baseUrl = process.env.RISU_DATA_TEST_URL || `http://127.0.0.1:${port}`;
const useExistingServer = process.env.RISU_USE_EXISTING_SERVER === '1';
const skipSettingsSmoke = process.env.RISU_SKIP_SETTINGS_SMOKE === '1';
const dataRoot = process.env.SERE_DATA_ROOT || `/tmp/risu-full-smoke-${Date.now()}`;
const serverStartTimeoutMs = Number(process.env.RISU_SERVER_START_TIMEOUT_MS || 30000);

function runCheck(name, cmd, env = process.env) {
  const [bin, ...args] = cmd;
  console.log(`[FullAppSmoke] Running: ${name}`);
  const result = spawnSync(bin, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function waitForServerReady(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${url}/data/settings`, { method: 'GET' });
      if (res.status === 200 || res.status === 404) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms (${url})`);
}

async function run() {
  console.log(`[FullAppSmoke] Base URL: ${baseUrl}`);
  let serverProc = null;
  try {
    if (!skipSettingsSmoke) {
      runCheck('Settings Smoke', ['node', 'dev/check-settings-smoke.js']);
    } else {
      console.log('[FullAppSmoke] Skipping settings smoke (RISU_SKIP_SETTINGS_SMOKE=1)');
    }

    if (!useExistingServer) {
      console.log(`[FullAppSmoke] Starting server on port ${port} with SERE_DATA_ROOT=${dataRoot}`);
      serverProc = spawn('node', ['server/node/server.cjs'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(port),
          SERE_DATA_ROOT: dataRoot,
        },
        stdio: 'inherit',
      });
      await waitForServerReady(baseUrl, serverStartTimeoutMs);
    } else {
      console.log('[FullAppSmoke] Using existing server (RISU_USE_EXISTING_SERVER=1)');
      await waitForServerReady(baseUrl, serverStartTimeoutMs);
    }

    runCheck(
      'Migration API Smoke Pack',
      ['node', 'dev/run-migration-smoke-pack.js'],
      {
        ...process.env,
        RISU_DATA_TEST_URL: baseUrl,
        RISU_STORAGE_TEST_ALLOW_WRITE: '1',
      }
    );

    console.log('[FullAppSmoke] OK');
  } finally {
    if (serverProc) {
      console.log('[FullAppSmoke] Stopping server');
      serverProc.kill('SIGTERM');
      await sleep(600);
      if (!serverProc.killed) {
        serverProc.kill('SIGKILL');
      }
    }
  }
}

run().catch((error) => {
  console.error('[FullAppSmoke] FAILED', error.message);
  process.exit(1);
});

