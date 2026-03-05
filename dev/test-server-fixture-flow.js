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
let eventCursor = 0;
let mutationCounter = 0;

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

async function getSnapshot() {
  const snap = await request('/data/state/snapshot');
  assert(snap.res.status === 200, `snapshot expected 200, got ${snap.res.status}`);
  eventCursor = Number.isFinite(Number(snap.json?.lastEventId)) ? Number(snap.json.lastEventId) : eventCursor;
  return snap.json || {};
}

async function applyCommands(commands) {
  mutationCounter += 1;
  const r = await request('/data/state/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientMutationId: `fixture-${runId}-${mutationCounter}`,
      baseEventId: eventCursor,
      commands,
    }),
  });
  assert(r.res.status === 200 || r.res.status === 409, `state commands expected 200/409, got ${r.res.status}`);
  eventCursor = Number.isFinite(Number(r.json?.lastEventId)) ? Number(r.json.lastEventId) : eventCursor;
  return r;
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
  const charId = `fixture-char-${runId}`;
  const character = makeCharacterSkeleton(charId, `Migration Smoke ${runId}`, imagePath);
  const post = await applyCommands([{
    type: 'character.create',
    charId,
    character,
  }]);
  assert(post.res.status === 200 && post.json?.ok === true, `fixture character create expected success, got ${post.res.status}`);
  return { id: charId };
}

async function addFixtureChat(charId) {
  const chatId = `fixture-chat-${runId}`;
  const post = await applyCommands([{
    type: 'chat.create',
    charId,
    chatId,
    chat: {
      id: chatId,
      name: `Fixture Chat ${runId}`,
      note: 'smoke',
      message: [{ role: 'user', data: 'hello fixture' }],
      localLore: [],
    },
  }]);
  assert(post.res.status === 200 && post.json?.ok === true, `fixture chat create expected success, got ${post.res.status}`);
}

async function verifyFixtureCharacter(charId) {
  const snapshot = await getSnapshot();
  const characters = Array.isArray(snapshot.characters) ? snapshot.characters : [];
  const target = characters.find((entry) => entry?.chaId === charId);
  assert(target, 'fixture character not present in snapshot');
  assert(target.image && String(target.image).startsWith('assets/'), 'fixture image path missing');

  const chatsByCharacter = snapshot.chatsByCharacter || {};
  const chats = Array.isArray(chatsByCharacter[charId]) ? chatsByCharacter[charId] : [];
  assert(chats.length > 0, 'fixture chat list empty');
}

async function cleanupFixtureCharacter(charId) {
  const del = await applyCommands([{
    type: 'character.delete',
    charId,
  }]);
  assert(del.res.status === 200 && del.json?.ok === true, `fixture character delete expected success, got ${del.res.status}`);
}

async function run() {
  if (!allowWrites) {
    throw new Error('Refusing to run: set RISU_STORAGE_TEST_ALLOW_WRITE=1');
  }

  console.log('[FixtureSmoke] Starting:', baseUrl);
  await getSnapshot();
  const assetPath = await uploadFixtureAsset();
  const { id } = await createFixtureCharacter(assetPath);
  await addFixtureChat(id);
  await verifyFixtureCharacter(id);
  await cleanupFixtureCharacter(id);
  console.log('[FixtureSmoke] OK');
}

run().catch((error) => {
  console.error('[FixtureSmoke] FAILED', error.message);
  process.exit(1);
});
