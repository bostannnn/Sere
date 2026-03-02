#!/usr/bin/env node
/* Fixture-based smoke for character/chat/assets flow in server mode */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = process.env.RISU_DATA_TEST_URL || 'http://localhost:6001';
const allowWrites = process.env.RISU_STORAGE_TEST_ALLOW_WRITE === '1';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pR8QAAAAASUVORK5CYII=';

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
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

function loadCharacterFixture() {
  const fixturePath = path.join(__dirname, 'fixtures', 'migration-character.fixture.json');
  const raw = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(raw);
}

function makeCharacterSkeleton(id, name, imagePath) {
  const fixture = loadCharacterFixture();
  fixture.chaId = id;
  fixture.name = name;
  fixture.image = imagePath;
  return fixture;
}

async function uploadFixtureAsset() {
  const payload = Buffer.from(TINY_PNG_BASE64, 'base64');
  const post = await request(`/data/assets?folder=other&ext=png&id=fixture-${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload,
  });
  assert(post.res.status === 201, `fixture asset upload expected 201, got ${post.res.status}`);
  const assetPath = post.json?.path;
  assert(assetPath && assetPath.startsWith('assets/'), 'fixture asset path missing');

  const get = await request(`/data/${assetPath}`);
  assert(get.res.ok, `fixture asset fetch expected 200, got ${get.res.status}`);
  return assetPath;
}

async function createFixtureCharacter(imagePath) {
  const body = {
    version: 1,
    updatedAt: Date.now(),
    character: makeCharacterSkeleton('', `Migration Smoke ${runId}`, imagePath),
  };
  const post = await request('/data/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(post.res.status === 201, `fixture character create expected 201, got ${post.res.status}`);
  const etag = post.res.headers.get('etag');
  const id = post.json?.character?.chaId || post.json?.data?.chaId;
  assert(id, 'fixture character id missing');
  assert(etag, 'fixture character etag missing');
  return { id, etag };
}

async function addFixtureChat(charId) {
  const body = {
    version: 1,
    updatedAt: Date.now(),
    chat: {
      id: '',
      name: `Fixture Chat ${runId}`,
      note: 'smoke',
      message: [{ role: 'user', data: 'hello fixture' }],
      localLore: [],
    },
  };
  const post = await request(`/data/characters/${charId}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(post.res.status === 201, `fixture chat create expected 201, got ${post.res.status}`);
}

async function verifyFixtureCharacter(charId) {
  const get = await request(`/data/characters/${charId}`);
  assert(get.res.ok, `fixture character get expected 200, got ${get.res.status}`);
  const payload = get.json?.character || get.json?.data || get.json;
  assert(payload?.image && String(payload.image).startsWith('assets/'), 'fixture image path missing');

  const chats = await request(`/data/characters/${charId}/chats`);
  assert(chats.res.ok, `fixture chat list expected 200, got ${chats.res.status}`);
  assert(Array.isArray(chats.json) && chats.json.length > 0, 'fixture chat list empty');

  const list = await request('/data/characters');
  assert(list.res.ok, `fixture character list expected 200, got ${list.res.status}`);
  assert(Array.isArray(list.json), 'fixture character list payload invalid');
  assert(list.json.some((item) => item?.id === charId), 'fixture character not present in list');
}

async function cleanupFixtureCharacter(charId, etag) {
  const del = await request(`/data/characters/${charId}`, {
    method: 'DELETE',
    headers: { 'If-Match': etag },
  });
  assert(del.res.status === 204, `fixture character delete expected 204, got ${del.res.status}`);
}

async function run() {
  if (!allowWrites) {
    throw new Error('Refusing to run: set RISU_STORAGE_TEST_ALLOW_WRITE=1');
  }

  console.log('[FixtureSmoke] Starting:', baseUrl);
  const assetPath = await uploadFixtureAsset();
  const { id, etag } = await createFixtureCharacter(assetPath);
  await addFixtureChat(id);
  await verifyFixtureCharacter(id);
  await cleanupFixtureCharacter(id, etag);
  console.log('[FixtureSmoke] OK');
}

run().catch((error) => {
  console.error('[FixtureSmoke] FAILED', error.message);
  process.exit(1);
});
