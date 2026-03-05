#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..', '..');
const clientRoot = path.join(projectRoot, 'src');
const serverRoot = path.join(projectRoot, 'server', 'node');

const failures = [];

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.svelte-kit'].includes(entry.name)) continue;
      collectFiles(abs, predicate, out);
      continue;
    }
    if (entry.isFile() && predicate(abs)) out.push(abs);
  }
  return out;
}

function fail(rule, file, message) {
  const rel = path.relative(projectRoot, file);
  failures.push({ rule, rel, message });
}

const tsAndSvelteFiles = collectFiles(clientRoot, (abs) => abs.endsWith('.ts') || abs.endsWith('.svelte'));

const forbiddenLegacyPaths = [
  '/data/settings',
  '/data/characters',
  '/data/storage/',
];

for (const file of tsAndSvelteFiles) {
  const src = fs.readFileSync(file, 'utf-8');

  for (const legacyPath of forbiddenLegacyPaths) {
    if (src.includes(legacyPath)) {
      fail(
        'AUTH-001',
        file,
        `Found legacy endpoint reference "${legacyPath}". Use /data/state/snapshot + /data/state/commands instead.`,
      );
    }
  }

  if (src.includes('sync/multiuser')) {
    fail('AUTH-002', file, 'Found multiuser import/usage. PeerJS multiuser must be removed.');
  }
}

const serverFiles = collectFiles(serverRoot, (abs) => abs.endsWith('.cjs'));
for (const file of serverFiles) {
  if (path.basename(file).startsWith('check-')) continue;
  const src = fs.readFileSync(file, 'utf-8');
  const hasLegacyImport = /require\s*\(\s*['"`]\.\/routes\/legacy_routes\.cjs['"`]\s*\)/.test(src);
  const hasLegacyRegister = /\bregisterLegacyRoutes\b/.test(src);
  if (hasLegacyImport || hasLegacyRegister) {
    fail('AUTH-003', file, 'Found legacy route wiring. legacy_routes.cjs must stay removed.');
  }
}

if (failures.length > 0) {
  console.error('[check-server-authoritative] FAILED');
  for (const finding of failures) {
    console.error(`- ${finding.rule} ${finding.rel}: ${finding.message}`);
  }
  process.exit(1);
}

console.log('[check-server-authoritative] OK');
