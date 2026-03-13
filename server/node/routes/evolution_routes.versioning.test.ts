import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
            activeThreads: [],
            runningJokes: [],
            characterLikes: [],
            characterDislikes: [],
            characterHabits: [],
            characterBoundariesPreferences: [],
            userFacts: [],
            userRead: [],
            userLikes: [],
            userDislikes: [],
            keyMoments: [],
            characterIntimatePreferences: [],
            userIntimatePreferences: [],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 2,
              endMessageIndex: 5,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "keep the ferry plan alive",
                  confidence: "likely",
                  note: "they explicitly said to revisit it next time",
                  status: "active",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "A carry-forward thread was identified.",
                evidence: ["They agreed to revisit the ferry plan soon."],
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
        activeThreads: [
          expect.objectContaining({
            value: "keep the ferry plan alive",
            confidence: "likely",
            status: "active",
            sourceChatId: chatId,
            sourceRange: {
              startMessageIndex: 2,
              endMessageIndex: 5,
            },
            timesSeen: 1,
          }),
        ],
      }),
    }));
    expect(typeof acceptRes.payload.acceptedAt).toBe("number");
    expect(acceptRes.payload.state.activeThreads[0].updatedAt).toBe(acceptRes.payload.acceptedAt);
    expect(acceptRes.payload.state.activeThreads[0].lastSeenAt).toBe(acceptRes.payload.acceptedAt);
  });

  it("uses acceptance time instead of proposal creation time for newly accepted items", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    const nowValues = [1000, 2000, 3000, 4000, 5000];
    nowSpy.mockImplementation(() => nowValues.shift() ?? 5000);

    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => JSON.stringify({
        proposedState: {
          activeThreads: [
            {
              value: "meet again at the station",
              confidence: "likely",
              status: "active",
            },
          ],
        },
        changes: [
          {
            sectionKey: "activeThreads",
            summary: "A new carry-forward thread was identified.",
            evidence: ["They agreed to meet again at the station."],
          },
        ],
      }),
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const handoffRes = createRes();
    await handoff!(createReq({ characterId, chatId }), handoffRes);
    expect(handoffRes.statusCode).toBe(200);
    const proposalCreatedAt = handoffRes.payload.proposal.createdAt;
    expect(typeof proposalCreatedAt).toBe("number");
    expect(handoffRes.payload.proposal.proposedState.activeThreads[0]).toEqual(expect.objectContaining({
      updatedAt: proposalCreatedAt,
      lastSeenAt: proposalCreatedAt,
    }));

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload.acceptedAt).toBeGreaterThan(proposalCreatedAt);
    expect(acceptRes.payload.state.activeThreads[0]).toEqual(expect.objectContaining({
      value: "meet again at the station",
      updatedAt: acceptRes.payload.acceptedAt,
      lastSeenAt: acceptRes.payload.acceptedAt,
    }));

    nowSpy.mockRestore();
  });

  it("normalizes legacy string-array snapshots when loading a saved version", async () => {
    const dataDirs = getDataDirs();
    const statesDir = path.join(dataDirs.characters, characterId, "states");
    mkdirSync(statesDir, { recursive: true });
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
          currentState: {},
          stateVersions: [
            {
              version: 1,
              chatId,
              acceptedAt: 123,
            },
          ],
        },
      },
    });
    writeJson(path.join(statesDir, "v1.json"), {
      version: 1,
      chatId,
      acceptedAt: 123,
      state: {
        activeThreads: ["legacy station promise"],
        userRead: ["still thinks the user is testing her"],
        relationship: {
          trustLevel: "warming",
          dynamic: "careful but affectionate",
        },
      },
    });

    const { getHandlers } = buildHandlers();
    const getVersion = getHandlers.get("/data/character-evolution/:charId/versions/:version");
    expect(getVersion).toBeTruthy();

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
        state: expect.objectContaining({
          activeThreads: [{ value: "legacy station promise", status: "active" }],
          userRead: [{ value: "still thinks the user is testing her", status: "active" }],
        }),
      }),
    }));
  });

  it("preserves provenance metadata when accepting a lifecycle status transition on an existing item", async () => {
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
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            activeThreads: [
              {
                value: "keep the ferry plan alive",
                status: "active",
                confidence: "likely",
                note: "Still unresolved before this accept",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 1,
                  endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 120,
                timesSeen: 2,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-archive-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              activeThreads: [
                {
                  value: "keep the ferry plan alive",
                  status: "archived",
                  confidence: "likely",
                  note: "Resolved in the latest chat",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The ferry plan is now resolved.",
                evidence: ["They agreed it was finished and no longer pending."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [
            {
              version: 1,
              chatId: "chat-old",
              acceptedAt: 120,
            },
          ],
          lastProcessedChatId: "chat-old",
          lastProcessedMessageIndexByChat: {
            "chat-old": 3,
          },
          processedRanges: [],
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
        activeThreads: [
          expect.objectContaining({
            value: "keep the ferry plan alive",
            status: "archived",
            note: "Resolved in the latest chat",
            sourceChatId: "chat-old",
            sourceRange: {
              startMessageIndex: 1,
              endMessageIndex: 3,
            },
            updatedAt: 100,
            lastSeenAt: 120,
            timesSeen: 2,
          }),
        ],
      }),
    }));
  });

  it("preserves provenance metadata when accepting an active-to-corrected transition on an existing item", async () => {
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
          currentStateVersion: 1,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "warm",
            },
            activeThreads: [
              {
                value: "user hates ferries",
                status: "active",
                confidence: "suspected",
                note: "Earlier rough interpretation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 4,
                },
                updatedAt: 150,
                lastSeenAt: 170,
                timesSeen: 3,
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-correct-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "steady",
                dynamic: "warm",
              },
              activeThreads: [
                {
                  value: "user hates ferries",
                  status: "corrected",
                  confidence: "confirmed",
                  note: "They clarified they only hate crowded ferry terminals",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "The earlier ferry read was corrected.",
                evidence: ["They said ferries are fine, but crowded terminals stress them out."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [
            {
              version: 1,
              chatId: "chat-old",
              acceptedAt: 170,
            },
          ],
          lastProcessedChatId: "chat-old",
          lastProcessedMessageIndexByChat: {
            "chat-old": 4,
          },
          processedRanges: [],
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
        activeThreads: [
          expect.objectContaining({
            value: "user hates ferries",
            status: "corrected",
            confidence: "confirmed",
            note: "They clarified they only hate crowded ferry terminals",
            sourceChatId: "chat-old",
            sourceRange: {
              startMessageIndex: 2,
              endMessageIndex: 4,
            },
            updatedAt: 150,
            lastSeenAt: 170,
            timesSeen: 3,
          }),
        ],
      }),
    }));
  });

  it("keeps archived items in canonical state when a later active-only proposal omits them", async () => {
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
          currentStateVersion: 1,
          currentState: {
            characterLikes: [
              {
                value: "Stalker",
                status: "active",
                confidence: "confirmed",
              },
              {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                sourceChatId: "chat-old",
              },
              {
                value: "Texas Chain Saw",
                status: "active",
                confidence: "confirmed",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-retain-archived",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              characterLikes: [
                {
                  value: "Stalker",
                  status: "active",
                  confidence: "confirmed",
                },
                {
                  value: "Texas Chain Saw",
                  status: "active",
                  confidence: "confirmed",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "No new like changes.",
                evidence: ["The scene focused on current movie plans."],
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
    expect(acceptRes.payload.state.characterLikes).toEqual([
      expect.objectContaining({
        value: "Stalker",
        status: "active",
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "archived",
        sourceChatId: "chat-old",
      }),
      expect.objectContaining({
        value: "Texas Chain Saw",
        status: "active",
      }),
    ]);
  });

  it("keeps corrected items in canonical state when a later active-only proposal omits them", async () => {
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
          currentStateVersion: 1,
          currentState: {
            activeThreads: [
              {
                value: "user hates ferries",
                status: "corrected",
                confidence: "confirmed",
                sourceChatId: "chat-old",
              },
              {
                value: "user dislikes ferry terminals",
                status: "active",
                confidence: "confirmed",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-retain-corrected",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "user dislikes ferry terminals",
                  status: "active",
                  confidence: "confirmed",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "No corrected-thread deletion should occur.",
                evidence: ["The clarified ferry-terminal preference remains current."],
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
        value: "user hates ferries",
        status: "corrected",
        sourceChatId: "chat-old",
      }),
      expect.objectContaining({
        value: "user dislikes ferry terminals",
        status: "active",
      }),
    ]);
  });

  it("preserves same-value archived history when a matching active item remains in canonical state", async () => {
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
          currentStateVersion: 1,
          currentState: {
            characterLikes: [
              {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 2,
                  endMessageIndex: 4,
                },
                updatedAt: 150,
                lastSeenAt: 170,
                timesSeen: 3,
              },
              {
                value: "Dead Man",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-preserve-same-value-archive",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              characterLikes: [
                {
                  value: "Dead Man",
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation updated",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "Current live formulation was refined.",
                evidence: ["The same favorite film came up again with clearer wording."],
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
    expect(acceptRes.payload.state.characterLikes).toEqual([
      expect.objectContaining({
        value: "Dead Man",
        status: "archived",
        note: "older archived formulation",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 2,
          endMessageIndex: 4,
        },
        updatedAt: 150,
        lastSeenAt: 170,
        timesSeen: 3,
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "active",
        note: "current live formulation updated",
      }),
    ]);
  });

  it("preserves same-value corrected history when a matching active item remains in canonical state", async () => {
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
          currentStateVersion: 1,
          currentState: {
            activeThreads: [
              {
                value: "user hates ferries",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation",
                sourceChatId: "chat-old",
                sourceRange: {
                  startMessageIndex: 3,
                  endMessageIndex: 5,
                },
                updatedAt: 210,
                lastSeenAt: 230,
                timesSeen: 4,
              },
              {
                value: "user hates ferries",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
              },
            ],
          },
          pendingProposal: {
            proposalId: "proposal-preserve-same-value-corrected",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              activeThreads: [
                {
                  value: "user hates ferries",
                  status: "active",
                  confidence: "confirmed",
                  note: "current live formulation updated",
                },
              ],
            },
            changes: [
              {
                sectionKey: "activeThreads",
                summary: "Current live formulation was refined.",
                evidence: ["The same ferry read came up again with clearer wording."],
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
        value: "user hates ferries",
        status: "corrected",
        note: "older corrected formulation",
        sourceChatId: "chat-old",
        sourceRange: {
          startMessageIndex: 3,
          endMessageIndex: 5,
        },
        updatedAt: 210,
        lastSeenAt: 230,
        timesSeen: 4,
      }),
      expect.objectContaining({
        value: "user hates ferries",
        status: "active",
        note: "current live formulation updated",
      }),
    ]);
  });

  it("migrates a legacy phase 1 state through handoff accept and retains archived history on the next accept", async () => {
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
              trustLevel: "",
              dynamic: "",
            },
            characterLikes: [
              "Stalker",
            ],
            keyMoments: [
              "Eva framed movies as emotional landmarks.",
            ],
            lastChatEnded: {
              state: "close and reflective",
              residue: "film talk should carry forward",
            },
          },
          stateVersions: [],
          lastProcessedChatId: null,
          processedRanges: [],
          lastProcessedMessageIndexByChat: {},
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "chats", `${chatId}.json`), {
      chat: {
        id: chatId,
        message: [
          { role: "user", data: "What films matter to you most?" },
          { role: "char", data: "Stalker and Dead Man feel closest to my bloodstream." },
          { role: "user", data: "What about Dead Man next time?" },
          { role: "char", data: "We can revisit Stalker; Dead Man feels like history now." },
        ],
      },
    });

    let llmCallCount = 0;
    const { postHandlers } = buildHandlers({
      executeInternalLLMTextCompletion: async () => {
        llmCallCount += 1;
        if (llmCallCount === 1) {
          return JSON.stringify({
            proposedState: {
              relationship: {
                trustLevel: "warmer",
                dynamic: "films became a real bridge",
              },
              characterLikes: [
                "Stalker",
                "Dead Man",
              ],
              keyMoments: [
                "Eva explicitly tied Stalker and Dead Man to how she sees herself.",
              ],
              lastChatEnded: {
                state: "close and reflective",
                residue: "the shared movie language should carry into the next chat",
              },
            },
            changes: [
              {
                sectionKey: "characterLikes",
                summary: "Films became explicit durable likes.",
                evidence: ["Eva named Stalker and Dead Man as central films."],
              },
              {
                sectionKey: "keyMoments",
                summary: "The film exchange became a notable moment.",
                evidence: ["The conversation made the movie discussion emotionally significant."],
              },
            ],
          });
        }

        return JSON.stringify({
          proposedState: {
            relationship: {
              trustLevel: "warmer",
              dynamic: "films became a real bridge",
            },
            characterLikes: [
              {
                value: "Stalker",
                status: "active",
                confidence: "confirmed",
                note: "still live in current taste",
              },
            ],
            keyMoments: [
              {
                value: "Eva shifted Dead Man into history while keeping Stalker current.",
                confidence: "likely",
                status: "active",
                note: "second-pass active-only proposal",
              },
            ],
            lastInteractionEnded: {
              state: "more settled and selective",
              residue: "Stalker remains current; Dead Man reads as older history",
            },
          },
          changes: [
            {
              sectionKey: "keyMoments",
              summary: "The follow-up clarified which movie remains current.",
              evidence: ["Eva said Dead Man feels like history now."],
            },
          ],
        });
      },
    });
    const handoff = postHandlers.get("/data/character-evolution/handoff");
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(handoff).toBeTruthy();
    expect(accept).toBeTruthy();

    const firstHandoffRes = createRes();
    await handoff!(
      createReq({
        characterId,
        chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      }),
      firstHandoffRes,
    );
    expect(firstHandoffRes.statusCode).toBe(200);

    const firstCharacterFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"),
    );
    const firstPendingState = structuredClone(
      firstCharacterFile.character.characterEvolution.pendingProposal.proposedState,
    );
    firstPendingState.characterLikes = firstPendingState.characterLikes.map((item: Record<string, unknown>) =>
      item.value === "Dead Man"
        ? { ...item, status: "archived", note: "review archived after acceptance" }
        : item,
    );

    const firstAcceptRes = createRes();
    await accept!(
      createReq({ proposedState: firstPendingState }, { charId: characterId }),
      firstAcceptRes,
    );
    expect(firstAcceptRes.statusCode).toBe(200);
    expect(firstAcceptRes.payload.state.lastInteractionEnded).toEqual({
      state: "close and reflective",
      residue: "the shared movie language should carry into the next chat",
    });
    expect(firstAcceptRes.payload.state.keyMoments).toEqual([
      expect.objectContaining({
        value: "Eva explicitly tied Stalker and Dead Man to how she sees herself.",
        status: "active",
      }),
    ]);

    const secondHandoffRes = createRes();
    await handoff!(
      createReq({
        characterId,
        chatId,
        sourceRange: {
          chatId,
          startMessageIndex: 2,
          endMessageIndex: 3,
        },
      }),
      secondHandoffRes,
    );
    expect(secondHandoffRes.statusCode).toBe(200);

    const secondAcceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), secondAcceptRes);
    expect(secondAcceptRes.statusCode).toBe(200);

    const finalCharacterFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "character.json"), "utf-8"),
    );
    expect(finalCharacterFile.character.characterEvolution.currentState.characterLikes).toEqual([
      expect.objectContaining({
        value: "Stalker",
        status: "active",
      }),
      expect.objectContaining({
        value: "Dead Man",
        status: "archived",
        note: "review archived after acceptance",
      }),
    ]);
    expect(finalCharacterFile.character.characterEvolution.currentState.lastInteractionEnded).toEqual({
      state: "more settled and selective",
      residue: "Stalker remains current; Dead Man reads as older history",
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        finalCharacterFile.character.characterEvolution.currentState,
        "lastChatEnded",
      ),
    ).toBe(false);
    expect(finalCharacterFile.character.characterEvolution.currentStateVersion).toBe(2);
    expect(finalCharacterFile.character.characterEvolution.processedRanges).toEqual([
      {
        version: 1,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 0,
          endMessageIndex: 1,
        },
      },
      {
        version: 2,
        acceptedAt: expect.any(Number),
        range: {
          chatId,
          startMessageIndex: 2,
          endMessageIndex: 3,
        },
      },
    ]);
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
