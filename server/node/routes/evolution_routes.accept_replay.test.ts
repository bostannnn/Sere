import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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

describe("evolution routes accept and replay", () => {
  it("accepts a pending proposal and writes a version file", async () => {
    const { postHandlers, getHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    const dataDirs = getDataDirs();
    const versionPath = path.join(dataDirs.characters, characterId, "states", "v1.json");
    expect(existsSync(versionPath)).toBe(true);

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.currentStateVersion).toBe(1);
    expect(characterFile.character.characterEvolution.pendingProposal).toBeNull();
    expect(characterFile.character.characterEvolution.lastProcessedMessageIndexByChat).toEqual({
      [chatId]: 1,
    });
    expect(characterFile.character.characterEvolution.processedRanges).toEqual([
      {
        version: 1,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      },
    ]);

    if (getVersion) {
      const getRes = createRes();
      await getVersion({
        method: "GET",
        originalUrl: "/data/character-evolution/test",
        body: {},
        params: { charId: characterId, version: "1" },
      }, getRes);
      expect(getRes.statusCode).toBe(200);
      expect(getRes.payload).toEqual(expect.objectContaining({
        version: expect.objectContaining({
          version: 1,
          range: {
            chatId,
            startMessageIndex: 0,
            endMessageIndex: 1,
          },
          sectionConfigs: expect.any(Array),
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        }),
      }));
    }
  });

  it("rejects malformed partial accept payloads instead of silently sanitizing them", async () => {
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({
      proposedState: [],
    }, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(400);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining("proposedState must be an object"),
    }));

    const dataDirs = getDataDirs();
    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      sourceChatId: chatId,
    }));
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
  });

  it("re-validates pending proposals against latest global defaults on accept", async () => {
    const dataDirs = getDataDirs();
    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "Andrew",
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "Facts about {{user}} as seen by {{char}}.",
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: false,
              includeInPrompt: true,
              instruction: "Track relationship shifts.",
              kind: "object",
              sensitive: false,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
      },
    });

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(400);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      error: "EVOLUTION_INVALID_PROPOSAL",
      message: expect.stringContaining('proposedState section "relationship" is not enabled for evolution'),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.pendingProposal).toEqual(expect.objectContaining({
      sourceChatId: chatId,
    }));
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
  });

  it("allows an explicit replay handoff for an already accepted chat", async () => {
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
          currentStateVersion: 3,
          currentState: {},
          stateVersions: [
            {
              version: 3,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 1,
          },
          processedRanges: [
            {
              version: 3,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 1,
              },
            },
          ],
        },
      },
    });

    const appendLLMAudit = vi.fn(async () => {});
    const { postHandlers } = buildHandlers({ appendLLMAudit });
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({ characterId, chatId, forceReplay: true }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({
      ok: true,
      replayed: true,
      proposal: expect.objectContaining({
        sourceChatId: chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
    }));
    expect(appendLLMAudit).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "character_evolution_handoff",
      status: 200,
      metadata: expect.objectContaining({
        replayed: true,
      }),
      response: expect.objectContaining({
        replayed: true,
      }),
    }));
  });

  it("rejects replay for a disjoint range that was never accepted", async () => {
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [
            {
              version: 1,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          processedRanges: [
            {
              version: 1,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 0,
          },
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({
      characterId,
      chatId,
      forceReplay: true,
      sourceRange: {
        chatId,
        startMessageIndex: 1,
        endMessageIndex: 1,
      },
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "RANGE_REPLAY_REQUIRES_ACCEPTED_RANGE",
    }));
  });

  it("rejects replay ranges that extend beyond accepted coverage", async () => {
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
          currentStateVersion: 1,
          currentState: {},
          stateVersions: [
            {
              version: 1,
              chatId,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          processedRanges: [
            {
              version: 1,
              acceptedAt: 1000,
              range: {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: 0,
              },
            },
          ],
          lastProcessedChatId: chatId,
          lastProcessedMessageIndexByChat: {
            [chatId]: 0,
          },
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const handler = postHandlers.get("/data/character-evolution/handoff");
    expect(handler).toBeTruthy();

    const res = createRes();
    await handler!(createReq({
      characterId,
      chatId,
      forceReplay: true,
      sourceRange: {
        chatId,
        startMessageIndex: 0,
        endMessageIndex: 1,
      },
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toEqual(expect.objectContaining({
      error: "RANGE_REPLAY_REQUIRES_ACCEPTED_RANGE",
    }));
  });

});
