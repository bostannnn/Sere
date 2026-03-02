#!/usr/bin/env node
/**
 * Integration smoke tests for RAG ingest hardening.
 * Requires a running server.
 *
 * Usage:
 *   RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-rag.js
 */
'use strict';

const baseUrl = process.env.RISU_DATA_TEST_URL || 'http://localhost:6001';
const ALLOW_WRITE = process.env.RISU_STORAGE_TEST_ALLOW_WRITE === '1';
const authToken = process.env.RISU_TEST_AUTH_TOKEN || process.env.RISU_AUTH_TOKEN || '';
const OVERSIZE_BYTES = Number.isFinite(Number(process.env.RISU_RAG_SMOKE_OVERSIZE_BYTES))
  ? Math.max(1024 * 1024, Number(process.env.RISU_RAG_SMOKE_OVERSIZE_BYTES))
  : 24 * 1024 * 1024;

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function req(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) {
    headers.set('risu-auth', authToken);
  }
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array) && !(typeof body === 'string')) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function listRulebooks() {
  const r = await req('/data/rag/rulebooks');
  if (r.res.status === 401) {
    return { status: 401, count: null, items: null };
  }
  assert(r.res.status === 200, `GET /data/rag/rulebooks expected 200/401, got ${r.res.status}: ${r.text}`);
  assert(Array.isArray(r.json), 'GET /data/rag/rulebooks expected array payload');
  return { status: 200, count: r.json.length, items: r.json };
}

async function main() {
  if (!ALLOW_WRITE) {
    console.error('FAIL test-server-rag: set RISU_STORAGE_TEST_ALLOW_WRITE=1 before running smoke tests.');
    process.exit(1);
  }

  const authStatus = await req('/data/auth/password/status');
  assert(authStatus.res.status === 200, `GET /data/auth/password/status expected 200, got ${authStatus.res.status}`);
  console.log(`test-server-rag: server reachable at ${baseUrl}`);

  // T1: Non-RAG endpoint should still be protected by global JSON size limits.
  {
    const tooLarge = await req('/data/llm/preview', {
      method: 'POST',
      body: {
        mode: 'invalid_mode',
        provider: 'openai',
        payloadPadding: 'x'.repeat(OVERSIZE_BYTES),
      },
    });
    assert(
      tooLarge.res.status === 413,
      `T1: /data/llm/preview oversized payload expected 413, got ${tooLarge.res.status}: ${tooLarge.text.slice(0, 240)}`
    );
    console.log('  T1 PASS: global JSON limit still enforced for /data/llm/preview');
  }

  // T2: RAG ingest parser skip must work for both canonical and trailing-slash
  // variants; request should fail by auth/validation, never by global 413 parser.
  for (const ingestPath of ['/data/rag/ingest', '/data/rag/ingest/']) {
    const scoped = await req(ingestPath, {
      method: 'POST',
      body: {
        name: `scoped-limit-probe-${Date.now()}.txt`,
        base64: '',
        payloadPadding: 'x'.repeat(OVERSIZE_BYTES),
      },
    });
    assert(
      scoped.res.status !== 413,
      `T2: ${ingestPath} should bypass global parser 413 (got 413)`
    );
    assert(
      scoped.res.status === 400 || scoped.res.status === 401,
      `T2: ${ingestPath} expected 400 (validation) or 401 (auth), got ${scoped.res.status}: ${scoped.text.slice(0, 240)}`
    );
    console.log(`  T2 PASS: ${ingestPath} preserved route-scoped parser behavior (status=${scoped.res.status})`);
  }

  // T3: Zero-text guard should emit stream terminal error and not create a rulebook.
  {
    const before = await listRulebooks();
    const zeroTextPayload = {
      name: `zero-text-${Date.now()}.txt`,
      base64: Buffer.from('   ', 'utf8').toString('base64'),
    };
    const ingest = await req('/data/rag/ingest', {
      method: 'POST',
      body: zeroTextPayload,
    });

    if (ingest.res.status === 401) {
      console.log('  T3 SKIP: auth required and no valid auth token provided for zero-text guard check');
    } else {
      assert(ingest.res.status === 200, `T3: zero-text ingest expected 200 stream, got ${ingest.res.status}: ${ingest.text}`);
      assert(
        ingest.text.includes('"status":"error"'),
        `T3: zero-text ingest expected terminal error stream, got: ${ingest.text.slice(0, 240)}`
      );
      assert(
        ingest.text.includes('No usable text could be extracted'),
        `T3: zero-text ingest expected explicit reason in stream, got: ${ingest.text.slice(0, 240)}`
      );

      const after = await listRulebooks();
      if (before.status === 200 && after.status === 200) {
        assert(before.count === after.count, `T3: zero-text ingest should not persist rulebook (before=${before.count}, after=${after.count})`);
      }
      console.log('  T3 PASS: zero-text guard returns explicit error and does not persist rulebook');
    }
  }

  // T4: Invalid RAG search body should follow { error, message } response contract.
  {
    const invalidSearch = await req('/data/rag/search', {
      method: 'POST',
      body: {
        query: '',
        bookIds: null,
      },
    });
    if (invalidSearch.res.status === 401) {
      console.log('  T4 SKIP: auth required and no valid auth token provided for RAG error-shape check');
    } else {
      assert(
        invalidSearch.res.status === 400,
        `T4: invalid /data/rag/search expected 400, got ${invalidSearch.res.status}: ${invalidSearch.text}`
      );
      assert(
        invalidSearch.json && typeof invalidSearch.json.error === 'string' && typeof invalidSearch.json.message === 'string',
        `T4: invalid /data/rag/search expected {error,message}, got ${invalidSearch.text}`
      );
      console.log('  T4 PASS: RAG validation errors follow {error,message} contract');
    }
  }

  // T5: Missing If-Match should be rejected for RAG metadata updates.
  {
    const missingIfMatch = await req('/data/rag/rulebooks/missing-if-match-probe', {
      method: 'PATCH',
      body: { name: 'missing-if-match-probe' },
    });
    if (missingIfMatch.res.status === 401) {
      console.log('  T5 SKIP: auth required and no valid auth token provided for RAG If-Match check');
    } else {
      assert(
        missingIfMatch.res.status === 412,
        `T5: PATCH /data/rag/rulebooks/:id without If-Match expected 412, got ${missingIfMatch.res.status}: ${missingIfMatch.text}`
      );
      assert(
        missingIfMatch.json?.error === 'PRECONDITION_REQUIRED',
        `T5: expected PRECONDITION_REQUIRED, got ${missingIfMatch.text}`
      );
      assert(
        typeof missingIfMatch.json?.message === 'string' && missingIfMatch.json.message.length > 0,
        `T5: expected human-readable message for precondition failure, got ${missingIfMatch.text}`
      );
      console.log('  T5 PASS: missing If-Match is rejected on RAG metadata updates');
    }
  }

  // T6: If a rulebook exists, stale If-Match must conflict and latest ETag must allow update.
  {
    const listed = await listRulebooks();
    if (listed.status === 401) {
      console.log('  T6 SKIP: auth required and no valid auth token provided for RAG optimistic concurrency check');
    } else if (!listed.count || !listed.items || listed.items.length === 0) {
      console.log('  T6 SKIP: no existing rulebooks available for stale/valid If-Match probe');
    } else {
      const target = listed.items[0];
      const targetId = encodeURIComponent(String(target.id));
      const stale = await req(`/data/rag/rulebooks/${targetId}`, {
        method: 'PATCH',
        headers: { 'if-match': '"stale-etag-probe"' },
        body: {
          name: target.name,
          priority: target.priority ?? 0,
          metadata: target.metadata ?? {},
        },
      });
      assert(
        stale.res.status === 409,
        `T6: stale If-Match expected 409, got ${stale.res.status}: ${stale.text}`
      );
      assert(
        stale.json?.error === 'ETAG_MISMATCH',
        `T6: stale If-Match expected ETAG_MISMATCH, got ${stale.text}`
      );
      const latestEtag = stale.res.headers.get('etag');
      assert(latestEtag, `T6: stale If-Match response expected ETag header, got headers=${JSON.stringify(Object.fromEntries(stale.res.headers.entries()))}`);

      const valid = await req(`/data/rag/rulebooks/${targetId}`, {
        method: 'PATCH',
        headers: { 'if-match': latestEtag },
        body: {
          name: target.name,
          priority: target.priority ?? 0,
          metadata: target.metadata ?? {},
        },
      });
      assert(
        valid.res.status === 200,
        `T6: valid If-Match expected 200, got ${valid.res.status}: ${valid.text}`
      );
      const updatedEtag = valid.res.headers.get('etag');
      assert(updatedEtag, `T6: valid If-Match response expected ETag header, got headers=${JSON.stringify(Object.fromEntries(valid.res.headers.entries()))}`);
      console.log('  T6 PASS: stale If-Match conflicts and latest ETag succeeds for RAG metadata updates');
    }
  }

  console.log('PASS test-server-rag');
}

main().catch((error) => {
  console.error('FAIL test-server-rag');
  console.error(error?.stack || error);
  process.exit(1);
});
