import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";

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

describe("evolution routes recovery", () => {
  it("does not leave a visible version file behind when accept fails", async () => {
    const { postHandlers: handoffHandlers } = buildHandlers();
    const handoff = handoffHandlers.get("/data/character-evolution/handoff");
    expect(handoff).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const { postHandlers } = buildHandlers({
      applyStateCommands: async () => {
        throw new Error("simulated replace failure");
      },
    });
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(500);

    const dataDirs = getDataDirs();
    const statesDir = path.join(dataDirs.characters, characterId, "states");
    expect(existsSync(path.join(statesDir, "v1.json"))).toBe(false);
    expect(existsSync(statesDir)).toBe(true);
    expect(readdirSync(statesDir)).toEqual([]);
  });

  it("rebuilds version history from disk when stored stateVersions metadata is empty", async () => {
    const dataDirs = getDataDirs();
    const versionOne = {
      version: 1,
      chatId: "chat-a",
      acceptedAt: 1001,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "first",
        },
      },
    };
    const versionTwo = {
      version: 2,
      chatId: "chat-b",
      acceptedAt: 1002,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "second",
        },
      },
    };

    writeJson(path.join(dataDirs.characters, characterId, "states", "v1.json"), versionOne);
    writeJson(path.join(dataDirs.characters, characterId, "states", "v2.json"), versionTwo);
    writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
      character: {
        chaId: characterId,
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 2,
          currentState: versionTwo.state,
          stateVersions: [],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    expect(listVersions).toBeTruthy();

    const listRes = createRes();
    await listVersions!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId },
    }, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      ok: true,
      currentStateVersion: 2,
      versions: [
        { version: 2, chatId: "chat-b", acceptedAt: 1002 },
        { version: 1, chatId: "chat-a", acceptedAt: 1001 },
      ],
    }));
  });

  it("rebuilds version history from staged files when finalized snapshots are unavailable", async () => {
    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.characters, characterId, "states", ".v1.pending-a.pending.json"), {
      version: 1,
      chatId: "chat-a",
      acceptedAt: 1001,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "first",
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "states", ".v2.pending-b.pending.json"), {
      version: 2,
      chatId: "chat-b",
      acceptedAt: 1002,
      state: {
        relationship: {
          trustLevel: "higher",
          dynamic: "second",
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
      character: {
        chaId: characterId,
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 2,
          currentState: {},
          stateVersions: [],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    expect(listVersions).toBeTruthy();

    const listRes = createRes();
    await listVersions!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId },
    }, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      versions: [
        { version: 2, chatId: "chat-b", acceptedAt: 1002 },
        { version: 1, chatId: "chat-a", acceptedAt: 1001 },
      ],
    }));

    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(getVersion).toBeTruthy();

    const versionRes = createRes();
    await getVersion!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId, version: "2" },
    }, versionRes);

    expect(versionRes.statusCode).toBe(200);
    expect(versionRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 2,
        state: expect.objectContaining({
          relationship: expect.objectContaining({
            dynamic: "second",
          }),
        }),
      }),
    }));
  });
});
