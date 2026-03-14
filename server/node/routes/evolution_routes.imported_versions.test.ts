import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as path from "node:path";

import {
  buildHandlers,
  characterId,
  chatId,
  cleanupEvolutionRouteTest,
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

function createGetReq(params: Record<string, string>) {
  return {
    method: "GET",
    originalUrl: "/data/character-evolution/test",
    body: {},
    params,
  };
}

describe("evolution routes imported version history", () => {
  it("only lists the current imported version when no snapshot files exist", async () => {
    const dataDirs = getDataDirs();
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
          currentStateVersion: 6,
          currentState: {
            relationship: {
              trustLevel: "high",
              dynamic: "imported current state",
            },
          },
          stateVersions: [
            { version: 6, chatId, acceptedAt: 6000 },
            { version: 5, chatId: "chat-5", acceptedAt: 5000 },
            { version: 4, chatId: "chat-4", acceptedAt: 4000 },
          ],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(listVersions).toBeTruthy();
    expect(getVersion).toBeTruthy();

    const listRes = createRes();
    await listVersions!(createGetReq({ charId: characterId }), listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      currentStateVersion: 6,
      versions: [
        expect.objectContaining({
          version: 6,
          chatId,
          acceptedAt: 6000,
        }),
      ],
    }));

    const currentRes = createRes();
    await getVersion!(createGetReq({ charId: characterId, version: "6" }), currentRes);

    expect(currentRes.statusCode).toBe(200);
    expect(currentRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 6,
        chatId,
        acceptedAt: 6000,
        state: expect.objectContaining({
          relationship: expect.objectContaining({
            dynamic: "imported current state",
          }),
        }),
      }),
    }));

    const missingRes = createRes();
    await getVersion!(createGetReq({ charId: characterId, version: "5" }), missingRes);

    expect(missingRes.statusCode).toBe(404);
    expect(missingRes.payload).toEqual(expect.objectContaining({
      error: "VERSION_NOT_FOUND",
    }));
  });

  it("keeps disk-backed history entries while synthesizing the missing current snapshot", async () => {
    const dataDirs = getDataDirs();
    const statesDir = path.join(dataDirs.characters, characterId, "states");
    writeJson(path.join(statesDir, "v1.json"), {
      version: 1,
      chatId: "chat-1",
      acceptedAt: 1000,
      state: {
        relationship: {
          trustLevel: "steady",
          dynamic: "snapshot one",
        },
      },
    });
    writeJson(path.join(statesDir, "v2.json"), {
      version: 2,
      chatId: "chat-2",
      acceptedAt: 2000,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "snapshot two",
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
          currentStateVersion: 3,
          currentState: {
            relationship: {
              trustLevel: "high",
              dynamic: "current imported state",
            },
          },
          stateVersions: [
            { version: 3, chatId, acceptedAt: 3000 },
            { version: 2, chatId: "chat-2", acceptedAt: 2000 },
            { version: 1, chatId: "chat-1", acceptedAt: 1000 },
          ],
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(listVersions).toBeTruthy();
    expect(getVersion).toBeTruthy();

    const listRes = createRes();
    await listVersions!(createGetReq({ charId: characterId }), listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      versions: [
        expect.objectContaining({ version: 3 }),
        expect.objectContaining({ version: 2 }),
        expect.objectContaining({ version: 1 }),
      ],
    }));

    const currentRes = createRes();
    await getVersion!(createGetReq({ charId: characterId, version: "3" }), currentRes);
    expect(currentRes.statusCode).toBe(200);
    expect(currentRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 3,
        state: expect.objectContaining({
          relationship: expect.objectContaining({
            dynamic: "current imported state",
          }),
        }),
      }),
    }));

    const diskRes = createRes();
    await getVersion!(createGetReq({ charId: characterId, version: "2" }), diskRes);
    expect(diskRes.statusCode).toBe(200);
    expect(diskRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 2,
        state: expect.objectContaining({
          relationship: expect.objectContaining({
            dynamic: "snapshot two",
          }),
        }),
      }),
    }));
  });
});
