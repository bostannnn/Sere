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

  it("does not fabricate a cursor range when accepting a legacy pending proposal without sourceRange", async () => {
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
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
          },
          pendingProposal: {
            proposalId: "proposal-legacy",
            sourceChatId: chatId,
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer",
              },
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
    expect(acceptRes.payload).toEqual(expect.not.objectContaining({
      range: expect.anything(),
    }));

    const characterFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"));
    expect(characterFile.character.characterEvolution.lastProcessedMessageIndexByChat ?? {}).toEqual({});
    expect(characterFile.character.characterEvolution.processedRanges ?? []).toEqual([]);

    const versionFile = JSON.parse(readFileSync(path.join(dataDirs.characters, characterId, "states", "v1.json"), "utf-8"));
    expect(versionFile.range ?? null).toBeNull();
  });

  it("preserves intimate preferences on accept when global defaults allow them", async () => {
    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "User",
        characterEvolutionDefaults: {
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
              key: "characterIntimatePreferences",
              label: "Character Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track character intimacy",
              kind: "list",
              sensitive: true,
            },
            {
              key: "userIntimatePreferences",
              label: "User Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track user intimacy",
              kind: "list",
              sensitive: true,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: true,
            allowUserIntimatePreferences: true,
          },
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
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
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
            characterIntimatePreferences: [],
            userIntimatePreferences: [],
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
              characterIntimatePreferences: [
                {
                  value: "Being in control during intimacy",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
              userIntimatePreferences: [
                {
                  value: "Face-sitting",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterIntimatePreferences",
                summary: "Character intimate preferences were updated.",
                evidence: ["Character explicitly described what they wanted."],
              },
              {
                sectionKey: "userIntimatePreferences",
                summary: "User intimate preferences were updated.",
                evidence: ["User explicitly described what they wanted."],
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
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
    }));

    const versionFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "states", "v1.json"), "utf-8"),
    );
    expect(versionFile).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
      privacy: {
        allowCharacterIntimatePreferences: true,
        allowUserIntimatePreferences: true,
      },
    }));
  });
});
