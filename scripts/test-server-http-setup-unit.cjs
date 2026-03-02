#!/usr/bin/env node
/**
 * Unit tests for server_http_setup parser-skip matching helpers.
 * Pure logic tests — no server/network/file I/O.
 *
 * Run: node scripts/test-server-http-setup-unit.cjs
 */
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');

const {
  __test: {
    normalizeHttpMethod,
    normalizeHttpPath,
    buildJsonSkipMatchers,
    shouldSkipJsonBodyParser,
  },
} = require(path.join(ROOT, 'server/node/server_http_setup.cjs'));

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    failed += 1;
    return false;
  }
  console.log(`  PASS: ${msg}`);
  passed += 1;
  return true;
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function suiteNormalizeHttpMethod() {
  section('Suite 1: normalizeHttpMethod');
  assert(normalizeHttpMethod(' post ') === 'POST', 'trims and uppercases valid method');
  assert(normalizeHttpMethod('') === '', 'empty string stays empty');
  assert(normalizeHttpMethod(null) === '', 'null normalizes to empty string');
  assert(normalizeHttpMethod(undefined) === '', 'undefined normalizes to empty string');
}

function suiteNormalizeHttpPath() {
  section('Suite 2: normalizeHttpPath');
  assert(normalizeHttpPath('data/rag/ingest') === '/data/rag/ingest', 'adds leading slash');
  assert(normalizeHttpPath('/data/rag/ingest?x=1#y') === '/data/rag/ingest', 'drops query/hash');
  assert(normalizeHttpPath('/data/rag/ingest/') === '/data/rag/ingest', 'trims trailing slash when strict=false');
  assert(
    normalizeHttpPath('/DATA/RAG/INGEST') === '/data/rag/ingest',
    'lowercases when case-sensitive routing is disabled'
  );
  assert(
    normalizeHttpPath('/DATA/RAG/INGEST', { caseSensitiveRouting: true }) === '/DATA/RAG/INGEST',
    'preserves case when case-sensitive routing is enabled'
  );
  assert(
    normalizeHttpPath('/data/rag/ingest/', { strictRouting: true }) === '/data/rag/ingest/',
    'preserves trailing slash when strict routing is enabled'
  );
  assert(normalizeHttpPath('///') === '/', 'normalizes slash-only path to root');
  assert(normalizeHttpPath('') === '', 'empty string returns empty path');
}

function suiteBuildJsonSkipMatchers() {
  section('Suite 3: buildJsonSkipMatchers');
  const matchers = buildJsonSkipMatchers(
    [
      '/data/rag/ingest',
      { method: 'post', path: '/data/rag/ingest/' },
      { method: ' get ', path: '/Data/Other' },
      { method: 'post' },
      null,
      42,
    ],
    { caseSensitiveRouting: false, strictRouting: false }
  );

  assert(Array.isArray(matchers), 'returns array');
  assert(matchers.length === 3, 'drops invalid matcher entries');
  assert(matchers[0].method === '' && matchers[0].path === '/data/rag/ingest', 'string matcher maps to path-only matcher');
  assert(matchers[1].method === 'POST' && matchers[1].path === '/data/rag/ingest', 'object matcher normalizes method and path');
  assert(matchers[2].method === 'GET' && matchers[2].path === '/data/other', 'object matcher lowercases path by routing option');
}

function suiteShouldSkipJsonBodyParser() {
  section('Suite 4: shouldSkipJsonBodyParser');
  const defaultOptions = { caseSensitiveRouting: false, strictRouting: false };
  const matchers = buildJsonSkipMatchers([{ method: 'POST', path: '/data/rag/ingest' }], defaultOptions);

  assert(
    shouldSkipJsonBodyParser(
      { method: 'post', path: '/data/rag/ingest/' },
      matchers,
      defaultOptions
    ) === true,
    'regression guard: trailing slash still matches route skip matcher'
  );
  assert(
    shouldSkipJsonBodyParser(
      { method: 'POST', path: '/DATA/RAG/INGEST' },
      matchers,
      defaultOptions
    ) === true,
    'regression guard: case variant still matches when routing is case-insensitive'
  );
  assert(
    shouldSkipJsonBodyParser(
      { method: 'GET', path: '/data/rag/ingest' },
      matchers,
      defaultOptions
    ) === false,
    'method mismatch does not match'
  );
  assert(
    shouldSkipJsonBodyParser(
      { method: 'POST', originalUrl: '/data/rag/ingest/?x=1' },
      matchers,
      defaultOptions
    ) === true,
    'falls back to originalUrl when req.path is missing'
  );
  assert(
    shouldSkipJsonBodyParser(
      { method: 'POST', url: '/data/rag/ingest/?x=1' },
      matchers,
      defaultOptions
    ) === true,
    'falls back to req.url when req.path and originalUrl are missing'
  );
  assert(
    shouldSkipJsonBodyParser(
      { method: 'POST', path: '/data/rag/ingest/' },
      buildJsonSkipMatchers([{ method: 'POST', path: '/data/rag/ingest' }], { strictRouting: true, caseSensitiveRouting: false }),
      { strictRouting: true, caseSensitiveRouting: false }
    ) === false,
    'strict routing keeps slash significant, so canonical matcher does not match trailing slash'
  );
  assert(
    shouldSkipJsonBodyParser({ method: 'POST', path: '/data/rag/ingest' }, [], defaultOptions) === false,
    'empty matcher list never skips parser'
  );
}

function main() {
  suiteNormalizeHttpMethod();
  suiteNormalizeHttpPath();
  suiteBuildJsonSkipMatchers();
  suiteShouldSkipJsonBodyParser();

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log('PASS test-server-http-setup-unit');
}

main();
