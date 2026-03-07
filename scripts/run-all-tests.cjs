#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const NODE_BIN = process.execPath;
const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const SERVER_READY_TIMEOUT_MS = Number(process.env.RISU_SERVER_START_TIMEOUT_MS || 30000);

function listFiles(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function runCommand(label, command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    console.log(`\n[all-tests] ${label}`);
    console.log(`[all-tests] $ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${label} failed with ${code === null ? `signal ${signal}` : `exit code ${code}`}`
        )
      );
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate ephemeral port')));
        return;
      }
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForServer(baseUrl, proc, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`Server exited early with code ${proc.exitCode}`);
    }

    try {
      const res = await fetch(`${baseUrl}/data/state/snapshot`);
      if (res.status === 200 || res.status === 401 || res.status === 403) {
        return;
      }
    } catch {
      // server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for server readiness at ${baseUrl}`);
}

function waitForExit(proc, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;

    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    proc.once('exit', done);

    setTimeout(() => {
      done();
    }, timeoutMs);
  });
}

async function stopServer(proc) {
  if (!proc || proc.exitCode !== null) return;

  proc.kill('SIGTERM');
  await waitForExit(proc, 4000);

  if (proc.exitCode === null) {
    proc.kill('SIGKILL');
    await waitForExit(proc, 2000);
  }
}

function writeBaselineSettings(dataRoot) {
  const settingsPath = path.join(dataRoot, 'settings.json');
  const payload = {
    version: 1,
    data: {
      customModels: [
        {
          id: 'xcustom:::all-tests-private',
          name: 'All Tests Private Target',
          url: 'http://127.0.0.1:18080/v1/chat/completions',
          key: '',
          params: '',
        },
      ],
    },
  };
  fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function runServerSmokeScript(scriptPath) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'risu-all-tests-'));
  let serverProc = null;

  try {
    writeBaselineSettings(tempRoot);

    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`\n[all-tests] Starting isolated server for ${rel(scriptPath)}`);
    serverProc = spawn(NODE_BIN, ['server/node/server.cjs'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        SERE_DATA_ROOT: tempRoot,
        RISU_DATA_ROOT: tempRoot,
      },
      stdio: 'inherit',
    });

    serverProc.on('error', (err) => {
      console.error(`[all-tests] Server process error: ${err.message}`);
    });

    await waitForServer(baseUrl, serverProc, SERVER_READY_TIMEOUT_MS);

    await runCommand(`Server smoke: ${rel(scriptPath)}`, NODE_BIN, [rel(scriptPath)], {
      ...process.env,
      RISU_DATA_TEST_URL: baseUrl,
      RISU_STORAGE_TEST_ALLOW_WRITE: '1',
    });
  } finally {
    await stopServer(serverProc);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const standaloneScripts = [
    ...listFiles(path.join(ROOT, 'scripts'), (name) => {
      if (!/^test-.*\.(cjs|js)$/.test(name)) return false;
      return !/^test-server-.*\.js$/.test(name);
    }),
    ...listFiles(path.join(ROOT, 'dev'), (name) => {
      if (!/^test-.*\.(cjs|js)$/.test(name)) return false;
      return !/^test-server-.*\.js$/.test(name);
    }),
  ];

  const serverSmokeScripts = [
    ...listFiles(path.join(ROOT, 'scripts'), (name) => /^test-server-.*\.js$/.test(name)),
    ...listFiles(path.join(ROOT, 'dev'), (name) => /^test-server-.*\.js$/.test(name)),
  ];

  if (process.argv.includes('--list')) {
    console.log('[all-tests] Vitest: pnpm exec vitest run');
    console.log('[all-tests] Standalone scripts:');
    for (const script of standaloneScripts) console.log(`  - ${rel(script)}`);
    console.log('[all-tests] Server smoke scripts (isolated server per script):');
    for (const script of serverSmokeScripts) console.log(`  - ${rel(script)}`);
    return;
  }

  const failures = [];
  async function runAndCapture(label, fn) {
    try {
      await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ label, message });
      console.error(`[all-tests] FAIL in ${label}: ${message}`);
    }
  }

  await runAndCapture('Vitest suite', () => runCommand('Vitest suite', PNPM_BIN, ['exec', 'vitest', 'run']));

  for (const script of standaloneScripts) {
    const label = `Standalone test: ${rel(script)}`;
    await runAndCapture(label, () => runCommand(label, NODE_BIN, [rel(script)]));
  }

  for (const script of serverSmokeScripts) {
    const label = `Server smoke: ${rel(script)}`;
    await runAndCapture(label, () => runServerSmokeScript(script));
  }

  if (failures.length > 0) {
    console.error('\n[all-tests] Summary of failed stages:');
    for (const failure of failures) {
      console.error(`  - ${failure.label}: ${failure.message}`);
    }
    throw new Error(`${failures.length} stage(s) failed`);
  }

  console.log('\n[all-tests] PASS: all discovered tests completed successfully.');
}

main().catch((error) => {
  console.error('\n[all-tests] FAIL');
  console.error(error?.stack || error);
  process.exit(1);
});
