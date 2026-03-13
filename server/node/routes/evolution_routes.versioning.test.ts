import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
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

describe("evolution routes versioning", () => {
  it("allows accepting a replayed proposal for an already accepted chat", async () => {
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
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "already accepted once",
            },
          },
          stateVersions: [
            {
              version: 1,
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
              version: 1,
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

    const { postHandlers } = buildHandlers();
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const replayRes = createRes();
    await handoff!(createReq({ characterId, chatId, forceReplay: true }), replayRes);
    expect(replayRes.statusCode).toBe(200);

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      version: 2,
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.currentStateVersion).toBe(2);
    expect(characterFile.character.characterEvolution.lastProcessedChatId).toBe(chatId);
    expect(characterFile.character.characterEvolution.lastProcessedMessageIndexByChat).toEqual({
      [chatId]: 1,
    });
    expect(characterFile.character.characterEvolution.pendingProposal).toBeNull();
  });

  it("keeps an accepted version readable when snapshot finalization falls back to the staged file", async () => {
    const { postHandlers, getHandlers } = buildHandlers({
      fsOverride: {
        rename: async () => {
          throw new Error("rename failed");
        },
        copyFile: async () => {
          throw new Error("copy failed");
        },
      },
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();
    expect(getVersion).toBeTruthy();

    await handoff!(createReq({ characterId, chatId }), createRes());

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    const dataDirs = getDataDirs();
    expect(existsSync(path.join(dataDirs.characters, characterId, "states", "v1.json"))).toBe(false);
    expect(
      readdirSync(path.join(dataDirs.characters, characterId, "states")).some(
        (entry) => entry.startsWith(".v1.") && entry.endsWith(".pending.json"),
      ),
    ).toBe(true);

    const getRes = createRes();
    await getVersion!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId, version: "1" },
    }, getRes);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.payload).toEqual(expect.objectContaining({
      version: expect.objectContaining({
        version: 1,
      }),
    }));
  });

  it("does not expose staged-only versions before the character state commit succeeds", async () => {
    const dataDirs = getDataDirs();
    const statesDir = path.join(dataDirs.characters, characterId, "states");
    mkdirSync(statesDir, { recursive: true });
    writeJson(path.join(statesDir, ".v1.crash.pending.json"), {
      version: 1,
      chatId,
      acceptedAt: 123,
      state: {
        relationship: {
          trustLevel: "high",
          dynamic: "should stay hidden",
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const listVersions = getHandlers.get("/data/character-evolution/:charId/versions");
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(listVersions).toBeTruthy();
    expect(getVersion).toBeTruthy();

    const listRes = createRes();
    await listVersions!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId },
    }, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.payload).toEqual(expect.objectContaining({
      versions: [],
    }));

    const getRes = createRes();
    await getVersion!({
      method: "GET",
      originalUrl: "/data/character-evolution/test",
      body: {},
      params: { charId: characterId, version: "1" },
    }, getRes);

    expect(getRes.statusCode).toBe(404);
    expect(getRes.payload).toEqual(expect.objectContaining({
      error: "VERSION_NOT_FOUND",
    }));
  });

  it("preserves disabled-section state when accepting a proposal", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track relationship",
              kind: "object",
              sensitive: false,
            },
            {
              key: "userFacts",
              label: "User Facts",
              enabled: false,
              includeInPrompt: false,
              instruction: "Track facts",
              kind: "list",
              sensitive: false,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            userFacts: [
              {
                value: "User works nights",
                confidence: "confirmed",
                note: "from an earlier accepted chat",
                status: "active",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              userFacts: [],
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: "Relationship became warmer.",
                evidence: ["Character said they feel closer now."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        relationship: {
          trustLevel: "higher",
          dynamic: "warmer after the last exchange",
        },
        userFacts: [
          {
            value: "User works nights",
            confidence: "confirmed",
            note: "from an earlier accepted chat",
            status: "active",
          },
        ],
      }),
    }));
  });

  it("stamps canonical item metadata when accepting Phase 2 item-object sections", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            activeThreads: [],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              activeThreads: [
                {
                  value: "meet again at the station",
                  confidence: "confirmed",
                  note: "they explicitly said to revisit it next time",
                  status: "active",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The station plan is now an active thread.",
                evidence: ["They explicitly said they would meet again at the station."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload.state.activeThreads).toEqual([
      expect.objectContaining({
        value: "meet again at the station",
        confidence: "confirmed",
        note: "they explicitly said to revisit it next time",
        status: "active",
        sourceChatId: chatId,
        sourceRange: {
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
        updatedAt: acceptRes.payload.acceptedAt,
        lastSeenAt: acceptRes.payload.acceptedAt,
        timesSeen: 1,
      }),
    ]);
  });

  it("uses acceptance time instead of proposal creation time for newly accepted items", async () => {
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
          useGlobalDefaults: false,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            activeThreads: [],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              activeThreads: [
                {
                  value: "meet again at the station",
                  confidence: "confirmed",
                  status: "active",
                  updatedAt: 1234,
                  lastSeenAt: 1234,
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The station plan is now an active thread.",
                evidence: ["They explicitly said they would meet again at the station."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload.state.activeThreads[0].updatedAt).toBe(acceptRes.payload.acceptedAt);
    expect(acceptRes.payload.state.activeThreads[0].lastSeenAt).toBe(acceptRes.payload.acceptedAt);
  });
});
