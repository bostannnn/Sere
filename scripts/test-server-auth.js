#!/usr/bin/env node
/* Smoke test for node server password auth flows. */

const baseUrl = process.env.RISU_DATA_TEST_URL || 'http://localhost:6001';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

async function request(path, options = {}, authToken) {
  const url = `${baseUrl}${path}`;
  const headers = new Headers(options.headers || {});
  if (typeof authToken === 'string') {
    headers.set('risu-auth', authToken);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, text, json };
}

async function digestPassword(raw) {
  const r = await request('/data/auth/crypto', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: raw }),
  });
  assert(r.res.status === 200, `crypto hash expected 200, got ${r.res.status}`);
  assert(r.text, 'crypto hash expected non-empty response body');
  return r.text.trim();
}

async function status(token, options = {}) {
  const headers = options.countFailure ? { 'x-risu-auth-attempt': '1' } : undefined;
  const r = await request('/data/auth/password/status', { headers }, token);
  assert(r.res.status === 200, `password status expected 200, got ${r.res.status}`);
  assert(r.json && typeof r.json.status === 'string', 'password status payload missing status');
  return r.json;
}

async function main() {
  const initial = await status('');
  assert(
    initial.status === 'unset',
    `auth smoke needs clean data root (expected unset, got ${initial.status}). ` +
      'Use RISU_DATA_ROOT=/tmp/... when starting server.'
  );

  const token1 = await digestPassword(`smoke-pass-1-${runId}`);
  const setPassword = await request('/data/auth/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: token1 }),
  });
  assert(setPassword.res.status === 200, `set password expected 200, got ${setPassword.res.status}`);

  const unauthSettings = await request('/data/settings');
  assert(unauthSettings.res.status === 401, `unauth settings expected 401, got ${unauthSettings.res.status}`);

  // Passive background API calls with missing/stale token must not burn auth lockout budget.
  for (let i = 0; i < 20; i += 1) {
    const probe = await request('/data/settings');
    assert(probe.res.status === 401, `unauth probe expected 401, got ${probe.res.status}`);
  }
  const passiveLockCheck = await status('');
  assert(
    !passiveLockCheck.retryAfterMs,
    `passive unauthorized traffic should not trigger lockout (retryAfterMs=${passiveLockCheck.retryAfterMs})`
  );

  const authSettings = await request('/data/settings', {}, token1);
  assert(
    authSettings.res.status === 200 || authSettings.res.status === 404,
    `auth settings expected 200/404, got ${authSettings.res.status}`
  );

  const token2 = await digestPassword(`smoke-pass-2-${runId}`);
  const changePassword = await request(
    '/data/auth/password/change',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: token1, password: token2 }),
    },
    token1
  );
  assert(changePassword.res.status === 200, `change password expected 200, got ${changePassword.res.status}`);

  const oldStatus = await status(token1);
  assert(oldStatus.status === 'incorrect', `old token expected incorrect, got ${oldStatus.status}`);

  const newStatus = await status(token2);
  assert(newStatus.status === 'correct', `new token expected correct, got ${newStatus.status}`);

  const oldTokenSettings = await request('/data/settings', {}, token1);
  assert(oldTokenSettings.res.status === 401, `old token settings expected 401, got ${oldTokenSettings.res.status}`);

  const newTokenSettings = await request('/data/settings', {}, token2);
  assert(
    newTokenSettings.res.status === 200 || newTokenSettings.res.status === 404,
    `new token settings expected 200/404, got ${newTokenSettings.res.status}`
  );

  const expectedMaxFailures = Number.isFinite(Number(process.env.RISU_AUTH_MAX_FAILURES))
    ? Math.max(1, Number(process.env.RISU_AUTH_MAX_FAILURES))
    : 10;
  const lockProbeAttempts = Math.max(expectedMaxFailures + 2, 12);
  let lockSeen = false;
  for (let i = 0; i < lockProbeAttempts; i += 1) {
    const probe = await status(`wrong-token-${runId}-${i}`, { countFailure: true });
    if (Number(probe.retryAfterMs) > 0) {
      lockSeen = true;
      break;
    }
  }
  assert(lockSeen, `expected auth lockout within ${lockProbeAttempts} failed status checks`);

  console.log('PASS test-server-auth');
}

main().catch((error) => {
  console.error('FAIL test-server-auth');
  console.error(error?.stack || error);
  process.exit(1);
});
