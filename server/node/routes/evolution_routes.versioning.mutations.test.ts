import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as path from "node:path";
import { existsSync, readFileSync } from "node:fs";

import {
  buildHandlers,
  characterId,
  chatId,
  cleanupEvolutionRouteTest,
  createReq,
  createRes,
  getDataDirs,
  setupEvolutionRouteTest,
  writeJson,
} from "./evolution_routes.test_helpers";

beforeEach(() => {
  setupEvolutionRouteTest();
});

afterEach(() => {
  cleanupEvolutionRouteTest();
});

function buildVersionPayload(version: number, startMessageNumber: number, stateValue: string) {
  return {
    version,
    chatId,
    acceptedAt: version * 100,
    range: {
      chatId,
      startMessageIndex: startMessageNumber - 1,
      endMessageIndex: startMessageNumber + 9 - 1,
    },
    state: {
      relationship: {
        trustLevel: "",
        dynamic: "",
      },
      activeThreads: [
        {
          value: stateValue,
          status: "active",
          confidence: "confirmed",
          lastSeenVersion: version,
          unseenAcceptedHandoffs: 0,
        },
      ],
      runningJokes: [],
      characterLikes: [],
      characterDislikes: [],
      characterHabits: [],
      characterBoundariesPreferences: [],
      userFacts: [],
      userRead: [],
      userLikes: [],
      userDislikes: [],
      lastInteractionEnded: {
        state: "",
        residue: "",
      },
      keyMoments: [],
      characterIntimatePreferences: [],
      userIntimatePreferences: [],
    },
  };
}

function seedLinearVersions() {
  const dataDirs = getDataDirs();
  const version1 = buildVersionPayload(1, 1, "v1");
  const version2 = buildVersionPayload(2, 11, "v2");
  const version3 = buildVersionPayload(3, 21, "v3");
  writeJson(path.join(dataDirs.characters, characterId, "states", "v1.json"), version1);
  writeJson(path.join(dataDirs.characters, characterId, "states", "v2.json"), version2);
  writeJson(path.join(dataDirs.characters, characterId, "states", "v3.json"), version3);
  writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
    character: {
      chaId: characterId,
      type: "character",
      name: "Eva",
      desc: "desc",
      personality: "personality",
      characterEvolution: {
        enabled: true,
        useGlobalDefaults: false,
        extractionProvider: "openrouter",
        extractionModel: "anthropic/claude-3.5-haiku",
        extractionMaxTokens: 2400,
        extractionPrompt: "prompt",
        currentStateVersion: 3,
        currentState: version3.state,
        pendingProposal: {
          proposalId: "stale-proposal",
          sourceChatId: chatId,
          createdAt: 999,
          proposedState: version3.state,
          changes: [],
        },
        stateVersions: [
          { version: 1, chatId, acceptedAt: 100, range: version1.range },
          { version: 2, chatId, acceptedAt: 200, range: version2.range },
          { version: 3, chatId, acceptedAt: 300, range: version3.range },
        ],
        processedRanges: [
          { version: 1, acceptedAt: 100, range: version1.range },
          { version: 2, acceptedAt: 200, range: version2.range },
          { version: 3, acceptedAt: 300, range: version3.range },
        ],
        lastProcessedChatId: chatId,
        lastProcessedMessageIndexByChat: {
          [chatId]: 29,
        },
      },
    },
  });
}

function readCharacterFile() {
  return JSON.parse(readFileSync(path.join(getDataDirs().characters, characterId, "character.json"), "utf-8")).character;
}

describe("evolution routes versioning mutations", () => {
  it("clears an exact accepted coverage range and rolls state back to the last surviving version", async () => {
    seedLinearVersions();
    const { postHandlers } = buildHandlers();
    const clearCoverage = postHandlers.get("/data/character-evolution/:charId/coverage/clear");
    expect(clearCoverage).toBeTruthy();

    const res = createRes();
    await clearCoverage!(
      createReq(
        {
          range: {
            chatId,
            startMessageIndex: 10,
            endMessageIndex: 19,
          },
        },
        { charId: characterId },
      ),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      invalidatedVersions: [2, 3],
      currentStateVersion: 1,
    }));

    const nextCharacter = readCharacterFile();
    expect(nextCharacter.characterEvolution.currentStateVersion).toBe(1);
    expect(nextCharacter.characterEvolution.currentState.activeThreads).toEqual([
      expect.objectContaining({ value: "v1" }),
    ]);
    expect(nextCharacter.characterEvolution.pendingProposal).toBeNull();
    expect(nextCharacter.characterEvolution.processedRanges).toEqual([
      expect.objectContaining({ version: 1 }),
    ]);
    expect(nextCharacter.characterEvolution.lastProcessedMessageIndexByChat[chatId]).toBe(9);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v1.json"))).toBe(true);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v2.json"))).toBe(false);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v3.json"))).toBe(false);
  });

  it("rejects coverage clearing for a partial overlap instead of matching loosely", async () => {
    seedLinearVersions();
    const { postHandlers } = buildHandlers();
    const clearCoverage = postHandlers.get("/data/character-evolution/:charId/coverage/clear");
    expect(clearCoverage).toBeTruthy();

    const res = createRes();
    await clearCoverage!(
      createReq(
        {
          range: {
            chatId,
            startMessageIndex: 12,
            endMessageIndex: 18,
          },
        },
        { charId: characterId },
      ),
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "COVERAGE_RANGE_NOT_FOUND",
    }));
  });

  it("reverts to an earlier version and invalidates later versions", async () => {
    seedLinearVersions();
    const { postHandlers } = buildHandlers();
    const revertVersion = postHandlers.get("/data/character-evolution/:charId/versions/:version/revert");
    expect(revertVersion).toBeTruthy();

    const res = createRes();
    await revertVersion!(createReq({}, { charId: characterId, version: "2" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      revertedToVersion: 2,
      invalidatedVersions: [3],
      currentStateVersion: 2,
    }));

    const nextCharacter = readCharacterFile();
    expect(nextCharacter.characterEvolution.currentState.activeThreads).toEqual([
      expect.objectContaining({ value: "v2" }),
    ]);
    expect(nextCharacter.characterEvolution.processedRanges).toEqual([
      expect.objectContaining({ version: 1 }),
      expect.objectContaining({ version: 2 }),
    ]);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v3.json"))).toBe(false);
  });

  it("deletes an interior version as rollback-from-here and removes invalidated snapshots", async () => {
    seedLinearVersions();
    const { postHandlers } = buildHandlers();
    const deleteVersion = postHandlers.get("/data/character-evolution/:charId/versions/:version/delete");
    expect(deleteVersion).toBeTruthy();

    const res = createRes();
    await deleteVersion!(createReq({}, { charId: characterId, version: "2" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      deletedVersion: 2,
      invalidatedVersions: [2, 3],
      currentStateVersion: 1,
    }));

    const nextCharacter = readCharacterFile();
    expect(nextCharacter.characterEvolution.currentState.activeThreads).toEqual([
      expect.objectContaining({ value: "v1" }),
    ]);
    expect(nextCharacter.characterEvolution.stateVersions).toEqual([
      expect.objectContaining({ version: 1 }),
    ]);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v2.json"))).toBe(false);
    expect(existsSync(path.join(getDataDirs().characters, characterId, "states", "v3.json"))).toBe(false);
  });
});
